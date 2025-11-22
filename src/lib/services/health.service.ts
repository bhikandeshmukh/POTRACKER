import { logger } from '../logger';
import { cacheService } from './cache.service';
import { performanceService } from './performance.service';
import { db } from '../firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheck[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export class HealthService {
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor() {
    this.registerDefaultChecks();
  }

  /**
  * Register default health checks for database, cache, performance, and memory subsystems.
  * @example
  * registerDefaultChecks()
  * undefined
  * @param {{void}} none - No arguments.
  * @returns {{void}} Does not return a value.
  **/
  private registerDefaultChecks() {
    // Database connectivity check
    this.registerCheck('database', async () => {
      const startTime = Date.now();
      try {
        // Try to read from a collection
        const testQuery = query(collection(db, 'health-check'), limit(1));
        await getDocs(testQuery);
        
        return {
          service: 'database',
          status: 'healthy' as const,
          responseTime: Date.now() - startTime
        };
      } catch (error) {
        return {
          service: 'database',
          status: 'unhealthy' as const,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown database error'
        };
      }
    });

    // Cache service check
    this.registerCheck('cache', async () => {
      const startTime = Date.now();
      try {
        // Test cache operations
        const testKey = 'health-check-' + Date.now();
        const testValue = { test: true };
        
        cacheService.set(testKey, testValue);
        const retrieved = cacheService.get(testKey);
        cacheService.delete(testKey);
        
        const stats = cacheService.getStats();
        
        return {
          service: 'cache',
          status: retrieved ? 'healthy' as const : 'degraded' as const,
          responseTime: Date.now() - startTime,
          details: {
            size: cacheService.size(),
            stats
          }
        };
      } catch (error) {
        return {
          service: 'cache',
          status: 'unhealthy' as const,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown cache error'
        };
      }
    });

    // Performance monitoring check
    this.registerCheck('performance', async () => {
      const startTime = Date.now();
      try {
        const stats = performanceService.getStats();
        const recentErrors = performanceService.getRecentErrors(5);
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        
        // Determine status based on error rate and performance
        if (stats.errorRate > 10) {
          status = 'unhealthy';
        } else if (stats.errorRate > 5 || stats.averageDuration > 2000) {
          status = 'degraded';
        }
        
        return {
          service: 'performance',
          status,
          responseTime: Date.now() - startTime,
          details: {
            totalOperations: stats.totalOperations,
            averageDuration: stats.averageDuration,
            successRate: stats.successRate,
            errorRate: stats.errorRate,
            recentErrorCount: recentErrors.length
          }
        };
      } catch (error) {
        return {
          service: 'performance',
          status: 'unhealthy' as const,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown performance monitoring error'
        };
      }
    });

    // Memory usage check
    this.registerCheck('memory', async () => {
      const startTime = Date.now();
      try {
        // Basic memory check (Node.js specific)
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        
        if (heapUsagePercent > 90) {
          status = 'unhealthy';
        } else if (heapUsagePercent > 75) {
          status = 'degraded';
        }
        
        return {
          service: 'memory',
          status,
          responseTime: Date.now() - startTime,
          details: {
            heapUsedMB: Math.round(heapUsedMB),
            heapTotalMB: Math.round(heapTotalMB),
            heapUsagePercent: Math.round(heapUsagePercent),
            rss: Math.round(memUsage.rss / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
          }
        };
      } catch (error) {
        return {
          service: 'memory',
          status: 'unhealthy' as const,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown memory check error'
        };
      }
    });
  }

  // Register a custom health check
  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFn);
    logger.debug(`Health check registered: ${name}`);
  }

  // Remove a health check
  unregisterCheck(name: string): void {
    this.healthChecks.delete(name);
    logger.debug(`Health check unregistered: ${name}`);
  }

  // Run a specific health check
  /**
  * Runs the named health check and returns the result or null if no check is registered.
  * @example
  * runCheck('database')
  * { service: 'database', status: 'healthy', responseTime: 5 }
  * @param {{string}} {{name}} - Name of the health check to execute.
  * @returns {{Promise<HealthCheck|null>}} Promise resolving to the health check result or null.
  **/
  async runCheck(name: string): Promise<HealthCheck | null> {
    const checkFn = this.healthChecks.get(name);
    if (!checkFn) {
      return null;
    }

    try {
      return await checkFn();
    } catch (error) {
      return {
        service: name,
        status: 'unhealthy',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  // Run all health checks
  /**
  * Runs all registered health checks concurrently, aggregates their results, and summarizes the system health.
  * @example
  * runAllChecks()
  * {overall: 'healthy', timestamp: '2025-11-22T00:00:00.000Z', checks: [...], summary: { healthy: 2, degraded: 0, unhealthy: 0 }}
  * @returns {Promise<SystemHealth>} A promise that resolves with the aggregated system health result.
  **/
  async runAllChecks(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    const checkPromises: Promise<HealthCheck>[] = [];

    // Run all checks in parallel
    for (const [name, checkFn] of this.healthChecks) {
      checkPromises.push(
        checkFn().catch(error => ({
          service: name,
          status: 'unhealthy' as const,
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Health check failed'
        }))
      );
    }

    const results = await Promise.all(checkPromises);
    checks.push(...results);

    // Calculate summary
    const summary = {
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length
    };

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overall = 'unhealthy';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    const systemHealth: SystemHealth = {
      overall,
      timestamp: new Date(),
      checks,
      summary
    };

    // Log health status
    logger.debug(`System health check completed: ${overall}`, {
      healthy: summary.healthy,
      degraded: summary.degraded,
      unhealthy: summary.unhealthy
    });

    return systemHealth;
  }

  // Get health status for monitoring endpoints
  /**
   * Retrieves the current health status of the system
   * @example
   * getHealthStatus()
   * { status: "healthy", timestamp: "2025-11-22T00:00:00.000Z", details: { … } }
   * @param {{}} {} - No parameters required.
   * @returns {{Promise<{status: string; timestamp: string; details: SystemHealth;}>}} A promise that resolves with the current health status.
   **/
  async getHealthStatus(): Promise<{
    status: string;
    timestamp: string;
    details: SystemHealth;
  }> {
    const health = await this.runAllChecks();
    
    return {
      status: health.overall,
      timestamp: health.timestamp.toISOString(),
      details: health
    };
  }

  // Check if system is ready (all critical services healthy)
  /**
  * Checks if critical services are healthy in one go.
  * @example
  * isReady(['database'])
  * true
  * @param {{string[]}} {{criticalServices}} - Names of services that must be healthy.
  * @returns {{Promise<boolean>}} Promise resolving to true if all critical services are healthy, false otherwise.
  **/
  async isReady(criticalServices: string[] = ['database']): Promise<boolean> {
    const health = await this.runAllChecks();
    
    for (const serviceName of criticalServices) {
      const check = health.checks.find(c => c.service === serviceName);
      if (!check || check.status === 'unhealthy') {
        return false;
      }
    }
    
    return true;
  }

  // Check if system is alive (basic functionality working)
  async isAlive(): Promise<boolean> {
    try {
      // Basic liveness check - just ensure the service can respond
      return true;
    } catch {
      return false;
    }
  }
}

// Global health service instance
export const healthService = new HealthService();