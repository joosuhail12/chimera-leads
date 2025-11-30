import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { queueManager } from '@/lib/queue/apollo-queue';

/**
 * GET /api/queues - Get queue metrics and status
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const queueName = req.nextUrl.searchParams.get('queue');
    const jobId = req.nextUrl.searchParams.get('jobId');

    // Get specific job status
    if (queueName && jobId) {
      const jobStatus = await queueManager.getJobStatus(queueName, jobId);
      return NextResponse.json(jobStatus);
    }

    // Get all queue metrics
    const metrics = await queueManager.getQueueMetrics();

    return NextResponse.json({
      metrics,
      timestamp: new Date().toISOString(),
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        connected: true, // You might want to actually check this
      },
    });
  } catch (error) {
    console.error('Queue metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue metrics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queues - Queue management actions
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, queueName, jobId, data } = body;

    switch (action) {
      case 'enrich': {
        // Add enrichment job
        const jobIds = await Promise.all(
          (Array.isArray(data) ? data : [data]).map((item) =>
            queueManager.addToEnrichmentQueue({
              id: `enrich-${Date.now()}-${Math.random()}`,
              type: item.type || 'both',
              identifier: item.identifier,
              priority: item.priority || 'normal',
              metadata: {
                leadId: item.leadId,
                userId,
                orgId,
              },
            })
          )
        );
        return NextResponse.json({ jobIds, status: 'queued' });
      }

      case 'bulk': {
        // Add bulk job
        const jobIds = await queueManager.addToBulkQueue(
          Array.isArray(data) ? data : [data]
        );
        return NextResponse.json({ jobIds, status: 'queued' });
      }

      case 'score': {
        // Add scoring job
        const jobId = await queueManager.addScoringJob({
          id: `score-${Date.now()}`,
          leadId: data.leadId,
          leadData: data.leadData,
          scoringModel: data.model,
          metadata: {
            userId,
            orgId,
            triggeredBy: 'manual',
          },
        });
        return NextResponse.json({ jobId, status: 'queued' });
      }

      case 'promote': {
        // Promote job to higher priority
        if (!queueName || !jobId) {
          return NextResponse.json(
            { error: 'Queue name and job ID required' },
            { status: 400 }
          );
        }
        await queueManager.promoteJob(queueName, jobId);
        return NextResponse.json({ status: 'promoted' });
      }

      case 'retry-failed': {
        // Retry failed jobs
        const retriedCount = await queueManager.retryFailedJobs(queueName);
        return NextResponse.json({ retriedCount, status: 'retried' });
      }

      case 'clear-failed': {
        // Clear failed jobs
        const clearedCount = await queueManager.clearFailedJobs(queueName);
        return NextResponse.json({ clearedCount, status: 'cleared' });
      }

      case 'pause': {
        // Pause queue
        if (!queueName) {
          return NextResponse.json(
            { error: 'Queue name required' },
            { status: 400 }
          );
        }
        await queueManager.pauseQueue(queueName);
        return NextResponse.json({ status: 'paused' });
      }

      case 'resume': {
        // Resume queue
        if (!queueName) {
          return NextResponse.json(
            { error: 'Queue name required' },
            { status: 400 }
          );
        }
        await queueManager.resumeQueue(queueName);
        return NextResponse.json({ status: 'resumed' });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Queue action error:', error);
    return NextResponse.json(
      { error: 'Failed to process queue action' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/queues - Clean up queues
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const queueName = req.nextUrl.searchParams.get('queue');
    const jobId = req.nextUrl.searchParams.get('jobId');

    if (queueName && jobId) {
      // Delete specific job
      // This would need to be implemented in the QueueManager class
      return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 });
    }

    // Clear all failed jobs
    const clearedCount = await queueManager.clearFailedJobs();
    return NextResponse.json({ clearedCount, status: 'cleared' });
  } catch (error) {
    console.error('Queue cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to clean up queues' },
      { status: 500 }
    );
  }
}