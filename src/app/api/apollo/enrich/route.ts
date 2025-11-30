import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ApolloService } from '@/lib/services/apollo';
import { createClient } from '@/lib/supabase/server';
import { queueManager } from '@/lib/queue/apollo-queue';
import { z } from 'zod';

// Validation schemas
const singleEnrichSchema = z.object({
  type: z.enum(['person', 'company']),
  identifier: z.string().min(1), // email for person, domain for company
  leadId: z.string().uuid().optional(),
  useCache: z.boolean().default(true),
});

const bulkEnrichSchema = z.object({
  type: z.literal('bulk'),
  contacts: z.array(z.object({
    email: z.string().email().optional(),
    domain: z.string().optional(),
    leadId: z.string().uuid().optional(),
  })).min(1).max(100),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const apolloService = new ApolloService(undefined, orgId);
    const supabase = await createClient();

    // Handle bulk enrichment
    if (body.type === 'bulk') {
      const params = bulkEnrichSchema.parse(body);

      // Queue bulk enrichment jobs
      const jobIds = await apolloService.bulkEnrich(params.contacts, params.priority);

      // Track bulk operation in database
      await supabase.from('apollo_sync_state').insert({
        organization_id: orgId,
        sync_type: 'bulk_enrichment',
        sync_status: 'syncing',
        sync_metadata: {
          job_ids: jobIds,
          total_contacts: params.contacts.length,
          priority: params.priority,
        },
      });

      return NextResponse.json({
        success: true,
        type: 'bulk',
        jobIds,
        message: `${params.contacts.length} contacts queued for enrichment`,
      });
    }

    // Handle single enrichment
    const params = singleEnrichSchema.parse(body);
    let enrichedData = null;

    if (params.type === 'person') {
      enrichedData = await apolloService.enrichPerson(params.identifier, params.useCache);

      // Update lead if leadId provided
      if (enrichedData && params.leadId) {
        await supabase
          .from('sales_leads')
          .update({
            apollo_id: enrichedData.id,
            apollo_data: enrichedData,
            linkedin_url: enrichedData.linkedin_url,
            twitter_url: enrichedData.twitter_url,
            facebook_url: enrichedData.facebook_url,
            github_url: enrichedData.github_url,
            enriched_at: new Date().toISOString(),
          })
          .eq('id', params.leadId)
          .eq('organization_id', orgId);

        // Queue for AI scoring
        await queueManager.addScoringJob({
          id: `score-${params.leadId}`,
          leadId: params.leadId,
          leadData: enrichedData,
          metadata: {
            userId,
            orgId,
            triggeredBy: 'enrichment',
          },
        });
      }
    } else {
      enrichedData = await apolloService.enrichCompany(params.identifier, params.useCache);

      // Update leads with this company domain if data found
      if (enrichedData && params.leadId) {
        await supabase
          .from('sales_leads')
          .update({
            apollo_company_id: enrichedData.id,
            company_apollo_data: enrichedData,
            technographics: enrichedData.technologies,
            company_enriched_at: new Date().toISOString(),
          })
          .eq('id', params.leadId)
          .eq('organization_id', orgId);
      }
    }

    if (!enrichedData) {
      return NextResponse.json(
        { error: 'No data found for the provided identifier' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      type: params.type,
      data: enrichedData,
    });
  } catch (error) {
    console.error('Apollo enrichment error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }

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

// GET endpoint to check enrichment job status
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    const queueName = searchParams.get('queue') || 'enrichment';

    if (!jobId) {
      // Return queue metrics if no specific job requested
      const metrics = await queueManager.getQueueMetrics();
      return NextResponse.json({
        success: true,
        metrics,
      });
    }

    // Get specific job status
    const status = await queueManager.getJobStatus(queueName, jobId);

    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: status,
    });
  } catch (error) {
    console.error('Job status error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve job status' },
      { status: 500 }
    );
  }
}