'use client';

import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        expiry: entry.expiry,
        isExpired: Date.now() > entry.expiry
      }))
    };
  }
}

// Global cache instance
const cacheManager = new CacheManager();

// Hook for caching data with automatic invalidation
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    dependencies?: any[];
  } = {}
) {
  const { ttl, enabled = true, dependencies = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (useCache = true) => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Try to get from cache first
      if (useCache) {
        const cachedData = cacheManager.get<T>(key);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return cachedData;
        }
      }

      // Fetch fresh data
      const freshData = await fetcher();
      
      // Cache the result
      cacheManager.set(key, freshData, ttl);
      setData(freshData);
      
      return freshData;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl, enabled]);

  // Invalidate cache and refetch
  const invalidate = useCallback(() => {
    cacheManager.invalidate(key);
    return fetchData(false);
  }, [key, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(false),
    invalidate,
    isStale: () => {
      const entry = cacheManager.get(key);
      return !entry;
    }
  };
}

// Hook for caching lists with pagination
export function useCachedList<T>(
  baseKey: string,
  fetcher: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  options: {
    ttl?: number;
    enabled?: boolean;
    pageSize?: number;
  } = {}
) {
  const { ttl, enabled = true, pageSize = 25 } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [allItems, setAllItems] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPage = useCallback(async (page: number, useCache = true) => {
    if (!enabled) return;

    const pageKey = `${baseKey}_page_${page}_${pageSize}`;
    setLoading(true);
    setError(null);

    try {
      // Try cache first
      if (useCache) {
        const cachedData = cacheManager.get<{ items: T[]; total: number }>(pageKey);
        if (cachedData) {
          return cachedData;
        }
      }

      // Fetch fresh data
      const result = await fetcher(page, pageSize);
      
      // Cache the result
      cacheManager.set(pageKey, result, ttl);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [baseKey, fetcher, pageSize, ttl, enabled]);

  const loadPage = useCallback(async (page: number) => {
    try {
      const result = await fetchPage(page);
      if (result) {
        setAllItems(prev => {
          const newItems = [...prev];
          const startIndex = (page - 1) * pageSize;
          result.items.forEach((item, index) => {
            newItems[startIndex + index] = item;
          });
          return newItems;
        });
        setTotalItems(result.total);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    }
  }, [fetchPage, pageSize]);

  const invalidateAll = useCallback(() => {
    cacheManager.invalidatePattern(`${baseKey}_page_`);
    setAllItems([]);
    setTotalItems(0);
    loadPage(1);
  }, [baseKey, loadPage]);

  // Load initial page
  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPageItems = allItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return {
    items: currentPageItems,
    allItems,
    totalItems,
    currentPage,
    totalPages,
    loading,
    error,
    loadPage,
    invalidateAll,
    setCurrentPage: (page: number) => {
      if (page !== currentPage) {
        loadPage(page);
      }
    }
  };
}

// Hook for real-time cache invalidation
export function useCacheInvalidation() {
  const invalidateVendors = useCallback(() => {
    cacheManager.invalidatePattern('vendors');
  }, []);

  const invalidatePOs = useCallback(() => {
    cacheManager.invalidatePattern('pos');
  }, []);

  const invalidateUsers = useCallback(() => {
    cacheManager.invalidatePattern('users');
  }, []);

  const invalidateAll = useCallback(() => {
    cacheManager.clear();
  }, []);

  return {
    invalidateVendors,
    invalidatePOs,
    invalidateUsers,
    invalidateAll,
    getCacheStats: () => cacheManager.getStats()
  };
}

// Export cache manager for direct access
export { cacheManager };