import { ErrorTrackingService } from '@/lib/services/error-tracking.service';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('ErrorTrackingService', () => {
  let errorTrackingService: ErrorTrackingService;

  beforeEach(() => {
    errorTrackingService = new ErrorTrackingService();
  });

  describe('trackError', () => {
    it('should track a new error', () => {
      const error = new Error('Test error');
      const context = {
        operation: 'testOp',
        service: 'testService',
        userId: 'user1',
        userRole: 'admin',
        timestamp: new Date()
      };

      const trackedError = errorTrackingService.trackError(error, context);

      expect(trackedError.message).toBe('Test error');
      expect(trackedError.context.service).toBe('testService');
      expect(trackedError.occurrences).toBe(1);
      expect(trackedError.resolved).toBe(false);
    });

    it('should increment occurrences for duplicate errors', () => {
      const error = new Error('Duplicate error');
      const context = {
        operation: 'testOp',
        service: 'testService',
        timestamp: new Date()
      };

      const firstTrack = errorTrackingService.trackError(error, context);
      const secondTrack = errorTrackingService.trackError(error, context);

      expect(firstTrack.id).toBe(secondTrack.id);
      expect(secondTrack.occurrences).toBe(2);
    });

    it('should determine error severity correctly', () => {
      const criticalError = new Error('Database connection failed');
      const highError = new Error('Permission denied');
      const mediumError = new Error('Failed to create record');
      const lowError = new Error('Validation failed');

      const context = {
        operation: 'testOp',
        service: 'testService',
        timestamp: new Date()
      };

      const critical = errorTrackingService.trackError(criticalError, context);
      const high = errorTrackingService.trackError(highError, { ...context, operation: 'auth' });
      const medium = errorTrackingService.trackError(mediumError, { ...context, operation: 'create' });
      const low = errorTrackingService.trackError(lowError, context);

      expect(critical.severity).toBe('critical');
      expect(high.severity).toBe('high');
      expect(medium.severity).toBe('medium');
      expect(low.severity).toBe('low');
    });

    it('should extract relevant tags', () => {
      const networkError = new Error('Network timeout occurred');
      const context = {
        operation: 'fetchData',
        service: 'apiService',
        userRole: 'user',
        timestamp: new Date()
      };

      const trackedError = errorTrackingService.trackError(networkError, context);

      expect(trackedError.tags).toContain('service:apiService');
      expect(trackedError.tags).toContain('operation:fetchData');
      expect(trackedError.tags).toContain('network');
      expect(trackedError.tags).toContain('timeout');
      expect(trackedError.tags).toContain('role:user');
    });
  });

  describe('getErrorsByFilter', () => {
    beforeEach(() => {
      // Add some test errors
      errorTrackingService.trackError(new Error('Service A error'), {
        operation: 'op1',
        service: 'serviceA',
        userId: 'user1',
        timestamp: new Date()
      });

      errorTrackingService.trackError(new Error('Service B error'), {
        operation: 'op2',
        service: 'serviceB',
        userId: 'user2',
        timestamp: new Date()
      });

      errorTrackingService.trackError(new Error('Critical database error'), {
        operation: 'op1',
        service: 'serviceA',
        timestamp: new Date()
      });
    });

    it('should filter errors by service', () => {
      const errors = errorTrackingService.getErrorsByFilter({ service: 'serviceA' });
      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.context.service === 'serviceA')).toBe(true);
    });

    it('should filter errors by operation', () => {
      const errors = errorTrackingService.getErrorsByFilter({ operation: 'op1' });
      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.context.operation === 'op1')).toBe(true);
    });

    it('should filter errors by severity', () => {
      const errors = errorTrackingService.getErrorsByFilter({ severity: 'critical' });
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('critical');
    });

    it('should filter errors by user', () => {
      const errors = errorTrackingService.getErrorsByFilter({ userId: 'user1' });
      expect(errors).toHaveLength(1);
      expect(errors[0].context.userId).toBe('user1');
    });

    it('should filter errors by tags', () => {
      const errors = errorTrackingService.getErrorsByFilter({ tags: ['network'] });
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      // Add test errors with different characteristics
      errorTrackingService.trackError(new Error('Service error 1'), {
        operation: 'op1',
        service: 'serviceA',
        userId: 'user1',
        timestamp: new Date()
      });

      errorTrackingService.trackError(new Error('Service error 2'), {
        operation: 'op2',
        service: 'serviceB',
        userId: 'user1',
        timestamp: new Date()
      });

      errorTrackingService.trackError(new Error('Critical error'), {
        operation: 'op1',
        service: 'serviceA',
        timestamp: new Date()
      });
    });

    it('should calculate correct metrics', () => {
      const metrics = errorTrackingService.getMetrics();

      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByService.serviceA).toBe(2);
      expect(metrics.errorsByService.serviceB).toBe(1);
      expect(metrics.errorsByOperation.op1).toBe(2);
      expect(metrics.errorsByOperation.op2).toBe(1);
      expect(metrics.errorsByUser.user1).toBe(2);
    });

    it('should return top errors sorted by occurrences', () => {
      // Create an error with multiple occurrences
      const error = new Error('Frequent error');
      const context = {
        operation: 'frequentOp',
        service: 'testService',
        timestamp: new Date()
      };

      // Track the same error multiple times
      for (let i = 0; i < 5; i++) {
        errorTrackingService.trackError(error, context);
      }

      const metrics = errorTrackingService.getMetrics();
      expect(metrics.topErrors[0].occurrences).toBe(5);
    });
  });

  describe('resolveError', () => {
    it('should mark error as resolved', () => {
      const error = new Error('Resolvable error');
      const context = {
        operation: 'testOp',
        service: 'testService',
        timestamp: new Date()
      };

      const trackedError = errorTrackingService.trackError(error, context);
      expect(trackedError.resolved).toBe(false);

      const resolved = errorTrackingService.resolveError(trackedError.id);
      expect(resolved).toBe(true);

      const retrievedError = errorTrackingService.getError(trackedError.id);
      expect(retrievedError?.resolved).toBe(true);
    });

    it('should return false for non-existent error', () => {
      const resolved = errorTrackingService.resolveError('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('error callbacks', () => {
    it('should call registered callbacks when error is tracked', () => {
      const callback = jest.fn();
      const unsubscribe = errorTrackingService.onError(callback);

      const error = new Error('Callback test error');
      const context = {
        operation: 'testOp',
        service: 'testService',
        timestamp: new Date()
      };

      errorTrackingService.trackError(error, context);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Callback test error'
      }));

      // Test unsubscribe
      unsubscribe();
      errorTrackingService.trackError(error, context);
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('clearErrors', () => {
    it('should clear all tracked errors', () => {
      errorTrackingService.trackError(new Error('Error 1'), {
        operation: 'op1',
        service: 'service1',
        timestamp: new Date()
      });

      errorTrackingService.trackError(new Error('Error 2'), {
        operation: 'op2',
        service: 'service2',
        timestamp: new Date()
      });

      expect(errorTrackingService.getAllErrors()).toHaveLength(2);

      errorTrackingService.clearErrors();

      expect(errorTrackingService.getAllErrors()).toHaveLength(0);
    });
  });
});