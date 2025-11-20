import { RetryService } from '@/lib/services/retry.service';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

// Mock error tracking service
jest.mock('@/lib/services/error-tracking.service', () => ({
  errorTrackingService: {
    trackError: jest.fn()
  }
}));

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    retryService = new RetryService();
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      const result = await retryService.executeWithRetry(mockFn, context);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue('success');

      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      const result = await retryService.executeWithRetry(mockFn, context, {
        maxAttempts: 3,
        baseDelay: 10 // Short delay for testing
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Validation failed'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      await expect(
        retryService.executeWithRetry(mockFn, context, {
          maxAttempts: 3,
          baseDelay: 10
        })
      ).rejects.toThrow('Validation failed');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should respect maxAttempts', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Network timeout'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      await expect(
        retryService.executeWithRetry(mockFn, context, {
          maxAttempts: 2,
          baseDelay: 10
        })
      ).rejects.toThrow('Network timeout');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should use custom retry condition', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Custom error'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      const customRetryCondition = jest.fn().mockReturnValue(false);

      await expect(
        retryService.executeWithRetry(mockFn, context, {
          maxAttempts: 3,
          baseDelay: 10,
          retryCondition: customRetryCondition
        })
      ).rejects.toThrow('Custom error');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(customRetryCondition).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onRetry callback', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      await retryService.executeWithRetry(mockFn, context, {
        maxAttempts: 2,
        baseDelay: 10,
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('wrapServiceMethod', () => {
    it('should wrap method with retry logic', async () => {
      const originalMethod = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const wrappedMethod = retryService.wrapServiceMethod(
        'testService',
        'testOperation',
        originalMethod,
        { maxAttempts: 2, baseDelay: 10 }
      );

      const result = await wrappedMethod('arg1', 'arg2');

      expect(result).toBe('success');
      expect(originalMethod).toHaveBeenCalledTimes(2);
      expect(originalMethod).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should extract user context from arguments', async () => {
      const originalMethod = jest.fn().mockResolvedValue('success');
      const userContext = { uid: 'user1', role: 'admin' };

      const wrappedMethod = retryService.wrapServiceMethod(
        'testService',
        'testOperation',
        originalMethod
      );

      await wrappedMethod('arg1', userContext, 'arg3');

      expect(originalMethod).toHaveBeenCalledWith('arg1', userContext, 'arg3');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      // Trigger multiple failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithRetry(mockFn, context, {
            maxAttempts: 1,
            baseDelay: 10
          }, {
            failureThreshold: 3,
            resetTimeout: 1000
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      await expect(
        retryService.executeWithRetry(mockFn, context, {
          maxAttempts: 1,
          baseDelay: 10
        }, {
          failureThreshold: 3,
          resetTimeout: 1000
        })
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should provide circuit breaker stats', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      try {
        await retryService.executeWithRetry(mockFn, context, {
          maxAttempts: 1,
          baseDelay: 10
        });
      } catch (error) {
        // Expected to fail
      }

      const stats = retryService.getCircuitBreakerStats();
      expect(stats).toHaveProperty('testService:testOp');
      expect(stats['testService:testOp']).toHaveProperty('state');
      expect(stats['testService:testOp']).toHaveProperty('failures');
    });

    it('should reset circuit breaker', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      // Cause some failures
      for (let i = 0; i < 3; i++) {
        try {
          await retryService.executeWithRetry(mockFn, context, {
            maxAttempts: 1,
            baseDelay: 10
          }, {
            failureThreshold: 2,
            resetTimeout: 1000
          });
        } catch (error) {
          // Expected to fail
        }
      }

      const resetResult = retryService.resetCircuitBreaker('testService:testOp');
      expect(resetResult).toBe(true);

      const stats = retryService.getCircuitBreakerStats();
      expect(stats['testService:testOp'].state).toBe('closed');
      expect(stats['testService:testOp'].failures).toBe(0);
    });
  });

  describe('getRetryStats', () => {
    it('should return retry statistics', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      await retryService.executeWithRetry(mockFn, context);

      const stats = retryService.getRetryStats();
      expect(stats).toHaveProperty('circuitBreakers');
      expect(stats).toHaveProperty('totalCircuitBreakers');
      expect(stats).toHaveProperty('openCircuitBreakers');
      expect(stats).toHaveProperty('halfOpenCircuitBreakers');
      expect(stats.totalCircuitBreakers).toBeGreaterThan(0);
    });
  });

  describe('delay calculation', () => {
    it('should calculate exponential backoff delay', async () => {
      const delays: number[] = [];
      const mockFn = jest.fn().mockRejectedValue(new Error('Network timeout'));
      const context = {
        operation: 'testOp',
        service: 'testService'
      };

      const startTime = Date.now();

      try {
        await retryService.executeWithRetry(mockFn, context, {
          maxAttempts: 3,
          baseDelay: 100,
          backoffMultiplier: 2,
          jitter: false, // Disable jitter for predictable testing
          onRetry: (attempt) => {
            delays.push(Date.now() - startTime);
          }
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify exponential backoff (approximately)
      expect(delays.length).toBe(2); // 2 retries
      expect(delays[0]).toBeGreaterThanOrEqual(100); // First retry after ~100ms
      expect(delays[1]).toBeGreaterThanOrEqual(300); // Second retry after ~200ms more
    });
  });
});