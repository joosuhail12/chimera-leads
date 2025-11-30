import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redisConnection, CacheManager } from '@/lib/redis/client';
import { enrichmentQueue, bulkQueue, webhookQueue, scoringQueue } from '@/lib/queue/apollo-queue';
import { ApolloService } from '@/lib/services/apollo';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  services: {
    apollo: ServiceHealth;
    redis: ServiceHealth;
    database: ServiceHealth;
    queues: QueueHealth;
  };
  metrics?: {
    cacheHitRate: number;
    avgResponseTime: number;
    activeConnections: number;
    queueBacklog: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

interface QueueHealth {
  status: 'healthy' | 'degraded' | 'down';
  details: {
    enrichment: QueueStatus;
    bulk: QueueStatus;
    webhooks: QueueStatus;
    scoring: QueueStatus;
  };
}

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  paused: boolean;
}

// Track service start time
const startTime = Date.now();

export async function GET(request: NextRequest) {
  const startCheck = Date.now();

  // Initialize response
  const health: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000), // in seconds
    services: {
      apollo: { status: 'down' },
      redis: { status: 'down' },
      database: { status: 'down' },
      queues: {
        status: 'down',
        details: {
          enrichment: { waiting: 0, active: 0, completed: 0, failed: 0, paused: false },
          bulk: { waiting: 0, active: 0, completed: 0, failed: 0, paused: false },
          webhooks: { waiting: 0, active: 0, completed: 0, failed: 0, paused: false },
          scoring: { waiting: 0, active: 0, completed: 0, failed: 0, paused: false },
        }
      },
    },
  };

  // Check Apollo API
  try {
    const apolloStart = Date.now();
    const apolloService = new ApolloService();

    // Make a lightweight API call to check connectivity
    const testResponse = await fetch('https://api.apollo.io/v1/auth/health', {
      headers: {
        'X-Api-Key': process.env.APOLLO_API_KEY || '',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const apolloTime = Date.now() - apolloStart;

    if (testResponse.ok) {
      // Check rate limit headers
      const rateLimit = testResponse.headers.get('X-Rate-Limit-Remaining');
      const rateLimitTotal = testResponse.headers.get('X-Rate-Limit-Limit');

      health.services.apollo = {
        status: 'healthy',
        responseTime: apolloTime,
        details: {
          rateLimitRemaining: rateLimit ? parseInt(rateLimit) : undefined,
          rateLimitTotal: rateLimitTotal ? parseInt(rateLimitTotal) : undefined,
        },
      };

      // Check if rate limit is low
      if (rateLimit && rateLimitTotal) {
        const remaining = parseInt(rateLimit);
        const total = parseInt(rateLimitTotal);
        if (remaining < total * 0.1) { // Less than 10% remaining
          health.services.apollo.status = 'degraded';
          health.services.apollo.message = 'Rate limit nearly exhausted';
        }
      }
    } else {
      health.services.apollo = {
        status: 'down',
        message: `Apollo API returned ${testResponse.status}`,
        responseTime: apolloTime,
      };
    }
  } catch (error) {
    health.services.apollo = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Failed to connect to Apollo API',
    };
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redisConnection.ping();
    const redisTime = Date.now() - redisStart;

    // Get Redis info
    const info = await redisConnection.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const maxMemoryMatch = info.match(/maxmemory:(\d+)/);

    const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0;
    const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;

    // Get cache statistics
    const cacheManager = new CacheManager();
    const cacheKeys = await redisConnection.keys('apollo:*');

    health.services.redis = {
      status: 'healthy',
      responseTime: redisTime,
      details: {
        memoryUsage: usedMemory,
        maxMemory: maxMemory || undefined,
        cacheEntries: cacheKeys.length,
        connectedClients: await redisConnection.client('list').then(list => list.split('\n').length - 1),
      },
    };

    // Check memory usage
    if (maxMemory > 0 && usedMemory > maxMemory * 0.9) {
      health.services.redis.status = 'degraded';
      health.services.redis.message = 'Memory usage above 90%';
    }
  } catch (error) {
    health.services.redis = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Failed to connect to Redis',
    };
  }

  // Check Database
  try {
    const dbStart = Date.now();
    const supabase = await createClient();

    // Simple query to check connectivity
    const { data, error } = await supabase
      .from('apollo_sync_state')
      .select('id')
      .limit(1);

    const dbTime = Date.now() - dbStart;

    if (error) {
      health.services.database = {
        status: 'down',
        message: error.message,
        responseTime: dbTime,
      };
    } else {
      // Get connection pool stats if available
      health.services.database = {
        status: 'healthy',
        responseTime: dbTime,
        details: {
          // Add any available database metrics
        },
      };

      // Check response time
      if (dbTime > 1000) { // Over 1 second
        health.services.database.status = 'degraded';
        health.services.database.message = 'Slow response time';
      }
    }
  } catch (error) {
    health.services.database = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Failed to connect to database',
    };
  }

  // Check Queues
  try {
    const queues = [
      { name: 'enrichment' as const, queue: enrichmentQueue },
      { name: 'bulk' as const, queue: bulkQueue },
      { name: 'webhooks' as const, queue: webhookQueue },
      { name: 'scoring' as const, queue: scoringQueue },
    ];

    let totalWaiting = 0;
    let totalFailed = 0;
    let anyPaused = false;

    for (const { name, queue } of queues) {
      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();

      health.services.queues.details[name] = {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        paused: isPaused,
      };

      totalWaiting += counts.waiting;
      totalFailed += counts.failed;
      if (isPaused) anyPaused = true;
    }

    // Determine queue health
    if (totalFailed > 100 || totalWaiting > 1000) {
      health.services.queues.status = 'degraded';
    } else if (anyPaused) {
      health.services.queues.status = 'degraded';
    } else {
      health.services.queues.status = 'healthy';
    }
  } catch (error) {
    health.services.queues.status = 'down';
  }

  // Calculate overall health status
  const services = [
    health.services.apollo,
    health.services.redis,
    health.services.database,
    health.services.queues,
  ];

  const downCount = services.filter(s => s.status === 'down').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;

  if (downCount > 0) {
    health.status = 'down';
  } else if (degradedCount > 1) {
    health.status = 'degraded';
  }

  // Add metrics if all services are up
  if (health.services.redis.status !== 'down' && health.services.database.status !== 'down') {
    try {
      // Calculate cache hit rate (example - would need actual tracking)
      const cacheHits = await redisConnection.get('stats:cache:hits') || '0';
      const cacheMisses = await redisConnection.get('stats:cache:misses') || '0';
      const totalRequests = parseInt(cacheHits) + parseInt(cacheMisses);

      health.metrics = {
        cacheHitRate: totalRequests > 0 ? (parseInt(cacheHits) / totalRequests) : 0,
        avgResponseTime: Date.now() - startCheck,
        activeConnections: health.services.redis.details?.connectedClients || 0,
        queueBacklog: Object.values(health.services.queues.details)
          .reduce((sum, q) => sum + q.waiting, 0),
      };
    } catch (error) {
      // Metrics are optional, don't fail health check
      console.error('Failed to calculate metrics:', error);
    }
  }

  // Set appropriate HTTP status code
  const httpStatus = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : // Still return 200 for degraded
                     503; // Service unavailable for down

  // Add cache headers for monitoring tools
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Health-Status': health.status,
  };

  return NextResponse.json(health, {
    status: httpStatus,
    headers,
  });
}

// Simple health check for load balancers
export async function HEAD(request: NextRequest) {
  try {
    // Quick Redis ping
    await redisConnection.ping();
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}