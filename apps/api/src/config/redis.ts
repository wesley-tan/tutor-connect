import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client with graceful fallback
export const redis = new Redis(REDIS_URL, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  // Connection timeout
  connectTimeout: 5000,
  commandTimeout: 3000,
  // Graceful handling of connection failures
  maxRetriesPerRequest: 1,
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false,
});

// Event handlers
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

// Helper functions for common operations
export const redisHelpers = {
  // Session management
  async setSession(sessionId: string, data: any, expireInSeconds: number = 604800) {
    return await redis.setex(`session:${sessionId}`, expireInSeconds, JSON.stringify(data));
  },

  async getSession(sessionId: string) {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  async deleteSession(sessionId: string) {
    return await redis.del(`session:${sessionId}`);
  },

  // Rate limiting
  async incrementRateLimit(key: string, windowMs: number) {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    const results = await pipeline.exec();
    return results?.[0]?.[1] as number || 0;
  },

  // Caching
  async cache(key: string, data: any, expireInSeconds: number = 3600) {
    return await redis.setex(key, expireInSeconds, JSON.stringify(data));
  },

  async getCache(key: string) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async deleteCache(key: string) {
    return await redis.del(key);
  },

  // Pub/Sub for real-time features
  async publish(channel: string, message: any) {
    return await redis.publish(channel, JSON.stringify(message));
  }
};

export default redis; 