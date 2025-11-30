import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient, redisConfig } from '@/lib/redis/client';
import { ApolloService } from '@/lib/services/apollo';
import { createClient } from '@/lib/supabase/server';
import { AILeadScoringService } from '@/lib/services/lead-scoring';

export interface EnrichmentJob {
  id: string;
  type: 'person' | 'company' | 'both';
  identifier: string; // email or domain
  priority: 'high' | 'normal' | 'low';
  metadata: {
    leadId?: string;
    playbookId?: string;
    userId: string;
    orgId: string;
  };
}

export interface BulkJob {
  id: string;
  operation: 'import' | 'enrich' | 'score';
  data: any[];
  options: {
    batchSize?: number;
    updateExisting?: boolean;
    skipDuplicates?: boolean;
  };
  metadata: {
    userId: string;
    orgId: string;
    source?: string;
  };
}

export interface WebhookJob {
  id: string;
  webhookId: string;
  eventType: string;
  eventData: any;
  orgId: string;
}

export interface ScoringJob {
  id: string;
  leadId: string;
  leadData: any;
  scoringModel?: string;
  metadata: {
    userId: string;
    orgId: string;
    triggeredBy?: string;
  };
}

/**
 * Queue Manager for Apollo operations
 */
export class QueueManager {
  private enrichmentQueue: Queue<EnrichmentJob>;
  private bulkQueue: Queue<BulkJob>;
  private webhookQueue: Queue<WebhookJob>;
  private scoringQueue: Queue<ScoringJob>;

  constructor() {
    const connection = {
      host: redisConfig.connection.host,
      port: redisConfig.connection.port,
      password: redisConfig.connection.password,
      db: redisConfig.connection.db,
    };

    // Initialize queues
    this.enrichmentQueue = new Queue<EnrichmentJob>(redisConfig.queues.enrichment, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.bulkQueue = new Queue<BulkJob>(redisConfig.queues.bulk, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    });

    this.webhookQueue = new Queue<WebhookJob>(redisConfig.queues.webhooks, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 100 },
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    this.scoringQueue = new Queue<ScoringJob>(redisConfig.queues.scoring, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    });
  }

  /**
   * Add job to enrichment queue
   */
  async addToEnrichmentQueue(job: EnrichmentJob): Promise<string> {
    const priority = this.getPriorityValue(job.priority);
    const queuedJob = await this.enrichmentQueue.add(
      `enrich-${job.type}-${job.identifier}`,
      job,
      {
        priority,
        delay: priority === 1 ? 0 : 1000, // Delay lower priority jobs
      }
    );
    return queuedJob.id || '';
  }

  /**
   * Add jobs to bulk queue
   */
  async addToBulkQueue(jobs: BulkJob[]): Promise<string[]> {
    const bulkJobs = jobs.map((job) => ({
      name: `bulk-${job.operation}-${job.id}`,
      data: job,
      opts: {
        priority: 2, // Normal priority for bulk ops
      },
    }));

    const queuedJobs = await this.bulkQueue.addBulk(bulkJobs);
    return queuedJobs.map((j) => j.id || '');
  }

  /**
   * Add webhook job
   */
  async addWebhookJob(job: WebhookJob): Promise<string> {
    const queuedJob = await this.webhookQueue.add(
      `webhook-${job.eventType}-${job.webhookId}`,
      job,
      {
        priority: 1, // High priority for webhooks
      }
    );
    return queuedJob.id || '';
  }

  /**
   * Add scoring job
   */
  async addScoringJob(job: ScoringJob): Promise<string> {
    const queuedJob = await this.scoringQueue.add(
      `score-${job.leadId}`,
      job,
      {
        priority: 2,
      }
    );
    return queuedJob.id || '';
  }

  /**
   * Promote job to higher priority
   */
  async promoteJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (job) {
      await job.promote();
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: string, jobId: string): Promise<any> {
    const queue = this.getQueueByName(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      attempts: job.attemptsMade,
      state: await job.getState(),
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(): Promise<any> {
    const metrics = await Promise.all([
      this.getQueueStats(this.enrichmentQueue, 'enrichment'),
      this.getQueueStats(this.bulkQueue, 'bulk'),
      this.getQueueStats(this.webhookQueue, 'webhooks'),
      this.getQueueStats(this.scoringQueue, 'scoring'),
    ]);

    return Object.fromEntries(metrics);
  }

  /**
   * Clear failed jobs
   */
  async clearFailedJobs(queueName?: string): Promise<number> {
    const queues = queueName
      ? [this.getQueueByName(queueName)]
      : [this.enrichmentQueue, this.bulkQueue, this.webhookQueue, this.scoringQueue];

    let totalCleared = 0;
    for (const queue of queues) {
      if (queue) {
        const failed = await queue.getFailed();
        await Promise.all(failed.map((job) => job.remove()));
        totalCleared += failed.length;
      }
    }

    return totalCleared;
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(queueName?: string): Promise<number> {
    const queues = queueName
      ? [this.getQueueByName(queueName)]
      : [this.enrichmentQueue, this.bulkQueue, this.webhookQueue, this.scoringQueue];

    let retried = 0;
    for (const queue of queues) {
      if (!queue) continue;
      const failed = await queue.getFailed();
      for (const job of failed) {
        await job.retry();
        retried++;
      }
    }

    return retried;
  }

  /**
   * Pause queue processing
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.pause();
    }
  }

  /**
   * Resume queue processing
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.resume();
    }
  }

  /**
   * Helper: Get queue by name
   */
  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case 'enrichment':
        return this.enrichmentQueue;
      case 'bulk':
        return this.bulkQueue;
      case 'webhooks':
        return this.webhookQueue;
      case 'scoring':
        return this.scoringQueue;
      default:
        return null;
    }
  }

  /**
   * Helper: Get priority value
   */
  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'normal':
        return 2;
      case 'low':
        return 3;
      default:
        return 2;
    }
  }

  /**
   * Helper: Get queue statistics
   */
  private async getQueueStats(queue: Queue, name: string): Promise<[string, any]> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return [
      name,
      {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        total: waiting + active + delayed,
      },
    ];
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await Promise.all([
      this.enrichmentQueue.close(),
      this.bulkQueue.close(),
      this.webhookQueue.close(),
      this.scoringQueue.close(),
    ]);
  }
}

/**
 * Initialize queue workers
 */
export function initializeQueueWorkers() {
  const connection = {
    host: redisConfig.connection.host,
    port: redisConfig.connection.port,
    password: redisConfig.connection.password,
    db: redisConfig.connection.db,
  };

  // Enrichment Worker
  const enrichmentWorker = new Worker<EnrichmentJob>(
    redisConfig.queues.enrichment,
    async (job) => {
      const apolloService = new ApolloService();
      const supabase = await createClient();
      const { type, identifier, metadata } = job.data;

      try {
        let result;
        if (type === 'person') {
          result = await apolloService.enrichPerson(identifier);
        } else if (type === 'company') {
          result = await apolloService.enrichCompany(identifier);
        } else {
          // Both
          const [person, company] = await Promise.all([
            apolloService.enrichPerson(identifier),
            apolloService.enrichCompany(identifier.split('@')[1] || identifier),
          ]);
          result = { person, company };
        }

        // Update lead if leadId provided
        if (metadata.leadId && result) {
          await supabase
            .from('sales_leads')
            .update({
              apollo_data: type === 'person' ? result : undefined,
              company_apollo_data: type === 'company' ? result : undefined,
              enriched_at: type === 'person' ? new Date().toISOString() : undefined,
              company_enriched_at: type === 'company' ? new Date().toISOString() : undefined,
            })
            .eq('id', metadata.leadId)
            .eq('organization_id', metadata.orgId);
        }

        // Update enrichment queue status
        await supabase
          .from('lead_enrichment_queue')
          .update({
            status: 'completed',
            result,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.data.id);

        return result;
      } catch (error) {
        // Update enrichment queue with error
        await supabase
          .from('lead_enrichment_queue')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            attempts: job.attemptsMade + 1,
          })
          .eq('id', job.data.id);

        throw error;
      }
    },
    {
      connection,
      concurrency: 5, // Process 5 enrichments in parallel
    }
  );

  // Webhook Worker
  const webhookWorker = new Worker<WebhookJob>(
    redisConfig.queues.webhooks,
    async (job) => {
      const supabase = await createClient();
      const { webhookId, eventType, eventData, orgId } = job.data;

      try {
        // Process webhook based on event type
        switch (eventType) {
          case 'person.updated':
            // Update lead with new Apollo data
            await supabase
              .from('sales_leads')
              .update({
                apollo_data: eventData,
                enriched_at: new Date().toISOString(),
              })
              .eq('apollo_id', eventData.id)
              .eq('organization_id', orgId);
            break;

          case 'company.updated':
            // Update company data
            await supabase
              .from('sales_leads')
              .update({
                company_apollo_data: eventData,
                company_enriched_at: new Date().toISOString(),
              })
              .eq('apollo_company_id', eventData.id)
              .eq('organization_id', orgId);
            break;

          case 'list.members_added':
            // Sync new list members
            // Implementation depends on your list sync strategy
            break;

          default:
            console.log(`Unhandled webhook event type: ${eventType}`);
        }

        // Mark webhook as processed
        await supabase
          .from('apollo_webhooks')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('webhook_id', webhookId);

        return { success: true };
      } catch (error) {
        // Update webhook with error
        await supabase
          .from('apollo_webhooks')
          .update({
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_count: job.attemptsMade + 1,
          })
          .eq('webhook_id', webhookId);

        throw error;
      }
    },
    {
      connection,
      concurrency: 10, // Process 10 webhooks in parallel
    }
  );

  // Scoring Worker
  const scoringWorker = new Worker<ScoringJob>(
    redisConfig.queues.scoring,
    async (job) => {
      const scoringService = new AILeadScoringService();
      const supabase = await createClient();
      const { leadId, leadData, metadata } = job.data;

      try {
        // Calculate AI-powered score
        const scoreResult = await scoringService.calculateScore(leadData);

        // Save score to database
        await supabase
          .from('lead_scores')
          .upsert({
            lead_id: leadId,
            organization_id: metadata.orgId,
            score: scoreResult.score,
            confidence: scoreResult.confidence,
            factors: scoreResult.factors,
            ai_insights: scoreResult.aiInsights,
            recommendations: scoreResult.recommendations,
            score_breakdown: scoreResult.scoreBreakdown,
            updated_at: new Date().toISOString(),
          });

        return scoreResult;
      } catch (error) {
        console.error(`Scoring failed for lead ${leadId}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 3, // Limit AI API calls
    }
  );

  // Add error handlers
  [enrichmentWorker, webhookWorker, scoringWorker].forEach((worker) => {
    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  });

  return {
    enrichmentWorker,
    webhookWorker,
    scoringWorker,
  };
}

// Export singleton instance
export const queueManager = new QueueManager();

// Export direct queue instances for use in health checks and other modules
const queueConnection = {
  host: redisConfig.connection.host,
  port: redisConfig.connection.port,
  password: redisConfig.connection.password,
  db: redisConfig.connection.db,
};

export const enrichmentQueue = new Queue<EnrichmentJob>(redisConfig.queues.enrichment, {
  connection: queueConnection,
});

export const bulkQueue = new Queue<BulkJob>(redisConfig.queues.bulk, {
  connection: queueConnection,
});

export const webhookQueue = new Queue<WebhookJob>(redisConfig.queues.webhooks, {
  connection: queueConnection,
});

export const scoringQueue = new Queue<ScoringJob>(redisConfig.queues.scoring, {
  connection: queueConnection,
});
