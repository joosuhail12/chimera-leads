#!/usr/bin/env node

/**
 * BullMQ Worker Process for Apollo Queue Processing
 *
 * This worker runs separately from the Next.js application and processes
 * jobs from the Redis queues. It can be scaled horizontally by running
 * multiple instances.
 *
 * Usage:
 *   npm run worker
 *   npm run worker:dev (with hot reload)
 *   npm run worker:production
 */

import 'dotenv/config';
import { Worker, Job, QueueEvents } from 'bullmq';
import { redisConfig } from '../lib/redis/client';
import { ApolloService } from '../lib/services/apollo';
import { createClient } from '../lib/supabase/server';
import { AILeadScoringService } from '../lib/services/lead-scoring';
import type {
  EnrichmentJob,
  BulkJob,
  WebhookJob,
  ScoringJob,
} from '../lib/queue/apollo-queue';

// Worker configuration
const WORKER_CONFIG = {
  concurrency: {
    enrichment: parseInt(process.env.WORKER_ENRICHMENT_CONCURRENCY || '5'),
    bulk: parseInt(process.env.WORKER_BULK_CONCURRENCY || '2'),
    webhook: parseInt(process.env.WORKER_WEBHOOK_CONCURRENCY || '10'),
    scoring: parseInt(process.env.WORKER_SCORING_CONCURRENCY || '3'),
  },
  connection: {
    host: redisConfig.connection.host,
    port: redisConfig.connection.port,
    password: redisConfig.connection.password,
    db: redisConfig.connection.db,
  },
};

// Track worker metrics
const metrics = {
  processed: 0,
  failed: 0,
  startTime: Date.now(),
};

/**
 * Enrichment Worker - Processes Apollo enrichment requests
 */
const enrichmentWorker = new Worker<EnrichmentJob>(
  redisConfig.queues.enrichment,
  async (job: Job<EnrichmentJob>) => {
    console.log(`[Enrichment] Processing job ${job.id}`);

    const apolloService = new ApolloService(
      process.env.APOLLO_API_KEY,
      job.data.metadata.orgId
    );

    const supabase = await createClient();
    const { type, identifier, metadata } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      let result;
      if (type === 'person') {
        result = await apolloService.enrichPerson(identifier);
        await job.updateProgress(50);
      } else if (type === 'company') {
        result = await apolloService.enrichCompany(identifier);
        await job.updateProgress(50);
      } else {
        // Enrich both person and company
        const email = identifier;
        const domain = email.split('@')[1];

        const [person, company] = await Promise.all([
          apolloService.enrichPerson(email),
          domain ? apolloService.enrichCompany(domain) : null,
        ]);

        result = { person, company };
        await job.updateProgress(50);
      }

      // Update database if leadId provided
      if (metadata.leadId && result) {
        await job.updateProgress(70);

        const updateData: any = {};

        if (type === 'person' || type === 'both') {
          updateData.apollo_data = result.person || result;
          updateData.enriched_at = new Date().toISOString();
        }

        if (type === 'company' || type === 'both') {
          updateData.company_apollo_data = result.company || result;
          updateData.company_enriched_at = new Date().toISOString();
        }

        await supabase
          .from('sales_leads')
          .update(updateData)
          .eq('id', metadata.leadId)
          .eq('organization_id', metadata.orgId);
      }

      // Update enrichment queue status
      await job.updateProgress(90);

      await supabase
        .from('lead_enrichment_queue')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.data.id);

      await job.updateProgress(100);
      metrics.processed++;

      console.log(`[Enrichment] Completed job ${job.id}`);
      return result;

    } catch (error) {
      metrics.failed++;
      console.error(`[Enrichment] Failed job ${job.id}:`, error);

      // Update queue with error
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
    connection: WORKER_CONFIG.connection,
    concurrency: WORKER_CONFIG.concurrency.enrichment,
    autorun: true,
  }
);

/**
 * Bulk Operations Worker
 */
const bulkWorker = new Worker<BulkJob>(
  redisConfig.queues.bulk,
  async (job: Job<BulkJob>) => {
    console.log(`[Bulk] Processing job ${job.id}: ${job.data.operation}`);

    const { operation, data, options, metadata } = job.data;
    const apolloService = new ApolloService(
      process.env.APOLLO_API_KEY,
      metadata.orgId
    );
    const supabase = await createClient();

    try {
      let processedCount = 0;
      const totalItems = data.length;

      for (let i = 0; i < totalItems; i++) {
        const item = data[i];

        // Update progress
        await job.updateProgress(Math.floor((i / totalItems) * 100));

        switch (operation) {
          case 'import':
            // Import from Apollo to database
            if (item.email) {
              const person = await apolloService.enrichPerson(item.email);
              if (person) {
                await apolloService.importPersonToLeads(person, metadata.orgId);
                processedCount++;
              }
            }
            break;

          case 'enrich':
            // Bulk enrichment
            const enriched = await apolloService.enrichPerson(item.email);
            if (enriched && item.leadId) {
              await supabase
                .from('sales_leads')
                .update({
                  apollo_data: enriched,
                  enriched_at: new Date().toISOString(),
                })
                .eq('id', item.leadId)
                .eq('organization_id', metadata.orgId);
              processedCount++;
            }
            break;

          case 'score':
            // Bulk scoring will be handled by scoring worker
            break;
        }
      }

      metrics.processed++;
      console.log(`[Bulk] Completed job ${job.id}: ${processedCount}/${totalItems} processed`);

      return {
        operation,
        totalItems,
        processedCount,
        success: true,
      };

    } catch (error) {
      metrics.failed++;
      console.error(`[Bulk] Failed job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection: WORKER_CONFIG.connection,
    concurrency: WORKER_CONFIG.concurrency.bulk,
    autorun: true,
  }
);

/**
 * Webhook Worker - Processes Apollo webhooks
 */
const webhookWorker = new Worker<WebhookJob>(
  redisConfig.queues.webhooks,
  async (job: Job<WebhookJob>) => {
    console.log(`[Webhook] Processing ${job.data.eventType} - ${job.id}`);

    const supabase = await createClient();
    const { webhookId, eventType, eventData, orgId } = job.data;

    try {
      // Process webhook based on event type
      switch (eventType) {
        case 'person.created':
        case 'person.updated':
          // Update or create lead with Apollo data
          if (eventData.email) {
            const { data: existingLead } = await supabase
              .from('sales_leads')
              .select('id')
              .eq('email', eventData.email)
              .eq('organization_id', orgId)
              .single();

            if (existingLead) {
              await supabase
                .from('sales_leads')
                .update({
                  apollo_id: eventData.id,
                  apollo_data: eventData,
                  enriched_at: new Date().toISOString(),
                })
                .eq('id', existingLead.id);
            } else {
              // Create new lead from webhook
              await supabase
                .from('sales_leads')
                .insert({
                  organization_id: orgId,
                  name: eventData.name || `${eventData.first_name} ${eventData.last_name}`,
                  email: eventData.email,
                  company: eventData.organization?.name,
                  apollo_id: eventData.id,
                  apollo_data: eventData,
                  enriched_at: new Date().toISOString(),
                  source: 'apollo_webhook',
                });
            }
          }
          break;

        case 'company.created':
        case 'company.updated':
          // Update company data for all leads
          if (eventData.domain) {
            await supabase
              .from('sales_leads')
              .update({
                company_apollo_data: eventData,
                company_enriched_at: new Date().toISOString(),
              })
              .ilike('email', `%@${eventData.domain}`)
              .eq('organization_id', orgId);
          }
          break;

        case 'list.members_added':
          // Process new list members
          console.log(`List members added: ${eventData.count} new members`);
          // Implementation depends on your list sync strategy
          break;

        default:
          console.log(`Unhandled webhook event: ${eventType}`);
      }

      // Mark webhook as processed
      await supabase
        .from('apollo_webhooks')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('webhook_id', webhookId);

      metrics.processed++;
      console.log(`[Webhook] Completed ${eventType} - ${job.id}`);

      return { success: true, eventType };

    } catch (error) {
      metrics.failed++;
      console.error(`[Webhook] Failed ${eventType} - ${job.id}:`, error);

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
    connection: WORKER_CONFIG.connection,
    concurrency: WORKER_CONFIG.concurrency.webhook,
    autorun: true,
  }
);

/**
 * AI Scoring Worker
 */
const scoringWorker = new Worker<ScoringJob>(
  redisConfig.queues.scoring,
  async (job: Job<ScoringJob>) => {
    console.log(`[Scoring] Processing lead ${job.data.leadId}`);

    const scoringService = new AILeadScoringService();
    const supabase = await createClient();
    const { leadId, leadData, metadata } = job.data;

    try {
      // Calculate AI-powered score
      await job.updateProgress(20);
      const scoreResult = await scoringService.calculateScore(leadData);

      await job.updateProgress(70);

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

      await job.updateProgress(100);
      metrics.processed++;

      console.log(`[Scoring] Completed lead ${leadId}: Score ${scoreResult.score}`);
      return scoreResult;

    } catch (error) {
      metrics.failed++;
      console.error(`[Scoring] Failed lead ${leadId}:`, error);
      throw error;
    }
  },
  {
    connection: WORKER_CONFIG.connection,
    concurrency: WORKER_CONFIG.concurrency.scoring,
    autorun: true,
  }
);

/**
 * Worker Event Handlers
 */
const workers = [enrichmentWorker, bulkWorker, webhookWorker, scoringWorker];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️ Job ${jobId} stalled`);
  });
});

/**
 * Queue Event Monitoring
 */
const queueEvents = new QueueEvents(redisConfig.queues.enrichment, {
  connection: WORKER_CONFIG.connection,
});

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`📋 Job ${jobId} waiting`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress: ${data}%`);
});

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
});

/**
 * Health Check & Metrics
 */
setInterval(() => {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const rate = metrics.processed / (uptime / 60);

  console.log(`
📈 Worker Metrics:
  Uptime: ${uptime}s
  Processed: ${metrics.processed}
  Failed: ${metrics.failed}
  Rate: ${rate.toFixed(2)} jobs/min
  `);
}, 60000); // Every minute

// Startup message
console.log(`
🚀 Apollo Queue Worker Started
   Redis: ${WORKER_CONFIG.connection.host}:${WORKER_CONFIG.connection.port}
   Concurrency:
     - Enrichment: ${WORKER_CONFIG.concurrency.enrichment}
     - Bulk: ${WORKER_CONFIG.concurrency.bulk}
     - Webhook: ${WORKER_CONFIG.concurrency.webhook}
     - Scoring: ${WORKER_CONFIG.concurrency.scoring}
`);