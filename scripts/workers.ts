#!/usr/bin/env tsx

/**
 * Apollo Queue Workers Management Script
 *
 * Usage:
 *   npm run workers:start    - Start all workers
 *   npm run workers:stop     - Stop all workers
 *   npm run workers:status   - Check worker status
 *   npm run workers:metrics  - Get queue metrics
 *   npm run workers:clear    - Clear all queues (dangerous!)
 */

import { Command } from 'commander';
import { initializeWorkers, getWorkerManager } from '@/lib/queue/worker-manager';
import { enrichmentQueue, bulkQueue, webhookQueue, scoringQueue } from '@/lib/queue/apollo-queue';
import { redisConnection } from '@/lib/redis/client';
import { Table } from 'console-table-printer';
import chalk from 'chalk';

const program = new Command();

program
  .name('workers')
  .description('Manage Apollo queue workers')
  .version('1.0.0');

// Start command
program
  .command('start')
  .description('Start all queue workers')
  .option('-o, --org <orgId>', 'Organization ID')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting Apollo queue workers...'));

    try {
      const manager = await initializeWorkers(options.org);
      console.log(chalk.green('✅ All workers started successfully'));

      // Keep process alive
      console.log(chalk.gray('\nPress Ctrl+C to stop workers...'));
      process.stdin.resume();
    } catch (error) {
      console.error(chalk.red('❌ Failed to start workers:'), error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check worker and queue status')
  .action(async () => {
    try {
      console.log(chalk.blue('📊 Checking queue status...\n'));

      const queues = [
        { name: 'Enrichment', queue: enrichmentQueue },
        { name: 'Bulk', queue: bulkQueue },
        { name: 'Webhooks', queue: webhookQueue },
        { name: 'Scoring', queue: scoringQueue },
      ];

      const table = new Table({
        title: 'Queue Status',
        columns: [
          { name: 'queue', title: 'Queue', alignment: 'left', color: 'cyan' },
          { name: 'waiting', title: 'Waiting', alignment: 'right' },
          { name: 'active', title: 'Active', alignment: 'right' },
          { name: 'completed', title: 'Completed', alignment: 'right', color: 'green' },
          { name: 'failed', title: 'Failed', alignment: 'right', color: 'red' },
          { name: 'delayed', title: 'Delayed', alignment: 'right' },
          { name: 'paused', title: 'Status', alignment: 'center' },
        ],
      });

      for (const { name, queue } of queues) {
        const counts = await queue.getJobCounts();
        const isPaused = await queue.isPaused();

        table.addRow({
          queue: name,
          waiting: counts.waiting,
          active: counts.active,
          completed: counts.completed,
          failed: counts.failed,
          delayed: counts.delayed,
          paused: isPaused ? '⏸️  Paused' : '▶️  Running',
        });
      }

      table.printTable();

      // Check Redis connection
      console.log('\n' + chalk.blue('Redis Connection:'));
      try {
        await redisConnection.ping();
        console.log(chalk.green('✅ Connected'));
      } catch (error) {
        console.log(chalk.red('❌ Disconnected'));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error);
      process.exit(1);
    }
  });

// Metrics command
program
  .command('metrics')
  .description('Get detailed queue metrics')
  .action(async () => {
    try {
      console.log(chalk.blue('📈 Queue Metrics\n'));

      const queues = [
        { name: 'Enrichment', queue: enrichmentQueue },
        { name: 'Bulk', queue: bulkQueue },
        { name: 'Webhooks', queue: webhookQueue },
        { name: 'Scoring', queue: scoringQueue },
      ];

      for (const { name, queue } of queues) {
        console.log(chalk.cyan(`\n${name} Queue:`));
        console.log(chalk.gray('─'.repeat(40)));

        const counts = await queue.getJobCounts();
        const completedCount = await queue.getCompletedCount();
        const failedCount = await queue.getFailedCount();

        // Get recent jobs
        const waiting = await queue.getWaiting(0, 5);
        const active = await queue.getActive(0, 5);
        const completed = await queue.getCompleted(0, 5);
        const failed = await queue.getFailed(0, 5);

        // Display counts
        console.log(`  Waiting:   ${chalk.yellow(counts.waiting)}`);
        console.log(`  Active:    ${chalk.blue(counts.active)}`);
        console.log(`  Completed: ${chalk.green(completedCount)}`);
        console.log(`  Failed:    ${chalk.red(failedCount)}`);
        console.log(`  Delayed:   ${chalk.gray(counts.delayed)}`);

        // Display recent job IDs
        if (waiting.length > 0) {
          console.log(`\n  Recent waiting jobs:`);
          waiting.slice(0, 3).forEach(job => {
            console.log(`    - ${job.id}: ${JSON.stringify(job.data).substring(0, 50)}...`);
          });
        }

        if (failed.length > 0) {
          console.log(`\n  Recent failed jobs:`);
          failed.slice(0, 3).forEach(job => {
            console.log(`    - ${job.id}: ${job.failedReason?.substring(0, 50)}...`);
          });
        }

        // Calculate throughput
        if (completedCount > 0) {
          const oldestCompleted = completed[completed.length - 1];
          const newestCompleted = completed[0];
          if (oldestCompleted && newestCompleted) {
            const timeSpan = (newestCompleted.timestamp || 0) - (oldestCompleted.timestamp || 0);
            if (timeSpan > 0) {
              const throughput = (completed.length / timeSpan) * 1000 * 60; // jobs per minute
              console.log(`\n  Throughput: ~${chalk.cyan(throughput.toFixed(1))} jobs/minute`);
            }
          }
        }
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to get metrics:'), error);
      process.exit(1);
    }
  });

// Clear command
program
  .command('clear')
  .description('Clear all queues (WARNING: This will delete all jobs!)')
  .option('-f, --force', 'Skip confirmation')
  .action(async (options) => {
    if (!options.force) {
      console.log(chalk.yellow('⚠️  WARNING: This will delete all jobs in all queues!'));
      console.log('Press Ctrl+C to cancel, or any other key to continue...');

      await new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', resolve);
      });
    }

    try {
      console.log(chalk.blue('\n🗑️  Clearing all queues...'));

      const queues = [
        { name: 'Enrichment', queue: enrichmentQueue },
        { name: 'Bulk', queue: bulkQueue },
        { name: 'Webhooks', queue: webhookQueue },
        { name: 'Scoring', queue: scoringQueue },
      ];

      for (const { name, queue } of queues) {
        await queue.obliterate({ force: true });
        console.log(chalk.green(`✅ ${name} queue cleared`));
      }

      console.log(chalk.green('\n✅ All queues cleared successfully'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to clear queues:'), error);
      process.exit(1);
    }
  });

// Pause command
program
  .command('pause')
  .description('Pause all workers')
  .action(async () => {
    try {
      console.log(chalk.blue('⏸️  Pausing all workers...'));

      const manager = getWorkerManager();
      await manager.pauseAll();

      console.log(chalk.green('✅ All workers paused'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to pause workers:'), error);
      process.exit(1);
    }
  });

// Resume command
program
  .command('resume')
  .description('Resume all workers')
  .action(async () => {
    try {
      console.log(chalk.blue('▶️  Resuming all workers...'));

      const manager = getWorkerManager();
      await manager.resumeAll();

      console.log(chalk.green('✅ All workers resumed'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to resume workers:'), error);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Add test jobs to queues')
  .action(async () => {
    try {
      console.log(chalk.blue('🧪 Adding test jobs to queues...\n'));

      // Add test enrichment job
      const enrichJob = await enrichmentQueue.add('test-enrich', {
        type: 'person',
        identifier: 'test@example.com',
        metadata: { test: true },
      });
      console.log(chalk.green(`✅ Added enrichment job: ${enrichJob.id}`));

      // Add test bulk job
      const bulkJob = await bulkQueue.add('test-bulk', {
        operation: 'enrich_people',
        items: [
          { email: 'test1@example.com' },
          { email: 'test2@example.com' },
        ],
        options: { useCache: true },
      });
      console.log(chalk.green(`✅ Added bulk job: ${bulkJob.id}`));

      // Add test webhook job
      const webhookJob = await webhookQueue.add('test-webhook', {
        event: 'test.event',
        data: { message: 'Test webhook' },
      });
      console.log(chalk.green(`✅ Added webhook job: ${webhookJob.id}`));

      // Add test scoring job
      const scoringJob = await scoringQueue.add('test-score', {
        leadId: 'test-lead-123',
        data: {
          name: 'Test Lead',
          email: 'test@example.com',
          title: 'Test Title',
          company: 'Test Company',
        },
      });
      console.log(chalk.green(`✅ Added scoring job: ${scoringJob.id}`));

      console.log(chalk.green('\n✅ All test jobs added successfully'));
      console.log(chalk.gray('Run "npm run workers:status" to check queue status'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to add test jobs:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);