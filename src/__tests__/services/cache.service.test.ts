import { CacheService } from '@/lib/services/cache.service';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService({
      ttl: 1000, // 1 second for testing
      maxSize: 3
    });
  });

  afterEach(() => {
    cacheService.destroy();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      const testData = { id: '1', name: 'test' };
      cacheService.set('test-key', testData);
      
      const result = cacheService.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = cacheService.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      cacheService.set('test-key', 'test-value');
      
      expect(cacheService.has('test-key')).toBe(true);
      expect(cacheService.has('non-existent')).toBe(false);
    });

    it('should delete keys', () => {
      cacheService.set('test-key', 'test-value');
      expect(cacheService.has('test-key')).toBe(true);
      
      const deleted = cacheService.delete('test-key');
      expect(deleted).toBe(true);
      expect(cacheService.has('test-key')).toBe(false);
    });

    it('should clear all entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      expect(cacheService.size()).toBe(2);
      
      cacheService.clear();
      expect(cacheService.size()).toBe(0);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', (done) => {
      cacheService.set('test-key', 'test-value', 100); // 100ms TTL
      
      expect(cacheService.get('test-key')).toBe('test-value');
      
      setTimeout(() => {
        expect(cacheService.get('test-key')).toBeNull();
        done();
      }, 150);
    });

    it('should use default TTL when not specified', () => {
      cacheService.set('test-key', 'test-value');
      expect(cacheService.has('test-key')).toBe(true);
    });
  });

  describe('size management', () => {
    it('should evict oldest entry when max size reached', () => {
      // Fill cache to max size
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      expect(cacheService.size()).toBe(3);
      
      // Add one more to trigger eviction
      cacheService.set('key4', 'value4');
      expect(cacheService.size()).toBe(3);
      
      // Oldest entry should be evicted
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key4')).toBe(true);
    });
  });

  describe('pattern invalidation', () => {
    it('should invalidate entries matching pattern', () => {
      cacheService.set('user:1', { id: 1, name: 'John' });
      cacheService.set('user:2', { id: 2, name: 'Jane' });
      cacheService.set('post:1', { id: 1, title: 'Test Post' });
      
      const invalidated = cacheService.invalidatePattern('user:');
      expect(invalidated).toBe(2);
      
      expect(cacheService.has('user:1')).toBe(false);
      expect(cacheService.has('user:2')).toBe(false);
      expect(cacheService.has('post:1')).toBe(true);
    });

    it('should handle regex patterns', () => {
      cacheService.set('users:list:page1', []);
      cacheService.set('users:list:page2', []);
      cacheService.set('users:detail:1', {});
      
      const invalidated = cacheService.invalidatePattern('users:list:');
      expect(invalidated).toBe(2);
      
      expect(cacheService.has('users:detail:1')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should return cache statistics', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      
      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.maxSize).toBe(3);
    });

    it('should count expired entries in stats', (done) => {
      cacheService.set('key1', 'value1', 50); // Short TTL
      cacheService.set('key2', 'value2', 5000); // Long TTL
      
      setTimeout(() => {
        const stats = cacheService.getStats();
        expect(stats.totalEntries).toBe(2);
        expect(stats.validEntries).toBe(1);
        expect(stats.expiredEntries).toBe(1);
        done();
      }, 100);
    });
  });

  describe('keys method', () => {
    it('should return all cache keys', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      
      const keys = cacheService.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });
});