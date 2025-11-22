import { logger } from '../logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || this.defaultTTL;
    this.maxSize = options.maxSize || this.maxSize;
    
    // Start cleanup interval
    this.startCleanup();
  }

  private startCleanup() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
  * Removes expired entries from the cache and logs the cleanup.
  * @example
  * this.cleanup()
  * undefined
  * @returns {{void}} Undefined.
  **/
  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    if (keysToDelete.length > 0) {
      logger.debug(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  /**/ **
  * Removes the oldest entry from the cache if one exists.
  * @example
  * evictOldest()
  * undefined
  * @returns {void} Void return since the method only mutates internal cache state.
  **/*/
  private evictOldest() {
    if (this.cache.size === 0) return;

    // Find the oldest entry
    let oldestKey = '';
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`Cache eviction: removed oldest entry ${oldestKey}`);
    }
  }

  /**
  * Stores a value in the cache under the given key, evicting the oldest entry if needed.
  * @example
  * et('session', sessionData, 3600)
  * undefined
  * @param {{string}} key - Key under which to store the data in the cache.
  * @param {{T}} data - Value to cache for the provided key.
  * @param {{number}} [ttl] - Optional time-to-live for the cached entry in seconds.
  * @returns {{void}} Returns nothing.
  **/
  set<T>(key: string, data: T, ttl?: number): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key}`);
  }

  /**
  * Retrieves a cached entry by key while validating its TTL to avoid serving expired data.
  * @example
  * et<MyData>('config')
  * { id: 1, name: 'config' }
  * @param {{string}} {{key}} - Cache key to retrieve the stored value.
  * @returns {{T | null}} Cached value for the key or null if missing or expired.
  **/
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.data;
  }

  /**
  * Checks whether a cache entry for the provided key exists and is not expired.
  * @example
  * as("userSession")
  * true
  * @param {{string}} {{key}} - Cache key to validate.
  * @returns {{boolean}} True if the entry exists and is still within its TTL.
  **/
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      logger.debug(`Cache delete: ${key}`);
    }
    return result;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache cleared: ${size} entries removed`);
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache statistics
  /**
  * Provides statistics about the cache contents.
  * @example
  * etStats()
  * { totalEntries: 10, validEntries: 7, expiredEntries: 3, maxSize: 100, defaultTTL: 60000 }
  * @returns {{Object}} Summary of cache statistics including total, valid, expired counts, maximum size, and default TTL.
  **/
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL
    };
  }

  // Invalidate cache entries by pattern
  /**
  * Invalidates cache entries whose keys match the provided regex pattern.
  * @example
  * nvalidatePattern('^user:')
  * 5
  * @param {{string}} {{pattern}} - Regex pattern to match cache keys for invalidation.
  * @returns {{number}} Number of cache entries removed.
  **/
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    logger.debug(`Cache pattern invalidation: removed ${keysToDelete.length} entries matching ${pattern}`);
    return keysToDelete.length;
  }

  // Destroy the cache service
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Global cache instance
export const cacheService = new CacheService({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000
});