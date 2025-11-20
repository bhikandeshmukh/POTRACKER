import { logger } from '../logger';

interface PerformanceMetric {
  operation: string;
  service: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  cacheHit?: boolean;
  error?: string;
}

interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  successRate: number;
  cacheHitRate: number;
  slowestOperations: PerformanceMetric[];
  errorRate: number;
}

export class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  // Decorator for measuring performance
  measurePerformance<T extends any[], R>(
    service: string,
    operation: string,
    fn: (...args: T) => Promise<R>
  ) {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;
      let result: R;

      try {
        result = await fn(...args);
        
        // Check if result indicates success/failure
        if (typeof result === 'object' && result !== null && 'success' in result) {
          success = (result as any).success;
          if (!success && 'error' in result) {
            error = (result as any).error;
          }
        }
        
        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : 'Unknown error';
        throw err;
      } finally {
        const duration = Date.now() - startTime;
        this.recordMetric({
          operation,
          service,
          duration,
          timestamp: new Date(),
          success,
          error
        });
      }
    };
  }

  // Record a performance metric
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations
    if (metric.duration > 1000) { // > 1 second
      logger.debug(`Slow operation detected: ${metric.service}.${metric.operation} took ${metric.duration}ms`);
    }

    // Log errors
    if (!metric.success && metric.error) {
      logger.error(`Operation failed: ${metric.service}.${metric.operation} - ${metric.error}`);
    }
  }

  // Get performance statistics
  getStats(service?: string, timeRange?: { start: Date; end: Date }): PerformanceStats {
    let filteredMetrics = this.metrics;

    // Filter by service
    if (service) {
      filteredMetrics = filteredMetrics.filter(m => m.service === service);
    }

    // Filter by time range
    if (timeRange) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    if (filteredMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        cacheHitRate: 0,
        slowestOperations: [],
        errorRate: 0
      };
    }

    const totalOperations = filteredMetrics.length;
    const successfulOperations = filteredMetrics.filter(m => m.success).length;
    const cacheHits = filteredMetrics.filter(m => m.cacheHit).length;
    const totalDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0);
    
    // Get slowest operations (top 10)
    const slowestOperations = [...filteredMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalOperations,
      averageDuration: totalDuration / totalOperations,
      successRate: (successfulOperations / totalOperations) * 100,
      cacheHitRate: totalOperations > 0 ? (cacheHits / totalOperations) * 100 : 0,
      slowestOperations,
      errorRate: ((totalOperations - successfulOperations) / totalOperations) * 100
    };
  }

  // Get recent errors
  getRecentErrors(limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => !m.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Get operations by duration
  getOperationsByDuration(minDuration: number = 1000): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration >= minDuration)
      .sort((a, b) => b.duration - a.duration);
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = [];
    logger.debug('Performance metrics cleared');
  }

  // Export metrics for analysis
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Get service-specific stats
  getServiceStats(): Record<string, PerformanceStats> {
    const services = [...new Set(this.metrics.map(m => m.service))];
    const stats: Record<string, PerformanceStats> = {};

    services.forEach(service => {
      stats[service] = this.getStats(service);
    });

    return stats;
  }

  // Monitor cache effectiveness
  getCacheStats(): {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  } {
    const queryMetrics = this.metrics.filter(m => 
      m.operation.includes('find') || m.operation.includes('get')
    );

    const totalQueries = queryMetrics.length;
    const cacheHits = queryMetrics.filter(m => m.cacheHit).length;
    const cacheMisses = totalQueries - cacheHits;

    return {
      totalQueries,
      cacheHits,
      cacheMisses,
      hitRate: totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0
    };
  }
}

// Global performance service instance
export const performanceService = new PerformanceService();