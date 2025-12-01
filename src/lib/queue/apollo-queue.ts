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

export interface SequenceJob {
  id: string;
  type: 'email' | 'task' | 'wait' | 'condition';
  enrollmentId: string;
  stepId: string;
  executionId: string;
  data: {
    emailSubject?: string;
    emailBody?: string;
    taskTitle?: string;
    taskDescription?: string;
    waitDuration?: number;
  };
  metadata: {
    orgId: string;
    userId?: string;
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
  private sequenceQueue: Queue<SequenceJob>;

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

    this.sequenceQueue = new Queue<SequenceJob>(redisConfig.queues.sequences, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
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
   * Add sequence job
   */
  async addSequenceJob(job: SequenceJob): Promise<string> {
    const queuedJob = await this.sequenceQueue.add(
      `sequence-${job.type}-${job.enrollmentId}-${job.stepId}`,
      job,
      {
        priority: 1,
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
      this.getQueueStats(this.sequenceQueue, 'sequences'),
    ]);

    return Object.fromEntries(metrics);
  }

  /**
   * Clear failed jobs
   */
  async clearFailedJobs(queueName?: string): Promise<number> {
    const queues = queueName
      ? [this.getQueueByName(queueName)]
      : [this.enrichmentQueue, this.bulkQueue, this.webhookQueue, this.scoringQueue, this.sequenceQueue];

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
      : [this.enrichmentQueue, this.bulkQueue, this.webhookQueue, this.scoringQueue, this.sequenceQueue];

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
      case 'sequences':
        return this.sequenceQueue;
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
      this.sequenceQueue.close(),
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

  // Sequence Worker
  const sequenceWorker = new Worker<SequenceJob>(
    redisConfig.queues.sequences,
    async (job) => {
      const supabase = await createClient();
      const { enrollmentId, stepId, executionId, type, data } = job.data;

      try {
        // 1. Execute the step
        if (type === 'email') {
          // TODO: Integrate with actual email provider (Gmail/Outlook/SES)
          console.log(`Sending email for enrollment ${enrollmentId}: ${data.emailSubject}`);

          // Simulate sending delay
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Log email event
          await supabase.from('sequence_email_events').insert({
            execution_id: executionId,
            enrollment_id: enrollmentId,
            event_type: 'open', // Mock event for testing
          });
        } else if (type === 'task') {
          // Create CRM task
          await supabase.from('crm_tasks').insert({
            title: data.taskTitle,
            description: data.taskDescription,
            status: 'pending',
            priority: 'medium',
            // Assign to user if possible
          });
        }

        // 2. Update execution status
        await supabase
          .from('sequence_step_executions')
          .update({
            status: 'success',
            executed_at: new Date().toISOString(),
          })
          .eq('id', executionId);

        // 3. Advance enrollment to next step
        // Fetch current step number
        const { data: currentStep } = await supabase
          .from('sequence_steps')
          .select('step_number, template_id')
          .eq('id', stepId)
          .single();

        if (currentStep) {
          // Find next step using branching logic
          let nextStepId: string | null = null;

          try {
            const { data: branchResult, error: branchError } = await supabase.rpc('select_next_branch', {
              p_enrollment_id: enrollmentId,
              p_current_step_id: stepId
            });

            if (!branchError) {
              nextStepId = branchResult;
            } else {
              // Fallback to linear next step if RPC fails or not found
              console.warn('Branching RPC failed, falling back to linear:', branchError);
            }
          } catch (e) {
            console.warn('Branching RPC error:', e);
          }

          // If branching didn't return a step (or failed), try linear fallback if no branch logic exists
          // But if branching returned NULL explicitly (and no error), it means end of path.
          // So only fallback if we didn't even try/succeed in calling the RPC.

          let nextStep = null;

          if (nextStepId) {
            const { data: step } = await supabase
              .from('sequence_steps')
              .select('*')
              .eq('id', nextStepId)
              .single();
            nextStep = step;
          } else if (!nextStepId) {
            // Fallback: Check if there are any steps with higher step_number (legacy support)
            // Only if we suspect the RPC wasn't used correctly or for old sequences
            const { data: linearStep } = await supabase
              .from('sequence_steps')
              .select('*')
              .eq('template_id', currentStep.template_id)
              .gt('step_number', currentStep.step_number)
              .order('step_number', { ascending: true })
              .limit(1)
              .single();
            nextStep = linearStep;
          }

          if (nextStep) {
            // Schedule next step
            // Calculate delay
            const delayMs = (nextStep.wait_days * 24 * 60 * 60 * 1000) + (nextStep.wait_hours * 60 * 60 * 1000);
            const nextScheduledAt = new Date(Date.now() + delayMs);

            await supabase
              .from('sequence_enrollments')
              .update({
                current_step: nextStep.step_number,
                next_step_scheduled_at: nextScheduledAt.toISOString(),
                last_step_executed_at: new Date().toISOString(),
              })
              .eq('id', enrollmentId);

            // Create pending execution for next step
            const { data: nextExecution } = await supabase
              .from('sequence_step_executions')
              .insert({
                enrollment_id: enrollmentId,
                step_id: nextStep.id,
                status: 'pending',
              })
              .select()
              .single();

            // Queue next job
            if (nextExecution) {
              await queueManager.addSequenceJob({
                id: nextExecution.id,
                type: nextStep.step_type as any,
                enrollmentId,
                stepId: nextStep.id,
                executionId: nextExecution.id,
                data: {
                  emailSubject: nextStep.email_subject,
                  emailBody: nextStep.email_body,
                  taskTitle: nextStep.task_title,
                  taskDescription: nextStep.task_description,
                },
                metadata: job.data.metadata
              });
            }

          } else {
            // Sequence completed
            await supabase
              .from('sequence_enrollments')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                last_step_executed_at: new Date().toISOString(),
                next_step_scheduled_at: null,
              })
              .eq('id', enrollmentId);
          }
        }

        return { success: true };
      } catch (error) {
        console.error(`Sequence step failed:`, error);

        // Update execution status to failed
        await supabase
          .from('sequence_step_executions')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', executionId);

        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  // Add error handlers
  [enrichmentWorker, webhookWorker, scoringWorker, sequenceWorker].forEach((worker) => {
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
    sequenceWorker,
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

export const sequenceQueue = new Queue<SequenceJob>(redisConfig.queues.sequences, {
  connection: queueConnection,
});
