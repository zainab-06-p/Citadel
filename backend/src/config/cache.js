/**
 * Redis Cache Configuration
 * 
 * Provides caching layer for:
 * - Credit scores (TTL: 1 hour)
 * - Worker profiles (TTL: 30 minutes)
 * - Contract data (TTL: 15 minutes)
 * - Top performers (TTL: 10 minutes)
 * 
 * Falls back to in-memory Map if Redis is not available
 */

// Simple in-memory cache implementation (fallback when Redis unavailable)
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key, value, ttlSeconds) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
    
    // Auto-cleanup after TTL
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);
    
    this.timers.set(key, timer);
    return true;
  }

  async del(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  async flush() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
    return true;
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Try to use Redis if available, otherwise fall back to memory cache
let cache = new MemoryCache();
let cacheMode = 'memory';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const shouldUseRedis = Boolean(redisUrl || redisHost);

if (shouldUseRedis) {
  try {
    const Redis = require('ioredis');
    const redis = redisUrl
      ? new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5000,
          retryStrategy: () => null,
          reconnectOnError: () => false,
        })
      : new Redis({
          host: redisHost,
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD,
          db: Number(process.env.REDIS_DB || 0),
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5000,
          retryStrategy: () => null,
          reconnectOnError: () => false,
        });

    let fallbackLogged = false;
    const fallbackToMemory = (reason) => {
      if (!fallbackLogged) {
        console.warn('Redis unavailable, using in-memory cache:', reason || 'unknown reason');
        fallbackLogged = true;
      }

      cache = new MemoryCache();
      cacheMode = 'memory';
      try {
        redis.disconnect();
      } catch {
        // no-op
      }
    };

    redis.once('ready', () => {
      cache = redis;
      cacheMode = 'redis';
      console.log('Connected to Redis cache');
    });

    redis.once('error', (err) => {
      fallbackToMemory(err?.message);
    });

    redis.once('end', () => {
      if (cacheMode !== 'memory') {
        fallbackToMemory('connection closed');
      }
    });
  } catch (error) {
    console.warn('Redis client init failed, using in-memory cache:', error.message);
  }
} else {
  console.log('Redis not configured, using in-memory cache');
}

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  CREDIT_SCORE: 3600,        // 1 hour
  WORKER_PROFILE: 1800,      // 30 minutes
  CONTRACT_DATA: 900,        // 15 minutes
  TOP_PERFORMERS: 600,       // 10 minutes
  CONTRACTOR_STATS: 1800,    // 30 minutes
  DASHBOARD_STATS: 300       // 5 minutes
};

// Cache key generators
const CacheKeys = {
  creditScore: (workerAddress) => `credit_score:${workerAddress}`,
  workerProfile: (workerAddress) => `worker_profile:${workerAddress}`,
  contractData: (appId) => `contract:${appId}`,
  topPerformers: (limit) => `top_performers:${limit}`,
  contractorStats: (address) => `contractor_stats:${address}`,
  dashboardStats: () => 'dashboard:stats'
};

/**
 * Cache wrapper with automatic serialization
 */
const cacheWrapper = {
  async get(key) {
    try {
      const data = await cache.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(key, value, ttl) {
    try {
      const serialized = JSON.stringify(value);

      if (cacheMode === 'redis') {
        await cache.set(key, serialized, 'EX', ttl);
      } else {
        await cache.set(key, serialized, ttl);
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  async del(key) {
    try {
      await cache.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  },

  async flush() {
    try {
      await cache.flush();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  },

  getStats() {
    if (cache.getStats) {
      return cache.getStats();
    }
    return { type: cacheMode, status: cacheMode === 'redis' ? 'connected' : 'fallback-memory' };
  }
};

module.exports = {
  cache: cacheWrapper,
  CACHE_TTL,
  CacheKeys,
  MemoryCache
};
