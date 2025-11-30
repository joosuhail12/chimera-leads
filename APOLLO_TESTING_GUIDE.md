# Apollo Integration Testing Guide

## Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.apollo.example .env.local
# Edit .env.local with your credentials

# Start Redis locally
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:alpine

# Run database migrations
npx supabase db push
```

### 2. Mock Apollo API Key for Testing
If you don't have an Apollo API key yet, you can use mock mode:
```env
APOLLO_API_KEY=mock_test_key_12345
ENABLE_MOCK_MODE=true
```

## Unit Tests

### 1. Test Apollo Service

Create `/src/lib/services/__tests__/apollo.test.ts`:

```typescript
import { ApolloService } from '../apollo';
import { CacheManager } from '@/lib/redis/client';

describe('ApolloService', () => {
  let service: ApolloService;

  beforeEach(() => {
    service = new ApolloService('test_key', 'org_123');
  });

  describe('searchPeople', () => {
    it('should search people with caching', async () => {
      const results = await service.searchPeople({
        q_keywords: 'sales director',
        page: 1,
        per_page: 10
      });

      expect(results).toHaveProperty('people');
      expect(results).toHaveProperty('pagination');
      expect(Array.isArray(results.people)).toBe(true);
    });

    it('should handle rate limiting gracefully', async () => {
      // Simulate multiple rapid requests
      const promises = Array(10).fill(null).map(() =>
        service.searchPeople({ q_keywords: 'test' })
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('enrichPerson', () => {
    it('should enrich person by email', async () => {
      const person = await service.enrichPerson('test@example.com');

      if (person) {
        expect(person).toHaveProperty('email');
        expect(person).toHaveProperty('name');
      }
    });

    it('should use cache when available', async () => {
      const email = 'cached@example.com';

      // First call - hits API
      const result1 = await service.enrichPerson(email);

      // Second call - should hit cache
      const result2 = await service.enrichPerson(email);

      expect(result1).toEqual(result2);
    });
  });
});
```

### 2. Test Lead Scoring Service

Create `/src/lib/services/__tests__/lead-scoring.test.ts`:

```typescript
import { AILeadScoringService } from '../lead-scoring';

describe('AILeadScoringService', () => {
  let service: AILeadScoringService;

  beforeEach(() => {
    service = new AILeadScoringService();
  });

  it('should calculate lead score', async () => {
    const lead = {
      id: 'test_lead_1',
      name: 'John Doe',
      email: 'john@techcorp.com',
      title: 'VP Sales',
      company: 'TechCorp',
      websiteVisits: 5,
      contentDownloads: 2
    };

    const result = await service.calculateScore(lead);

    expect(result).toHaveProperty('score');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result).toHaveProperty('factors');
    expect(result).toHaveProperty('aiInsights');
    expect(result).toHaveProperty('recommendations');
  });

  it('should categorize leads correctly', async () => {
    const hotLead = {
      id: 'hot_lead',
      name: 'Hot Prospect',
      email: 'hot@enterprise.com',
      title: 'CTO',
      company: 'Enterprise Corp',
      websiteVisits: 15,
      contentDownloads: 5,
      customFields: {
        demoRequested: true,
        pricingPageVisits: 3
      }
    };

    const result = await service.calculateScore(hotLead);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });
});
```

### 3. Test Queue System

Create `/src/lib/queue/__tests__/apollo-queue.test.ts`:

```typescript
import { QueueManager } from '../apollo-queue';

describe('QueueManager', () => {
  let queueManager: QueueManager;

  beforeEach(() => {
    queueManager = new QueueManager();
  });

  afterEach(async () => {
    await queueManager.close();
  });

  it('should add job to enrichment queue', async () => {
    const job = {
      id: 'test_job_1',
      type: 'person' as const,
      identifier: 'test@example.com',
      priority: 'normal' as const,
      metadata: {
        userId: 'user_1',
        orgId: 'org_1'
      }
    };

    const jobId = await queueManager.addToEnrichmentQueue(job);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should get queue metrics', async () => {
    const metrics = await queueManager.getQueueMetrics();

    expect(metrics).toHaveProperty('enrichment');
    expect(metrics.enrichment).toHaveProperty('waiting');
    expect(metrics.enrichment).toHaveProperty('active');
    expect(metrics.enrichment).toHaveProperty('completed');
  });
});
```

## Integration Tests

### 1. API Route Tests

Create `/src/app/api/apollo/__tests__/search.test.ts`:

```typescript
import { POST } from '../search/route';
import { NextRequest } from 'next/server';

describe('Apollo Search API', () => {
  it('should search people', async () => {
    const request = new NextRequest('http://localhost:3000/api/apollo/search', {
      method: 'POST',
      body: JSON.stringify({
        type: 'people',
        q_keywords: 'sales',
        page: 1,
        per_page: 10
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
  });

  it('should validate request parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/apollo/search', {
      method: 'POST',
      body: JSON.stringify({
        type: 'invalid_type'
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle rate limiting', async () => {
    // Make multiple requests rapidly
    const requests = Array(10).fill(null).map(() =>
      new NextRequest('http://localhost:3000/api/apollo/search', {
        method: 'POST',
        body: JSON.stringify({
          type: 'people',
          q_keywords: 'test'
        })
      })
    );

    const responses = await Promise.all(requests.map(r => POST(r)));
    const hasRateLimit = responses.some(r => r.status === 429);

    // Should handle rate limiting appropriately
    expect(responses.every(r => r.status === 200 || r.status === 429)).toBe(true);
  });
});
```

## End-to-End Tests

### 1. Playwright Test Setup

Install Playwright:
```bash
npm install -D @playwright/test
```

Create `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. E2E Test Scenarios

Create `/e2e/apollo-prospecting.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Apollo Prospecting', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication if needed
    await page.goto('/dashboard/prospecting');
  });

  test('should search for contacts', async ({ page }) => {
    // Enter search query
    await page.fill('input[placeholder*="Search"]', 'sales director');

    // Click search button
    await page.click('button:has-text("Search")');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', {
      timeout: 10000
    });

    // Verify results displayed
    const results = await page.$$('[data-testid="contact-card"]');
    expect(results.length).toBeGreaterThan(0);
  });

  test('should filter search results', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Filters")');

    // Set job title filter
    await page.fill('input[placeholder*="Job Titles"]', 'VP Sales, Director');

    // Apply filters and search
    await page.click('button:has-text("Search")');

    // Verify filtered results
    await page.waitForSelector('[data-testid="search-results"]');
    const titles = await page.$$eval('[data-testid="contact-title"]',
      elements => elements.map(el => el.textContent)
    );

    expect(titles.some(t => t?.includes('VP') || t?.includes('Director'))).toBe(true);
  });

  test('should import a lead', async ({ page }) => {
    // Search first
    await page.fill('input[placeholder*="Search"]', 'john doe');
    await page.click('button:has-text("Search")');

    // Wait for results
    await page.waitForSelector('[data-testid="contact-card"]');

    // Click import on first result
    await page.click('[data-testid="contact-card"]:first-child button:has-text("Import")');

    // Verify success toast
    await expect(page.locator('.toast:has-text("Import Successful")')).toBeVisible();

    // Verify button changed to "Imported"
    await expect(
      page.locator('[data-testid="contact-card"]:first-child button:has-text("Imported")')
    ).toBeVisible();
  });

  test('should show lead scores', async ({ page }) => {
    // Navigate to scoring tab
    await page.click('button:has-text("Lead Scoring")');

    // Wait for scoring dashboard
    await page.waitForSelector('[data-testid="scoring-dashboard"]');

    // Verify score cards are displayed
    const scoreCards = await page.$$('[data-testid="lead-score-card"]');
    expect(scoreCards.length).toBeGreaterThan(0);

    // Click on a lead to see details
    await page.click('[data-testid="lead-score-card"]:first-child');

    // Verify details panel
    await expect(page.locator('[data-testid="score-breakdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-insights"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommendations"]')).toBeVisible();
  });

  test('should search companies', async ({ page }) => {
    // Navigate to companies tab
    await page.click('button:has-text("Company Discovery")');

    // Apply preset filter
    await page.click('button:has-text("Ideal Customer Profile")');

    // Search
    await page.click('button:has-text("Search")');

    // Wait for results
    await page.waitForSelector('[data-testid="company-card"]');

    // Verify company cards
    const companies = await page.$$('[data-testid="company-card"]');
    expect(companies.length).toBeGreaterThan(0);

    // Check fit scores are displayed
    const fitScores = await page.$$('[data-testid="fit-score"]');
    expect(fitScores.length).toBeGreaterThan(0);
  });
});
```

## Load Testing

### 1. Artillery Configuration

Install Artillery:
```bash
npm install -D artillery
```

Create `artillery.yml`:
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 10
      name: "Ramp up"
    - duration: 60
      arrivalRate: 20
      name: "Peak load"
  processor: "./artillery-processor.js"

scenarios:
  - name: "Search People"
    weight: 40
    flow:
      - post:
          url: "/api/apollo/search"
          json:
            type: "people"
            q_keywords: "{{ randomKeyword }}"
            page: 1
            per_page: 25
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
            - contentType: json

  - name: "Enrich Contact"
    weight: 30
    flow:
      - post:
          url: "/api/apollo/enrich"
          json:
            type: "person"
            identifier: "{{ randomEmail }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200

  - name: "Bulk Enrichment"
    weight: 20
    flow:
      - post:
          url: "/api/apollo/enrich"
          json:
            type: "bulk"
            contacts:
              - email: "{{ randomEmail }}"
              - email: "{{ randomEmail }}"
              - email: "{{ randomEmail }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200

  - name: "Get Queue Status"
    weight: 10
    flow:
      - get:
          url: "/api/apollo/enrich"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
```

Run load tests:
```bash
artillery run artillery.yml
```

## Performance Monitoring

### 1. Redis Monitoring

```bash
# Monitor Redis in real-time
redis-cli monitor

# Check memory usage
redis-cli info memory

# Check slow queries
redis-cli slowlog get 10

# Monitor cache hit rate
redis-cli info stats | grep keyspace_hits
```

### 2. Queue Monitoring

Create a monitoring script `/scripts/monitor-queues.js`:

```javascript
const { QueueManager } = require('../dist/lib/queue/apollo-queue');

async function monitorQueues() {
  const queueManager = new QueueManager();

  setInterval(async () => {
    const metrics = await queueManager.getQueueMetrics();

    console.clear();
    console.log('Queue Metrics - ' + new Date().toLocaleTimeString());
    console.log('=====================================');

    Object.entries(metrics).forEach(([queue, stats]) => {
      console.log(`\n${queue.toUpperCase()}:`);
      console.log(`  Waiting: ${stats.waiting}`);
      console.log(`  Active: ${stats.active}`);
      console.log(`  Completed: ${stats.completed}`);
      console.log(`  Failed: ${stats.failed}`);
      console.log(`  Total Pending: ${stats.total}`);
    });
  }, 1000);
}

monitorQueues();
```

### 3. API Performance Tracking

Add logging middleware to track API performance:

```typescript
// /src/middleware/performance.ts
export function performanceMiddleware(handler: Function) {
  return async (req: Request, ...args: any[]) => {
    const start = Date.now();
    const result = await handler(req, ...args);
    const duration = Date.now() - start;

    console.log({
      endpoint: req.url,
      method: req.method,
      duration: `${duration}ms`,
      status: result.status,
      timestamp: new Date().toISOString()
    });

    return result;
  };
}
```

## Testing Checklist

### Before Testing
- [ ] Redis is running
- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Mock data seeded (optional)

### Unit Tests
- [ ] Apollo Service methods
- [ ] Lead Scoring calculations
- [ ] Queue operations
- [ ] Cache operations
- [ ] Rate limiting

### Integration Tests
- [ ] Search API endpoint
- [ ] Enrichment API endpoint
- [ ] Webhook processing
- [ ] List management
- [ ] Error handling

### E2E Tests
- [ ] Contact search flow
- [ ] Company discovery flow
- [ ] Lead import process
- [ ] Lead scoring display
- [ ] Bulk operations
- [ ] Filter functionality

### Performance Tests
- [ ] Load testing passed
- [ ] Cache hit rate > 60%
- [ ] API response time < 2s
- [ ] Queue processing time acceptable
- [ ] No memory leaks

### Security Tests
- [ ] Authentication required
- [ ] Rate limiting working
- [ ] Webhook signature validation
- [ ] Input validation
- [ ] XSS prevention

## Debugging Tips

### 1. Enable Debug Logging
```env
LOG_LEVEL=debug
DEBUG=apollo:*
```

### 2. Check Redis Cache
```bash
# List all Apollo cache keys
redis-cli keys "apollo:*"

# Get specific cache entry
redis-cli get "apollo:person:email@example.com"

# Clear all cache
redis-cli flushdb
```

### 3. Inspect Queue Jobs
```bash
# Use Bull Board for visual queue inspection
npm install -D @bull-board/express @bull-board/api

# Add to your app
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullAdapter(enrichmentQueue),
    new BullAdapter(webhookQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/apollo-tests.yml`:

```yaml
name: Apollo Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx supabase db push
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Run unit tests
        run: npm test
        env:
          REDIS_HOST: localhost
          APOLLO_API_KEY: mock_test_key
          ENABLE_MOCK_MODE: true

      - name: Run E2E tests
        run: npx playwright test
        env:
          CI: true

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            test-results/
            playwright-report/
```

## Troubleshooting Common Issues

### Issue: "Redis connection refused"
**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server

# Or with Docker
docker run -d -p 6379:6379 redis:alpine
```

### Issue: "Apollo API rate limit exceeded"
**Solution:**
- Increase cache TTLs in `.env`
- Use batch priority for non-urgent requests
- Implement request queuing
- Check Apollo plan limits

### Issue: "Tests timing out"
**Solution:**
- Increase test timeout: `test.setTimeout(30000)`
- Check network connectivity
- Verify mock mode is enabled for tests
- Clear Redis cache before tests

### Issue: "Webhook not received"
**Solution:**
- Use ngrok for local testing: `ngrok http 3000`
- Verify webhook secret matches
- Check Apollo webhook logs
- Test with curl first