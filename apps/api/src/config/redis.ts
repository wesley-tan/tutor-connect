import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL;

// Create Redis client only if URL is provided and not empty
let redis: Redis | null = null;

if (REDIS_URL && REDIS_URL.trim() !== '') {
  try {
    redis = new Redis(REDIS_URL, {
  retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
  // Connection timeout
  connectTimeout: 5000,
  commandTimeout: 3000,
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false,
});

    // Event handlers - only add if redis client exists
redis.on('connect', () => {
  logger.info('📦 Redis: Connected');
});

redis.on('ready', () => {
  logger.info('📦 Redis: Ready');
});

redis.on('error', (error) => {
  logger.error('📦 Redis: Error -', error);
});

redis.on('close', () => {
  logger.warn('📦 Redis: Connection closed');
});

redis.on('reconnecting', (delay) => {
  logger.info(`📦 Redis: Reconnecting in ${delay}ms`);
});

redis.on('end', () => {
  logger.warn('📦 Redis: Connection ended');
});
  } catch (error) {
    logger.warn('Redis connection failed, running without Redis');
    redis = null;
  }
} else {
  logger.info('Redis URL not provided, running without Redis');
}

// Helper functions for common operations
export const redisHelpers = {
  // Session management
  async setSession(sessionId: string, data: any, expireInSeconds: number = 604800) {
    if (!redis) return null;
    try {
    return await redis.setex(`session:${sessionId}`, expireInSeconds, JSON.stringify(data));
    } catch (error) {
      logger.warn('Redis setSession failed:', error);
      return null;
    }
  },

  async getSession(sessionId: string) {
    if (!redis) return null;
    try {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Redis getSession failed:', error);
      return null;
    }
  },

  async deleteSession(sessionId: string) {
    if (!redis) return null;
    try {
    return await redis.del(`session:${sessionId}`);
    } catch (error) {
      logger.warn('Redis deleteSession failed:', error);
      return null;
    }
  },

  // Rate limiting
  async incrementRateLimit(key: string, windowMs: number) {
    if (!redis) return 0;
    try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    const results = await pipeline.exec();
    return results?.[0]?.[1] as number || 0;
    } catch (error) {
      logger.warn('Redis incrementRateLimit failed:', error);
      return 0;
    }
  },

  // Caching
  async cache(key: string, data: any, expireInSeconds: number = 3600) {
    if (!redis) return null;
    try {
    return await redis.setex(key, expireInSeconds, JSON.stringify(data));
    } catch (error) {
      logger.warn('Redis cache failed:', error);
      return null;
    }
  },

  async getCache(key: string) {
    if (!redis) return null;
    try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Redis getCache failed:', error);
      return null;
    }
  },

  async deleteCache(key: string) {
    if (!redis) return null;
    try {
    return await redis.del(key);
    } catch (error) {
      logger.warn('Redis deleteCache failed:', error);
      return null;
    }
  },

  // Pub/Sub for real-time features
  async publish(channel: string, message: any) {
    if (!redis) return null;
    try {
    return await redis.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.warn('Redis publish failed:', error);
      return null;
    }
  }
};

export { redis };
export default redis; 