/**
 * API endpoints for individual sequence template operations
 * Handles GET, PATCH, DELETE for specific templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceTemplateService } from '@/lib/services/sequences';
import { UpdateSequenceTemplateSchema } from '@/lib/types/sequences';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/sequences/templates/[id]
 * Get a single sequence template with its steps
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const template = await SequenceTemplateService.getById(id, userId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Error fetching sequence template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sequences/templates/[id]
 * Update a sequence template
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = UpdateSequenceTemplateSchema.parse(body);

    const template = await SequenceTemplateService.update(id, validatedData, userId);

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Error updating sequence template:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sequences/templates/[id]
 * Delete (deactivate) a sequence template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await SequenceTemplateService.delete(id, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting sequence template:', error);

    if (error.message.includes('active enrollments')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}