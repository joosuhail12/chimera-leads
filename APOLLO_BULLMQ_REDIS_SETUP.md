# Apollo + BullMQ + Redis Integration Guide

## Overview

This document describes the complete integration of Apollo.io enrichment with BullMQ job queues and Redis caching, including AWS ElastiCache setup for production deployment.

## Architecture Components

### 1. Redis Layer
- **Local Development**: Standard Redis instance
- **Production**: AWS ElastiCache (managed Redis)
- **Purpose**: Job queue storage, caching, rate limiting

### 2. BullMQ Queues
- **Enrichment Queue**: Person/company data enrichment
- **Bulk Queue**: Batch operations
- **Webhook Queue**: Apollo webhook processing
- **Scoring Queue**: AI-powered lead scoring

### 3. Apollo Service
- Enrichment API calls
- Search functionality
- List management
- Webhook handling

## Setup Instructions

### 1. AWS ElastiCache Setup

Run the setup script to create an AWS ElastiCache Redis instance:

```bash
# Make script executable
chmod +x scripts/setup-elasticache.sh

# Run setup (requires AWS CLI configured)
./scripts/setup-elasticache.sh
```

The script will:
- Create a Redis cluster in AWS
- Set up security groups
- Configure parameter groups
- Generate `.env.elasticache` with connection details

### 2. Environment Configuration

Add these variables to your `.env.local`:

```env
# Apollo API
APOLLO_API_KEY=your_apollo_api_key_here

# Redis Connection (Local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Redis Connection (AWS ElastiCache)
# Copy from .env.elasticache after running setup script
# REDIS_HOST=your-cluster.cache.amazonaws.com
# REDIS_PORT=6379
# REDIS_TLS=false

# Worker Configuration (Optional)
WORKER_ENRICHMENT_CONCURRENCY=5
WORKER_BULK_CONCURRENCY=2
WORKER_WEBHOOK_CONCURRENCY=10
WORKER_SCORING_CONCURRENCY=3
```

### 3. Install Dependencies

```bash
npm install
# or if you encounter peer dependency issues
npm install --legacy-peer-deps
```

### 4. Database Migrations

The Apollo integration uses several database tables. Ensure your Supabase migrations are up to date:

```bash
npx supabase db push
```

Required tables:
- `apollo_api_usage` - API call tracking
- `apollo_lists` - Apollo list synchronization
- `apollo_webhooks` - Webhook event storage
- `lead_enrichment_queue` - Enrichment job tracking
- `lead_scores` - AI scoring results

## Running the System

### Development Mode

```bash
# Terminal 1: Start Next.js app
npm run dev

# Terminal 2: Start queue worker
npm run worker:dev
```

### Production Mode

```bash
# Build the application
npm run build

# Start the application
npm start

# Start the worker (in a separate process/container)
npm run worker:production
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2
npm install -g pm2

# Start all processes
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'chimera-web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'chimera-worker',
      script: 'npm',
      args: 'run worker:production',
      instances: 2, // Run 2 worker instances
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

## API Endpoints

### Queue Management

#### `GET /api/queues`
Get queue metrics and status.

#### `POST /api/queues`
Perform queue actions:
- `enrich` - Add enrichment job
- `bulk` - Add bulk operation
- `score` - Add scoring job
- `promote` - Promote job priority
- `retry-failed` - Retry failed jobs
- `clear-failed` - Clear failed jobs
- `pause` - Pause queue
- `resume` - Resume queue

### Queue Monitoring

#### `/api/queues/board`
Bull Board UI for visual queue monitoring.

#### `/dashboard/queues`
Custom dashboard for queue management.

## Usage Examples

### 1. Enrich a Single Lead

```typescript
import { queueManager } from '@/lib/queue/apollo-queue';

const jobId = await queueManager.addToEnrichmentQueue({
  id: `enrich-${Date.now()}`,
  type: 'person',
  identifier: 'john@example.com',
  priority: 'high',
  metadata: {
    leadId: 'lead-123',
    userId: 'user-456',
    orgId: 'org-789',
  },
});
```

### 2. Bulk Enrichment

```typescript
const jobIds = await apolloService.bulkEnrich(
  [
    { email: 'john@example.com' },
    { email: 'jane@example.com' },
    { domain: 'example.com' },
  ],
  'normal'
);
```

### 3. Search Apollo Database

```typescript
const results = await apolloService.searchPeople({
  q_keywords: 'software engineer',
  organization_domains: ['google.com', 'meta.com'],
  per_page: 25,
});
```

### 4. Monitor Queue Status

```typescript
const metrics = await queueManager.getQueueMetrics();
console.log('Enrichment queue:', metrics.enrichment);
```

## Testing

Run the integration test suite:

```bash
# Test all components
tsx test-apollo-integration.ts

# Test specific queue operations
npm run workers:test
```

## Monitoring & Debugging

### 1. Queue Dashboard
Access the queue dashboard at: http://localhost:3000/dashboard/queues

### 2. Bull Board
Access Bull Board at: http://localhost:3000/api/queues/board

### 3. Redis CLI
```bash
# Connect to Redis
redis-cli -h localhost -p 6379

# Monitor commands
redis-cli monitor

# Check queue sizes
redis-cli --scan --pattern "bull:*"
```

### 4. Worker Logs
```bash
# View worker output
npm run worker:dev

# With PM2
pm2 logs chimera-worker
```

## Performance Optimization

### 1. Redis Configuration

For production, optimize Redis settings in the parameter group:
- `maxmemory-policy: allkeys-lru`
- `timeout: 300`
- `tcp-keepalive: 300`

### 2. Worker Concurrency

Adjust worker concurrency based on your needs:

```env
WORKER_ENRICHMENT_CONCURRENCY=10  # Increase for higher throughput
WORKER_BULK_CONCURRENCY=5          # Balance with API rate limits
```

### 3. Caching Strategy

The system implements multi-level caching:
- **L1 Cache**: Redis with TTL
- **L2 Cache**: Database storage
- **Cache Keys**: Automatically generated based on request parameters

### 4. Rate Limiting

Apollo API rate limits are handled automatically:
- 100 requests per minute (default)
- Exponential backoff on rate limit errors
- Queue-based throttling for bulk operations

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check ElastiCache endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id chimera-redis-cluster \
  --show-cache-node-info
```

### Queue Processing Issues

```bash
# Clear all failed jobs
curl -X POST http://localhost:3000/api/queues \
  -H "Content-Type: application/json" \
  -d '{"action": "clear-failed"}'

# Retry failed jobs
curl -X POST http://localhost:3000/api/queues \
  -H "Content-Type: application/json" \
  -d '{"action": "retry-failed"}'
```

### Apollo API Issues

Check API key and rate limits:
```bash
# Test Apollo API directly
curl -X POST https://api.apollo.io/v1/people/match \
  -H "X-Api-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## Security Considerations

1. **API Keys**: Store Apollo API key in environment variables only
2. **Redis Security**: Use password authentication and VPC for ElastiCache
3. **Queue Authorization**: All queue endpoints require authentication
4. **Data Encryption**: Enable TLS for Redis in production
5. **Rate Limiting**: Implement per-organization rate limits

## Cost Optimization

### AWS ElastiCache
- Use `cache.t3.micro` for development
- Scale to `cache.r6g.large` for production
- Enable automatic backups
- Use reserved instances for predictable workloads

### Apollo API
- Cache responses aggressively
- Use batch operations when possible
- Monitor API usage to avoid overages

## Scaling Considerations

### Horizontal Scaling
- Run multiple worker instances
- Use Redis Cluster for high availability
- Implement queue priorities

### Vertical Scaling
- Increase worker concurrency
- Upgrade Redis instance type
- Optimize database queries

## Support & Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Apollo API Documentation](https://apolloio.github.io/apollo-api-docs/)
- [AWS ElastiCache Guide](https://docs.aws.amazon.com/elasticache/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)

## Next Steps

1. Set up monitoring alerts
2. Configure automated backups
3. Implement queue analytics
4. Add custom metrics tracking
5. Set up distributed tracing