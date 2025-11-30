import { ApolloService } from '@/lib/services/apollo';
import { AILeadScoringService } from '@/lib/services/lead-scoring';
import { createClient } from '@/lib/supabase/server';
import { enrichmentQueue, bulkQueue, webhookQueue, scoringQueue } from './apollo-queue';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/redis/client';

/**
 * Worker Manager for Apollo Queue System
 * Manages the lifecycle of all queue workers
 */
export class WorkerManager {
  private workers: Worker[] = [];
  private isShuttingDown = false;
  private apolloService: ApolloService;
  private scoringService: AILeadScoringService;

  constructor(organizationId?: string) {
    this.apolloService = new ApolloService(undefined, organizationId);
    this.scoringService = new AILeadScoringService();
  }

  /**
   * Initialize all queue workers
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Apollo queue workers...');

    // Enrichment Worker
    const enrichmentWorker = new Worker(
      'apollo:enrichment',
      async (job: Job) => {
        console.log(`Processing enrichment job ${job.id}`);
        const { type, identifier, metadata } = job.data;

        try {
          let result;
          if (type === 'person') {
            result = await this.apolloService.enrichPerson(identifier);
          } else if (type === 'company') {
            result = await this.apolloService.enrichCompany(identifier);
          }

          if (result && metadata?.leadId) {
            // Update lead in database
            const supabase = await createClient();
            await supabase
              .from('leads')
              .update({
                apollo_data: result,
                enriched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', metadata.leadId);

            // Trigger scoring
            await scoringQueue.add('score-lead', {
              leadId: metadata.leadId,
              data: result,
            });
          }

          return result;
        } catch (error) {
          console.error('Enrichment error:', error);
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000, // 10 jobs per second
        },
      }
    );

    // Bulk Processing Worker
    const bulkWorker = new Worker(
      'apollo:bulk',
      async (job: Job) => {
        console.log(`Processing bulk job ${job.id}`);
        const { operation, items, options } = job.data;

        const results = [];
        const errors = [];

        for (const item of items) {
          try {
            let result;
            if (operation === 'enrich_people') {
              result = await this.apolloService.enrichPerson(
                item.email,
                options?.useCache ?? true
              );
            } else if (operation === 'enrich_companies') {
              result = await this.apolloService.enrichCompany(
                item.domain,
                options?.useCache ?? true
              );
            } else if (operation === 'import_list') {
              // Import list members
              result = await this.apolloService.getListMembers(item.listId);
            }

            results.push({ item, result, success: true });

            // Update progress
            await job.updateProgress((results.length / items.length) * 100);

            // Small delay to respect rate limits
            await this.sleep(100);
          } catch (error) {
            errors.push({ item, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }

        return { results, errors, total: items.length };
      },
      {
        connection: redisConnection,
        concurrency: 2,
        limiter: {
          max: 5,
          duration: 1000, // 5 jobs per second
        },
      }
    );

    // Webhook Processing Worker
    const webhookWorker = new Worker(
      'apollo:webhooks',
      async (job: Job) => {
        console.log(`Processing webhook ${job.id}`);
        const { event, data } = job.data;

        try {
          const supabase = await createClient();

          // Store webhook event
          await supabase.from('apollo_webhook_events').insert({
            event_type: event,
            payload: data,
            processed_at: new Date().toISOString(),
          });

          // Process based on event type
          switch (event) {
            case 'person.updated':
              if (data.email) {
                // Re-enrich the person
                await enrichmentQueue.add('enrich', {
                  type: 'person',
                  identifier: data.email,
                  priority: 'high',
                });
              }
              break;

            case 'company.updated':
              if (data.domain) {
                // Re-enrich the company
                await enrichmentQueue.add('enrich', {
                  type: 'company',
                  identifier: data.domain,
                  priority: 'high',
                });
              }
              break;

            case 'list.member_added':
              // Sync list members
              if (data.list_id) {
                await bulkQueue.add('sync-list', {
                  operation: 'import_list',
                  items: [{ listId: data.list_id }],
                });
              }
              break;

            default:
              console.log(`Unhandled webhook event: ${event}`);
          }

          return { processed: true, event };
        } catch (error) {
          console.error('Webhook processing error:', error);
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 10,
      }
    );

    // Lead Scoring Worker
    const scoringWorker = new Worker(
      'apollo:scoring',
      async (job: Job) => {
        console.log(`Processing scoring job ${job.id}`);
        const { leadId, data, options } = job.data;

        try {
          const score = await this.scoringService.calculateScore(data);

          // Store score in database
          const supabase = await createClient();
          await supabase.from('lead_scores').upsert({
            lead_id: leadId,
            score: score.score,
            confidence: score.confidence,
            factors: score.factors,
            ai_insights: score.aiInsights,
            recommendations: score.recommendations,
            calculated_at: new Date().toISOString(),
          });

          // Update lead with latest score
          await supabase
            .from('leads')
            .update({
              score: score.score,
              score_category: this.getScoreCategory(score.score),
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadId);

          // Trigger sequence enrollment if score is high
          if (options?.autoEnroll && score.score >= 80) {
            // Add to high-value sequence
            console.log(`Auto-enrolling high-score lead ${leadId} (score: ${score.score})`);
          }

          return score;
        } catch (error) {
          console.error('Scoring error:', error);
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 3,
      }
    );

    // Store worker references
    this.workers = [
      enrichmentWorker,
      bulkWorker,
      webhookWorker,
      scoringWorker,
    ];

    // Set up error handlers
    this.workers.forEach(worker => {
      worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} in ${worker.name} failed:`, err);
        this.handleFailedJob(job, err);
      });

      worker.on('error', err => {
        console.error(`Worker ${worker.name} error:`, err);
      });

      worker.on('ready', () => {
        console.log(`✅ Worker ${worker.name} is ready`);
      });
    });

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    console.log('✅ All Apollo queue workers initialized');
  }

  /**
   * Handle failed jobs
   */
  private async handleFailedJob(job: Job | undefined, error: Error): Promise<void> {
    if (!job) return;

    const supabase = await createClient();

    // Log failure to database
    await supabase.from('apollo_job_failures').insert({
      queue_name: job.queueName,
      job_id: job.id,
      job_data: job.data,
      error_message: error.message,
      error_stack: error.stack,
      attempt_number: job.attemptsMade,
      failed_at: new Date().toISOString(),
    });

    // Send notification if critical job
    if (job.data.priority === 'high' || job.attemptsMade >= 3) {
      console.error(`CRITICAL: Job ${job.id} failed after ${job.attemptsMade} attempts`);
      // Here you could send alerts via email, Slack, etc.
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`\n${signal} received. Starting graceful shutdown...`);

      // Close all workers
      await Promise.all(
        this.workers.map(async worker => {
          console.log(`Closing worker ${worker.name}...`);
          await worker.close();
          console.log(`Worker ${worker.name} closed`);
        })
      );

      console.log('All workers closed. Exiting...');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};

    for (const worker of this.workers) {
      const queue = worker.opts.connection ?
        await this.getQueueByName(worker.name) : null;

      if (queue) {
        const counts = await queue.getJobCounts();
        metrics[worker.name] = {
          ...counts,
          isPaused: await queue.isPaused(),
          isRunning: worker.isRunning(),
        };
      }
    }

    return metrics;
  }

  /**
   * Pause all workers
   */
  async pauseAll(): Promise<void> {
    await Promise.all(this.workers.map(w => w.pause()));
    console.log('All workers paused');
  }

  /**
   * Resume all workers
   */
  async resumeAll(): Promise<void> {
    await Promise.all(this.workers.map(w => w.resume()));
    console.log('All workers resumed');
  }

  /**
   * Helper: Get queue by name
   */
  private async getQueueByName(name: string): Promise<any> {
    switch (name) {
      case 'apollo:enrichment':
        return enrichmentQueue;
      case 'apollo:bulk':
        return bulkQueue;
      case 'apollo:webhooks':
        return webhookQueue;
      case 'apollo:scoring':
        return scoringQueue;
      default:
        return null;
    }
  }

  /**
   * Helper: Get score category
   */
  private getScoreCategory(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= 80) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  }

  /**
   * Helper: Sleep for milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let workerManager: WorkerManager | null = null;

/**
 * Get or create worker manager instance
 */
export function getWorkerManager(organizationId?: string): WorkerManager {
  if (!workerManager) {
    workerManager = new WorkerManager(organizationId);
  }
  return workerManager;
}

/**
 * Initialize workers (call this on app startup)
 */
export async function initializeWorkers(organizationId?: string): Promise<WorkerManager> {
  const manager = getWorkerManager(organizationId);
  await manager.initialize();
  return manager;
}