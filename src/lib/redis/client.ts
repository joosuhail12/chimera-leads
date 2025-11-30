import { Redis } from 'ioredis';

// Redis client singleton
let redis: Redis | null = null;

export interface RedisConfig {
  connection: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queues: {
    enrichment: string;
    bulk: string;
    webhooks: string;
    scoring: string;
  };
  cache: {
    ttl: {
      search: number;      // 1 hour for search results
      person: number;      // 24 hours for person data
      company: number;     // 24 hours for company data
      score: number;       // 2 hours for AI scores
      list: number;        // 6 hours for list data
    };
  };
}

export const redisConfig: RedisConfig = {
  connection: {
    host: process.env.REDIS_HOST || process.env.BULL_REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || process.env.BULL_REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  queues: {
    enrichment: 'apollo-enrichment',
    bulk: 'apollo-bulk',
    webhooks: 'apollo-webhooks',
    scoring: 'ai-scoring',
  },
  cache: {
    ttl: {
      search: 3600,      // 1 hour
      person: 86400,     // 24 hours
      company: 86400,    // 24 hours
      score: 7200,       // 2 hours
      list: 21600,       // 6 hours
    },
  },
};

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redis) {
    // Support both standalone Redis and AWS ElastiCache
    const isElastiCache = process.env.REDIS_HOST?.includes('cache.amazonaws.com');

    const connectionOptions: any = {
      host: redisConfig.connection.host,
      port: redisConfig.connection.port,
      password: redisConfig.connection.password,
      db: redisConfig.connection.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    };

    // ElastiCache specific settings
    if (isElastiCache) {
      connectionOptions.tls = process.env.REDIS_TLS === 'true' ? {} : undefined;
      connectionOptions.lazyConnect = true;
      connectionOptions.reconnectOnError = (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      };
    }

    redis = new Redis(connectionOptions);

    redis.on('error', (error) => {
      console.error('Redis Client Error:', error);
    });

    redis.on('connect', () => {
      console.log('Redis Client Connected');
    });

    redis.on('ready', () => {
      console.log('Redis Client Ready');
    });
  }

  return redis;
}

/**
 * Cache helper functions
 */
export class CacheManager {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      return 0;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Generate cache key with namespace
   */
  static generateKey(namespace: string, ...parts: (string | number)[]): string {
    return `${namespace}:${parts.join(':')}`;
  }
}

/**
 * Rate limiter using Redis
 */
export class RateLimiter {
  private redis: Redis;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 60) {
    this.redis = getRedisClient();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request is allowed and increment counter
   */
  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(key, '-inf', windowStart);

      // Count requests in current window
      const count = await this.redis.zcard(key);

      if (count < this.maxRequests) {
        // Add current request
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        await this.redis.expire(key, Math.ceil(this.windowMs / 1000));

        return {
          allowed: true,
          remaining: this.maxRequests - count - 1,
          resetAt: new Date(now + this.windowMs),
        };
      }

      // Get oldest request timestamp to calculate reset time
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldestRequest.length > 1
        ? new Date(parseInt(oldestRequest[1]) + this.windowMs)
        : new Date(now + this.windowMs);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Allow request on error to avoid blocking users
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetAt: new Date(now + this.windowMs),
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `rate_limit:${identifier}`;
    await this.redis.del(key);
  }
}

/**
 * Cleanup function for graceful shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Export a lazy-initialized redis connection for direct usage
 * Use getRedisClient() for more control over initialization
 */
export const redisConnection = {
  get client() {
    return getRedisClient();
  },
  ping: () => getRedisClient().ping(),
  info: (section?: string) => section ? getRedisClient().info(section) : getRedisClient().info(),
  keys: (pattern: string) => getRedisClient().keys(pattern),
  get: (key: string) => getRedisClient().get(key),
  set: (key: string, value: string) => getRedisClient().set(key, value),
  del: (...keys: string[]) => getRedisClient().del(...keys),
  clientCommand: (subcommand: string) => (getRedisClient() as unknown as { client: (cmd: string) => unknown }).client(subcommand),
};