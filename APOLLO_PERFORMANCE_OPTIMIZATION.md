# Apollo Integration Performance Optimization Guide

## 📊 Performance Benchmarks

### Target Metrics
- **API Response Time**: < 200ms (p95)
- **Queue Processing**: < 5s per job
- **Cache Hit Rate**: > 60%
- **Database Queries**: < 50ms
- **Worker Throughput**: 100+ jobs/minute
- **Memory Usage**: < 1GB per worker
- **CPU Usage**: < 70% sustained

### Current Performance (Baseline)
```javascript
{
  "apiResponseTime": {
    "p50": "150ms",
    "p95": "280ms",
    "p99": "450ms"
  },
  "cacheHitRate": "45%",
  "queueThroughput": "75 jobs/min",
  "errorRate": "0.3%",
  "availability": "99.5%"
}
```

## 🚀 Optimization Strategies

### 1. Redis Caching Optimization

#### Cache Key Strategy
```typescript
// Optimize cache keys for better distribution
const getCacheKey = (type: string, identifier: string) => {
  // Use hash slots for better Redis cluster distribution
  const hash = crypto.createHash('md5').update(identifier).digest('hex').slice(0, 4);
  return `apollo:{${hash}}:${type}:${identifier}`;
};

// Cache TTL optimization based on data type
const CACHE_TTL = {
  person: 86400,      // 24 hours - changes infrequently
  company: 172800,    // 48 hours - very stable
  search: 3600,       // 1 hour - might have new results
  score: 7200,        // 2 hours - can change with new data
  list: 300,          // 5 minutes - frequently updated
};
```

#### Implement Cache Warming
```typescript
// Pre-populate cache during low-traffic periods
class CacheWarmer {
  async warmHighValueLeads() {
    const leads = await db.query(`
      SELECT email FROM leads
      WHERE score > 80
      AND last_contacted > NOW() - INTERVAL '7 days'
      LIMIT 100
    `);

    for (const lead of leads) {
      await apolloService.enrichPerson(lead.email, true);
      await sleep(100); // Rate limit friendly
    }
  }

  async scheduleWarming() {
    // Run at 3 AM daily
    cron.schedule('0 3 * * *', () => {
      this.warmHighValueLeads();
      this.warmTopCompanies();
    });
  }
}
```

#### Redis Configuration
```conf
# /etc/redis/redis.conf

# Memory optimization
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence optimization
save ""  # Disable RDB for cache-only use
appendonly no

# Network optimization
tcp-backlog 511
tcp-keepalive 300
timeout 0

# Threading
io-threads 4
io-threads-do-reads yes
```

### 2. Database Query Optimization

#### Create Optimal Indexes
```sql
-- Composite indexes for common queries
CREATE INDEX idx_leads_org_score_created
ON leads(organization_id, score DESC, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX idx_apollo_people_email_updated
ON apollo_people(email, updated_at DESC);

CREATE INDEX idx_enrichment_queue_composite
ON lead_enrichment_queue(status, priority DESC, created_at ASC)
WHERE status IN ('pending', 'processing');

-- Partial indexes for specific queries
CREATE INDEX idx_leads_high_score
ON leads(score, organization_id)
WHERE score >= 80;

-- GIN index for JSONB search
CREATE INDEX idx_apollo_data_gin
ON leads USING gin(apollo_data);
```

#### Query Optimization Examples
```typescript
// Before: N+1 query problem
const leads = await db.query('SELECT * FROM leads');
for (const lead of leads) {
  const scores = await db.query('SELECT * FROM lead_scores WHERE lead_id = ?', [lead.id]);
}

// After: Single query with join
const leadsWithScores = await db.query(`
  SELECT
    l.*,
    ls.score,
    ls.factors,
    ls.calculated_at
  FROM leads l
  LEFT JOIN LATERAL (
    SELECT * FROM lead_scores
    WHERE lead_id = l.id
    ORDER BY calculated_at DESC
    LIMIT 1
  ) ls ON true
  WHERE l.organization_id = ?
`, [orgId]);
```

#### Connection Pool Tuning
```typescript
// Optimal Supabase connection configuration
const supabaseConfig = {
  db: {
    poolSize: 20,          // Increase for high concurrency
    connectionTimeout: 10, // Seconds
    idleTimeout: 30,       // Seconds
    maxLifetime: 1800,     // 30 minutes
  },
  global: {
    headers: {
      'X-Connection-Pool': 'optimized',
    },
  },
};
```

### 3. Queue Processing Optimization

#### Worker Configuration
```typescript
// Optimized worker settings
const workerConfig = {
  enrichment: {
    concurrency: 10,        // Parallel job processing
    limiter: {
      max: 20,             // Max jobs
      duration: 1000,      // Per second
      bounceBack: false,   // Don't retry rate limited
    },
    stalledInterval: 30000,
    maxStalledCount: 2,
  },
  bulk: {
    concurrency: 3,         // Lower for resource-intensive
    batchSize: 50,         // Process in batches
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
};

// Dynamic concurrency based on load
class AdaptiveWorker {
  adjustConcurrency() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    if (cpuUsage.user > 80 || memUsage.heapUsed > 1e9) {
      this.worker.concurrency = Math.max(1, this.worker.concurrency - 1);
    } else if (cpuUsage.user < 50 && memUsage.heapUsed < 5e8) {
      this.worker.concurrency = Math.min(20, this.worker.concurrency + 1);
    }
  }
}
```

#### Batch Processing
```typescript
// Batch API calls for efficiency
class BatchProcessor {
  async processBatch(items: any[], batchSize = 25) {
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(item => this.processItem(item))
      );

      results.push(...batchResults);

      // Rate limit between batches
      await sleep(500);
    }

    return results;
  }
}
```

### 4. API Rate Limiting Optimization

#### Smart Rate Limiting
```typescript
class SmartRateLimiter {
  private credits = 100;
  private lastRefill = Date.now();
  private readonly refillRate = 10; // per second

  async executeWithBackoff(fn: Function, priority: 'high' | 'normal' | 'low') {
    const cost = this.getCost(priority);

    // Refill credits
    this.refillCredits();

    // Wait if not enough credits
    while (this.credits < cost) {
      const waitTime = ((cost - this.credits) / this.refillRate) * 1000;
      await sleep(Math.min(waitTime, 5000));
      this.refillCredits();
    }

    this.credits -= cost;

    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        // Exponential backoff on rate limit
        const retryAfter = error.headers['retry-after'] || 60;
        await sleep(retryAfter * 1000);
        return this.executeWithBackoff(fn, priority);
      }
      throw error;
    }
  }

  private getCost(priority: string): number {
    switch (priority) {
      case 'high': return 10;
      case 'normal': return 5;
      case 'low': return 2;
      default: return 5;
    }
  }

  private refillCredits() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const refill = Math.floor(elapsed * this.refillRate);

    if (refill > 0) {
      this.credits = Math.min(100, this.credits + refill);
      this.lastRefill = now;
    }
  }
}
```

### 5. Memory Management

#### Prevent Memory Leaks
```typescript
// Clear large objects after use
class MemoryEfficientProcessor {
  async processLargeDataset(data: any[]) {
    const chunkSize = 1000;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      await this.processChunk(chunk);

      // Force garbage collection hint
      if (global.gc) {
        global.gc();
      }

      // Clear references
      chunk.length = 0;
    }
  }

  // Use streams for large data
  async streamProcess(inputPath: string) {
    const stream = fs.createReadStream(inputPath);
    const rl = readline.createInterface({ input: stream });

    for await (const line of rl) {
      await this.processLine(line);
    }

    rl.close();
    stream.destroy();
  }
}
```

#### Memory Monitoring
```typescript
// Monitor and alert on memory usage
class MemoryMonitor {
  start() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

      console.log(`Memory: ${heapUsedMB}MB / ${heapTotalMB}MB`);

      if (heapUsedMB > 800) {
        console.warn('High memory usage detected');
        this.triggerCleanup();
      }

      if (heapUsedMB > 1500) {
        console.error('Critical memory usage - restarting worker');
        process.exit(1); // Let PM2 restart
      }
    }, 30000); // Check every 30 seconds
  }

  triggerCleanup() {
    // Clear caches
    this.clearOldCacheEntries();

    // Run garbage collection
    if (global.gc) {
      global.gc();
    }
  }
}
```

### 6. Network Optimization

#### HTTP Keep-Alive
```typescript
// Reuse connections for Apollo API
import { Agent } from 'https';

const httpsAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'fifo',
});

const apolloFetch = (url: string, options: any) => {
  return fetch(url, {
    ...options,
    agent: httpsAgent,
  });
};
```

#### Response Compression
```typescript
// Enable compression in Next.js
// next.config.js
module.exports = {
  compress: true,

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Encoding',
            value: 'gzip',
          },
        ],
      },
    ];
  },
};
```

### 7. Monitoring & Observability

#### Performance Tracking
```typescript
// Track key metrics
class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();

  track(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const values = this.metrics.get(operation)!;
    values.push(duration);

    // Keep only last 1000 measurements
    if (values.length > 1000) {
      values.shift();
    }
  }

  getStats(operation: string) {
    const values = this.metrics.get(operation) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: values.length,
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  // Log metrics periodically
  startReporting() {
    setInterval(() => {
      console.log('=== Performance Metrics ===');

      for (const [operation, _] of this.metrics) {
        const stats = this.getStats(operation);
        console.log(`${operation}:`, stats);
      }
    }, 60000); // Every minute
  }
}

// Usage
const tracker = new PerformanceTracker();

// Wrap operations
async function trackedOperation(name: string, fn: Function) {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    tracker.track(name, Date.now() - start);
  }
}
```

#### Custom Metrics Dashboard
```typescript
// Expose metrics endpoint
export async function GET(request: NextRequest) {
  const metrics = {
    timestamp: new Date().toISOString(),

    // Cache metrics
    cache: {
      hitRate: await getCacheHitRate(),
      size: await redis.dbsize(),
      memory: await redis.info('memory'),
    },

    // Queue metrics
    queues: {
      enrichment: await enrichmentQueue.getJobCounts(),
      bulk: await bulkQueue.getJobCounts(),
      throughput: await calculateThroughput(),
    },

    // API metrics
    api: {
      requestsPerMinute: await getRequestRate(),
      averageLatency: await getAverageLatency(),
      errorRate: await getErrorRate(),
    },

    // System metrics
    system: {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    },
  };

  return NextResponse.json(metrics);
}
```

## 🔧 Performance Testing

### Load Testing Script
```javascript
// load-test.js
import autocannon from 'autocannon';

const instance = autocannon({
  url: 'http://localhost:3000',
  connections: 100,
  duration: 30,
  pipelining: 10,
  requests: [
    {
      method: 'POST',
      path: '/api/apollo/search',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer TOKEN',
      },
      body: JSON.stringify({
        type: 'people',
        q_keywords: 'sales director',
        page: 1,
        per_page: 25,
      }),
    },
  ],
}, (err, result) => {
  console.log('Requests/sec:', result.requests.average);
  console.log('Latency (ms):', result.latency.mean);
  console.log('Errors:', result.errors);
});
```

### Profiling
```bash
# CPU profiling
node --cpu-prof npm run dev

# Memory profiling
node --heap-prof npm run dev

# Analyze with Chrome DevTools
chrome://inspect
```

## 📈 Scaling Strategies

### Horizontal Scaling
```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  app:
    image: chimera-app
    deploy:
      replicas: 4
    environment:
      NODE_ENV: production
      WEB_CONCURRENCY: 2

  workers:
    image: chimera-workers
    deploy:
      replicas: 3
    environment:
      WORKER_CONCURRENCY: 10

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 3
      placement:
        preferences:
          - spread: node.id
```

### Vertical Scaling Guidelines
| Component | Small | Medium | Large | X-Large |
|-----------|-------|--------|-------|---------|
| App Server | 2 CPU, 4GB RAM | 4 CPU, 8GB RAM | 8 CPU, 16GB RAM | 16 CPU, 32GB RAM |
| Workers | 1 CPU, 2GB RAM | 2 CPU, 4GB RAM | 4 CPU, 8GB RAM | 8 CPU, 16GB RAM |
| Redis | 1 CPU, 2GB RAM | 2 CPU, 4GB RAM | 4 CPU, 8GB RAM | 8 CPU, 16GB RAM |
| Database | 2 CPU, 4GB RAM | 4 CPU, 16GB RAM | 8 CPU, 32GB RAM | 16 CPU, 64GB RAM |

## 🎯 Performance Checklist

### Daily Checks
- [ ] Cache hit rate > 60%
- [ ] Queue backlog < 100 jobs
- [ ] API response time < 300ms (p95)
- [ ] Error rate < 1%
- [ ] Memory usage stable

### Weekly Optimization
- [ ] Review slow queries
- [ ] Analyze cache misses
- [ ] Check for memory leaks
- [ ] Update rate limits
- [ ] Clean old data

### Monthly Review
- [ ] Database index optimization
- [ ] Redis memory analysis
- [ ] Queue throughput analysis
- [ ] Cost optimization review
- [ ] Capacity planning

## 🚨 Performance Alerts

### Set Up Monitoring Alerts
```typescript
// Alert thresholds
const ALERT_THRESHOLDS = {
  apiLatency: 500,        // ms
  cacheHitRate: 0.5,      // 50%
  queueBacklog: 1000,     // jobs
  errorRate: 0.02,        // 2%
  memoryUsage: 0.9,       // 90%
  cpuUsage: 0.8,          // 80%
};

// Alert on threshold breach
function checkThresholds(metrics: any) {
  const alerts = [];

  if (metrics.api.latency > ALERT_THRESHOLDS.apiLatency) {
    alerts.push({
      severity: 'warning',
      message: `API latency high: ${metrics.api.latency}ms`,
    });
  }

  if (metrics.cache.hitRate < ALERT_THRESHOLDS.cacheHitRate) {
    alerts.push({
      severity: 'warning',
      message: `Cache hit rate low: ${metrics.cache.hitRate * 100}%`,
    });
  }

  if (metrics.errorRate > ALERT_THRESHOLDS.errorRate) {
    alerts.push({
      severity: 'critical',
      message: `Error rate high: ${metrics.errorRate * 100}%`,
    });
  }

  return alerts;
}
```

## 📚 Additional Resources

- [Redis Optimization Guide](https://redis.io/docs/manual/optimization/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Next.js Production Checklist](https://nextjs.org/docs/going-to-production)

---

By following these optimization strategies, you should achieve:
- **50% reduction** in API response times
- **30% increase** in throughput
- **40% reduction** in infrastructure costs
- **99.9% uptime** availability