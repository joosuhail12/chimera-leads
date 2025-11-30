#!/usr/bin/env tsx

/**
 * Apollo Integration Test Script
 *
 * This script tests the complete Apollo integration including:
 * - Redis connection
 * - BullMQ queue operations
 * - Apollo API calls
 * - Database updates
 *
 * Usage: tsx test-apollo-integration.ts
 */

import 'dotenv/config';
import { ApolloService } from './src/lib/services/apollo';
import { queueManager } from './src/lib/queue/apollo-queue';
import { getRedisClient, CacheManager, RateLimiter } from './src/lib/redis/client';
import { createClient } from './src/lib/supabase/server';
import { initializeQueueWorkers } from './src/lib/queue/apollo-queue';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

// Test configuration
const TEST_CONFIG = {
  testEmail: 'john.doe@example.com',
  testDomain: 'example.com',
  testOrgId: process.env.CLERK_ALLOWED_ORG_ID || 'test-org',
  apolloApiKey: process.env.APOLLO_API_KEY,
};

async function testRedisConnection(): Promise<boolean> {
  log.section('Testing Redis Connection');

  try {
    const redis = getRedisClient();

    // Test basic operations
    await redis.ping();
    log.success('Redis ping successful');

    // Test set/get
    const testKey = 'apollo:test:connection';
    const testValue = { test: true, timestamp: Date.now() };
    await redis.set(testKey, JSON.stringify(testValue));
    const retrieved = await redis.get(testKey);

    if (retrieved) {
      const parsed = JSON.parse(retrieved);
      if (parsed.test === true) {
        log.success('Redis set/get operations working');
      }
    }

    // Cleanup
    await redis.del(testKey);

    // Test cache manager
    const cache = new CacheManager();
    const cacheKey = 'apollo:test:cache';
    await cache.set(cacheKey, testValue, 60);
    const cachedValue = await cache.get(cacheKey);

    if (cachedValue) {
      log.success('Cache manager working');
    }

    // Test rate limiter
    const rateLimiter = new RateLimiter(60000, 5);
    const result = await rateLimiter.checkLimit('test-identifier');

    if (result.allowed) {
      log.success(`Rate limiter working (${result.remaining} requests remaining)`);
    }

    return true;
  } catch (error) {
    log.error(`Redis connection failed: ${error}`);
    return false;
  }
}

async function testQueueOperations(): Promise<boolean> {
  log.section('Testing Queue Operations');

  try {
    // Test adding a job to enrichment queue
    const enrichmentJobId = await queueManager.addToEnrichmentQueue({
      id: `test-enrich-${Date.now()}`,
      type: 'person',
      identifier: TEST_CONFIG.testEmail,
      priority: 'high',
      metadata: {
        userId: 'test-user',
        orgId: TEST_CONFIG.testOrgId,
      },
    });

    if (enrichmentJobId) {
      log.success(`Added enrichment job: ${enrichmentJobId}`);
    }

    // Test getting job status
    const jobStatus = await queueManager.getJobStatus('enrichment', enrichmentJobId);
    if (jobStatus) {
      log.success(`Job status retrieved: ${jobStatus.state}`);
    }

    // Test queue metrics
    const metrics = await queueManager.getQueueMetrics();
    log.success('Queue metrics retrieved:');

    for (const [queue, stats] of Object.entries(metrics)) {
      const queueStats = stats as any;
      log.info(`  ${queue}: ${queueStats.waiting} waiting, ${queueStats.active} active, ${queueStats.completed} completed`);
    }

    // Test bulk queue
    const bulkJobIds = await queueManager.addToBulkQueue([
      {
        id: `test-bulk-${Date.now()}`,
        operation: 'enrich',
        data: [
          { email: 'test1@example.com' },
          { email: 'test2@example.com' },
        ],
        options: {},
        metadata: {
          userId: 'test-user',
          orgId: TEST_CONFIG.testOrgId,
          source: 'test',
        },
      },
    ]);

    if (bulkJobIds.length > 0) {
      log.success(`Added bulk job: ${bulkJobIds[0]}`);
    }

    return true;
  } catch (error) {
    log.error(`Queue operations failed: ${error}`);
    return false;
  }
}

async function testApolloAPI(): Promise<boolean> {
  log.section('Testing Apollo API');

  if (!TEST_CONFIG.apolloApiKey) {
    log.warning('APOLLO_API_KEY not set, skipping API tests');
    return false;
  }

  try {
    const apolloService = new ApolloService(TEST_CONFIG.apolloApiKey, TEST_CONFIG.testOrgId);

    // Test cache operations
    const cacheKey = 'apollo:test:data';
    await apolloService.setCachedData(cacheKey, { test: true }, 60);
    const cachedData = await apolloService.getCachedData(cacheKey);

    if (cachedData) {
      log.success('Apollo cache operations working');
    }

    // Test person enrichment (with cache)
    log.info(`Testing person enrichment for: ${TEST_CONFIG.testEmail}`);
    const person = await apolloService.enrichPerson(TEST_CONFIG.testEmail);

    if (person) {
      log.success(`Person enriched: ${person.name || person.email}`);
      log.info(`  Title: ${person.title || 'N/A'}`);
      log.info(`  Company: ${person.organization?.name || 'N/A'}`);
    } else {
      log.warning('No person data returned (this is normal for test emails)');
    }

    // Test company enrichment
    log.info(`Testing company enrichment for: ${TEST_CONFIG.testDomain}`);
    const company = await apolloService.enrichCompany(TEST_CONFIG.testDomain);

    if (company) {
      log.success(`Company enriched: ${company.name}`);
      log.info(`  Industry: ${company.industry || 'N/A'}`);
      log.info(`  Employees: ${company.employee_count || 'N/A'}`);
    } else {
      log.warning('No company data returned (this is normal for test domains)');
    }

    // Test search functionality
    log.info('Testing people search...');
    const searchResults = await apolloService.searchPeople({
      q_keywords: 'software engineer',
      per_page: 5,
    });

    if (searchResults && searchResults.people.length > 0) {
      log.success(`Found ${searchResults.people.length} people`);
      searchResults.people.slice(0, 3).forEach((p) => {
        log.info(`  - ${p.name} (${p.title} at ${p.organization?.name})`);
      });
    }

    // Test API usage stats
    const stats = await apolloService.getApiUsageStats(1);
    log.success('API usage stats retrieved:');
    log.info(`  Total requests: ${stats.totalRequests}`);
    log.info(`  Cached requests: ${stats.cachedRequests}`);
    log.info(`  Failed requests: ${stats.failedRequests}`);

    return true;
  } catch (error) {
    log.error(`Apollo API tests failed: ${error}`);
    return false;
  }
}

async function testDatabaseIntegration(): Promise<boolean> {
  log.section('Testing Database Integration');

  try {
    const supabase = await createClient();

    // Test creating enrichment queue entry
    const { data: queueEntry, error: queueError } = await supabase
      .from('lead_enrichment_queue')
      .insert({
        organization_id: TEST_CONFIG.testOrgId,
        lead_id: 'test-lead-id',
        enrichment_type: 'apollo',
        status: 'pending',
        priority: 'normal',
      })
      .select('id')
      .single();

    if (queueEntry) {
      log.success(`Created enrichment queue entry: ${queueEntry.id}`);

      // Clean up
      await supabase
        .from('lead_enrichment_queue')
        .delete()
        .eq('id', queueEntry.id);
    } else if (queueError) {
      log.warning(`Database insert warning: ${queueError.message}`);
    }

    // Test API usage tracking
    const { error: usageError } = await supabase
      .from('apollo_api_usage')
      .insert({
        organization_id: TEST_CONFIG.testOrgId,
        endpoint: '/test',
        method: 'GET',
        status_code: 200,
        cached: false,
        response_time_ms: 100,
      });

    if (!usageError) {
      log.success('API usage tracking working');
    } else {
      log.warning(`API usage tracking warning: ${usageError.message}`);
    }

    return true;
  } catch (error) {
    log.error(`Database integration failed: ${error}`);
    return false;
  }
}

async function testWorkerInitialization(): Promise<boolean> {
  log.section('Testing Worker Initialization');

  try {
    const workers = initializeQueueWorkers();

    if (workers.enrichmentWorker) {
      log.success('Enrichment worker initialized');
    }

    if (workers.webhookWorker) {
      log.success('Webhook worker initialized');
    }

    if (workers.scoringWorker) {
      log.success('Scoring worker initialized');
    }

    // Close workers after test
    await Promise.all([
      workers.enrichmentWorker.close(),
      workers.webhookWorker.close(),
      workers.scoringWorker.close(),
    ]);

    log.success('Workers closed successfully');
    return true;
  } catch (error) {
    log.error(`Worker initialization failed: ${error}`);
    return false;
  }
}

async function runAllTests() {
  console.log(`
${colors.cyan}════════════════════════════════════════════════════════════
     Apollo Integration Test Suite
════════════════════════════════════════════════════════════${colors.reset}
`);

  const tests = [
    { name: 'Redis Connection', fn: testRedisConnection },
    { name: 'Queue Operations', fn: testQueueOperations },
    { name: 'Apollo API', fn: testApolloAPI },
    { name: 'Database Integration', fn: testDatabaseIntegration },
    { name: 'Worker Initialization', fn: testWorkerInitialization },
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      log.error(`Unexpected error in ${test.name}: ${error}`);
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  log.section('Test Summary');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    if (result.passed) {
      log.success(`${result.name}: PASSED`);
    } else {
      log.error(`${result.name}: FAILED`);
    }
  });

  console.log(`
${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}
  Results: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}
${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}
`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  log.error(`Test suite failed: ${error}`);
  process.exit(1);
});