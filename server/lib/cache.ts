// Production-ready caching system for Canvas data and database queries
import { logger } from './logger';

interface CacheItem<T> {
  value: T;
  expiry: number;
  lastAccess: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
  cleanupInterval?: number; // Cleanup interval in milliseconds
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private cleanupTimer?: NodeJS.Timeout;
  private hitCount = 0;
  private missCount = 0;

  constructor(private options: CacheOptions = {}) {
    const { cleanupInterval = 300000 } = options; // 5 minutes default
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupInterval);
  }

  set(key: string, value: T, customTtl?: number): void {
    const ttl = customTtl || this.options.ttl || 3600000; // 1 hour default
    const now = Date.now();
    
    this.cache.set(key, {
      value,
      expiry: now + ttl,
      lastAccess: now,
    });

    // Enforce max size
    if (this.options.maxSize && this.cache.size > this.options.maxSize) {
      this.evictOldest();
    }

    logger.debug('Cache', `Set key: ${key}`, { size: this.cache.size });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    const now = Date.now();

    if (!item) {
      this.missCount++;
      logger.debug('Cache', `Miss: ${key}`, { hitRate: this.getHitRate() });
      return null;
    }

    if (item.expiry < now) {
      this.cache.delete(key);
      this.missCount++;
      logger.debug('Cache', `Expired: ${key}`, { hitRate: this.getHitRate() });
      return null;
    }

    // Update last access time
    item.lastAccess = now;
    this.hitCount++;
    logger.debug('Cache', `Hit: ${key}`, { hitRate: this.getHitRate() });
    return item.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache', `Deleted key: ${key}`, { size: this.cache.size });
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cache', 'Cache cleared');
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    this.cache.forEach((item, key) => {
      if (item.expiry < now) {
        this.cache.delete(key);
        evicted++;
      }
    });

    if (evicted > 0) {
      logger.debug('Cache', `Cleanup evicted ${evicted} expired items`, { 
        remainingSize: this.cache.size 
      });
    }
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestAccess = Date.now();

    this.cache.forEach((item, key) => {
      if (item.lastAccess < oldestAccess) {
        oldestAccess = item.lastAccess;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Cache', `Evicted oldest key: ${oldestKey}`);
    }
  }

  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
    };
  }

  private getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? (this.hitCount / total) * 100 : 0;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
    logger.info('Cache', 'Cache destroyed');
  }
}

// Global cache instances for different data types
export const canvasCache = new MemoryCache<any>({
  ttl: 1800000, // 30 minutes for Canvas data
  maxSize: 1000,
  cleanupInterval: 300000, // 5 minutes
});

export const assignmentCache = new MemoryCache<any>({
  ttl: 300000, // 5 minutes for assignments
  maxSize: 500,
  cleanupInterval: 60000, // 1 minute
});

export const scheduleCache = new MemoryCache<any>({
  ttl: 900000, // 15 minutes for schedules
  maxSize: 200,
  cleanupInterval: 180000, // 3 minutes
});

// Graceful shutdown cleanup
process.on('SIGTERM', () => {
  logger.info('Cache', 'Shutting down caches...');
  canvasCache.destroy();
  assignmentCache.destroy();
  scheduleCache.destroy();
});

process.on('SIGINT', () => {
  logger.info('Cache', 'Shutting down caches...');
  canvasCache.destroy();
  assignmentCache.destroy();
  scheduleCache.destroy();
});

// Cache statistics endpoint helper
export function getAllCacheStats() {
  return {
    canvas: canvasCache.getStats(),
    assignments: assignmentCache.getStats(),
    schedules: scheduleCache.getStats(),
  };
}