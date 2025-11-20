import { PerformanceService } from '@/lib/services/performance.service';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('PerformanceService', () => {
  let performanceService: PerformanceService;

  beforeEach(() => {
    performanceService = new PerformanceService();
  });

  describe('measurePerformance', () => {
    it('should measure successful operation performance', async () => {
      const mockFn = jest.fn().mockResolvedValue({ success: true, data: 'test' });
      const wrappedFn = performanceService.measurePerformance('testService', 'testOperation', mockFn);

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toEqual({ success: true, data: 'test' });
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');

      const stats = performanceService.getStats('testService');
      expect(stats.totalOperations).toBe(1);
      expect(stats.successRate).toBe(100);
    });

    it('should measure failed operation performance', async () => {
      const mockFn = jest.fn().mockResolvedValue({ success: false, error: 'Test error' });
      const wrappedFn = performanceService.measurePerformance('testService', 'testOperation', mockFn);

      const result = await wrappedFn();

      expect(result).toEqual({ success: false, error: 'Test error' });

      const stats = performanceService.getStats('testService');
      expect(stats.totalOperations).toBe(1);
      expect(stats.successRate).toBe(0);
      expect(stats.errorRate).toBe(100);
    });

    it('should handle thrown exceptions', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test exception'));
      const wrappedFn = performanceService.measurePerformance('testService', 'testOperation', mockFn);

      await expect(wrappedFn()).rejects.toThrow('Test exception');

      const stats = performanceService.getStats('testService');
      expect(stats.totalOperations).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should measure operation duration', async () => {
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      const wrappedFn = performanceService.measurePerformance('testService', 'testOperation', mockFn);

      await wrappedFn();

      const stats = performanceService.getStats('testService');
      expect(stats.averageDuration).toBeGreaterThan(90); // Should be around 100ms
    });
  });

  describe('recordMetric', () => {
    it('should record performance metrics', () => {
      const metric = {
        operation: 'testOp',
        service: 'testService',
        duration: 150,
        timestamp: new Date(),
        success: true
      };

      performanceService.recordMetric(metric);

      const stats = performanceService.getStats('testService');
      expect(stats.totalOperations).toBe(1);
      expect(stats.averageDuration).toBe(150);
    });

    it('should limit stored metrics', () => {
      // Create a service with small max metrics for testing
      const smallPerformanceService = new (class extends PerformanceService {
        constructor() {
          super();
          (this as any).maxMetrics = 3;
        }
      })();

      // Add more metrics than the limit
      for (let i = 0; i < 5; i++) {
        smallPerformanceService.recordMetric({
          operation: `op${i}`,
          service: 'testService',
          duration: 100,
          timestamp: new Date(),
          success: true
        });
      }

      const exportedMetrics = smallPerformanceService.exportMetrics();
      expect(exportedMetrics.length).toBe(3);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Add some test metrics
      performanceService.recordMetric({
        operation: 'op1',
        service: 'service1',
        duration: 100,
        timestamp: new Date(),
        success: true,
        cacheHit: true
      });

      performanceService.recordMetric({
        operation: 'op2',
        service: 'service1',
        duration: 200,
        timestamp: new Date(),
        success: false,
        error: 'Test error'
      });

      performanceService.recordMetric({
        operation: 'op3',
        service: 'service2',
        duration: 150,
        timestamp: new Date(),
        success: true
      });
    });

    it('should calculate overall stats', () => {
      const stats = performanceService.getStats();
      
      expect(stats.totalOperations).toBe(3);
      expect(stats.averageDuration).toBe(150); // (100 + 200 + 150) / 3
      expect(stats.successRate).toBe(66.67); // 2/3 * 100, rounded
      expect(stats.errorRate).toBe(33.33); // 1/3 * 100, rounded
      expect(stats.cacheHitRate).toBe(33.33); // 1/3 * 100, rounded
    });

    it('should filter stats by service', () => {
      const stats = performanceService.getStats('service1');
      
      expect(stats.totalOperations).toBe(2);
      expect(stats.averageDuration).toBe(150); // (100 + 200) / 2
      expect(stats.successRate).toBe(50); // 1/2 * 100
    });

    it('should filter stats by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const stats = performanceService.getStats(undefined, {
        start: oneHourAgo,
        end: oneHourFromNow
      });

      expect(stats.totalOperations).toBe(3); // All metrics should be within range
    });

    it('should return empty stats for no metrics', () => {
      const stats = performanceService.getStats('nonexistent');
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should return slowest operations', () => {
      const stats = performanceService.getStats();
      
      expect(stats.slowestOperations).toHaveLength(3);
      expect(stats.slowestOperations[0].duration).toBe(200); // Slowest first
      expect(stats.slowestOperations[1].duration).toBe(150);
      expect(stats.slowestOperations[2].duration).toBe(100);
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors', () => {
      performanceService.recordMetric({
        operation: 'op1',
        service: 'service1',
        duration: 100,
        timestamp: new Date(),
        success: false,
        error: 'Error 1'
      });

      performanceService.recordMetric({
        operation: 'op2',
        service: 'service1',
        duration: 100,
        timestamp: new Date(),
        success: true
      });

      performanceService.recordMetric({
        operation: 'op3',
        service: 'service1',
        duration: 100,
        timestamp: new Date(),
        success: false,
        error: 'Error 2'
      });

      const errors = performanceService.getRecentErrors(5);
      expect(errors).toHaveLength(2);
      expect(errors[0].error).toBe('Error 2'); // Most recent first
      expect(errors[1].error).toBe('Error 1');
    });
  });

  describe('getOperationsByDuration', () => {
    it('should return operations above duration threshold', () => {
      performanceService.recordMetric({
        operation: 'fast',
        service: 'service1',
        duration: 50,
        timestamp: new Date(),
        success: true
      });

      performanceService.recordMetric({
        operation: 'slow',
        service: 'service1',
        duration: 1500,
        timestamp: new Date(),
        success: true
      });

      const slowOps = performanceService.getOperationsByDuration(1000);
      expect(slowOps).toHaveLength(1);
      expect(slowOps[0].operation).toBe('slow');
    });
  });

  describe('getCacheStats', () => {
    it('should calculate cache statistics', () => {
      performanceService.recordMetric({
        operation: 'findById',
        service: 'service1',
        duration: 100,
        timestamp: new Date(),
        success: true,
        cacheHit: true
      });

      performanceService.recordMetric({
        operation: 'findMany',
        service: 'service1',
        duration: 200,
        timestamp: new Date(),
        success: true,
        cacheHit: false
      });

      performanceService.recordMetric({
        operation: 'create',
        service: 'service1',
        duration: 150,
        timestamp: new Date(),
        success: true
      });

      const cacheStats = performanceService.getCacheStats();
      expect(cacheStats.totalQueries).toBe(2); // Only find operations
      expect(cacheStats.cacheHits).toBe(1);
      expect(cacheStats.cacheMisses).toBe(1);
      expect(cacheStats.hitRate).toBe(50);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      performanceService.recordMetric({
        operation: 'op1',
        service: 'service1',
        duration: 100,
        timestamp: new Date(),
        success: true
      });

      expect(performanceService.getStats().totalOperations).toBe(1);

      performanceService.clearMetrics();

      expect(performanceService.getStats().totalOperations).toBe(0);
    });
  });
});