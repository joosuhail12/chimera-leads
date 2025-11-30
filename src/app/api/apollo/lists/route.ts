import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ApolloService } from '@/lib/services/apollo';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schemas
const syncListsSchema = z.object({
  action: z.literal('sync'),
});

const getListMembersSchema = z.object({
  listId: z.string(),
  page: z.number().min(1).default(1),
  perPage: z.number().min(1).max(100).default(100),
});

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('list_id');

    const apolloService = new ApolloService(undefined, orgId);
    const supabase = await createClient();

    if (listId) {
      // Get members of a specific list
      const page = parseInt(searchParams.get('page') || '1');
      const perPage = parseInt(searchParams.get('per_page') || '100');

      const members = await apolloService.getListMembers(listId, page, perPage);

      return NextResponse.json({
        success: true,
        listId,
        members,
        pagination: {
          page,
          per_page: perPage,
          total: members.length, // Apollo API might provide total count
        },
      });
    } else {
      // Get all lists from database (synced lists)
      const { data: lists, error } = await supabase
        .from('apollo_lists')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        lists,
        total: lists.length,
      });
    }
  } catch (error) {
    console.error('Apollo lists error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve lists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const apolloService = new ApolloService(undefined, orgId);

    if (body.action === 'sync') {
      // Sync lists from Apollo to database
      const result = await apolloService.syncLists();

      return NextResponse.json({
        success: true,
        action: 'sync',
        synced: result.synced,
        failed: result.failed,
        message: `Successfully synced ${result.synced} lists`,
      });
    } else if (body.action === 'import_members') {
      // Import members from a list to leads
      const { listId, importOptions = {} } = body;

      if (!listId) {
        return NextResponse.json(
          { error: 'List ID is required for member import' },
          { status: 400 }
        );
      }

      // Get all members from the list (pagination might be needed for large lists)
      const members = await apolloService.getListMembers(listId);

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const member of members) {
        try {
          // Check if lead already exists
          const supabase = await createClient();
          const { data: existingLead } = await supabase
            .from('sales_leads')
            .select('id')
            .eq('email', member.email)
            .eq('organization_id', orgId)
            .single();

          if (existingLead && !importOptions.updateExisting) {
            skipped++;
            continue;
          }

          // Import or update the lead
          await apolloService.importPersonToLeads(member, orgId);
          imported++;
        } catch (error) {
          console.error(`Failed to import ${member.email}:`, error);
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        action: 'import_members',
        listId,
        imported,
        skipped,
        failed,
        total: members.length,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "sync" or "import_members"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Apollo lists operation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a synced list
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('list_id');

    if (!listId) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('apollo_lists')
      .delete()
      .eq('apollo_list_id', listId)
      .eq('organization_id', orgId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'List removed successfully',
      listId,
    });
  } catch (error) {
    console.error('Apollo list deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  }
}