import { ServiceConfig, ServiceRegistry, ServiceHealth } from './types';
import { logger } from '../logger';

interface ServiceInstance {
  config: ServiceConfig;
  registeredAt: Date;
  lastHealthCheck: Date;
  healthStatus: ServiceHealth | null;
  instance?: any; // Reference to the actual service instance
}

export class InMemoryServiceRegistry implements ServiceRegistry {
  private services: Map<string, ServiceInstance> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  constructor() {
    this.startHealthChecking();
  }

  /**
  * Registers a microservice with the in-memory registry.
  * @example
  * register(service)
  * undefined
  * @param {{ServiceConfig}} {{service}} - Configuration of the service to register.
  * @returns {{Promise<void>}} Promise resolving when registration is complete.
  **/
  async register(service: ServiceConfig): Promise<void> {
    logger.debug(`Registering service: ${service.name}`);
    
    const instance: ServiceInstance = {
      config: service,
      registeredAt: new Date(),
      lastHealthCheck: new Date(),
      healthStatus: null
    };

    this.services.set(service.name, instance);
    
    logger.debug(`Service registered: ${service.name}`);
  }

  async unregister(serviceName: string): Promise<void> {
    logger.debug(`Unregistering service: ${serviceName}`);
    
    const removed = this.services.delete(serviceName);
    
    if (removed) {
      logger.debug(`Service unregistered: ${serviceName}`);
    } else {
      logger.debug(`Service not found for unregistration: ${serviceName}`);
    }
  }

  /**
  * Finds the configuration for a registered service by name, if healthy.
  * @example
  * discover("auth-service")
  * { host: "auth.local", port: 8080 }
  * @param {{string}} serviceName - Name of the service to look up.
  * @returns {{Promise<ServiceConfig | null>}} Returns a promise resolving to the service config or null.
  **/
  async discover(serviceName: string): Promise<ServiceConfig | null> {
    const instance = this.services.get(serviceName);
    
    if (!instance) {
      logger.debug(`Service not found: ${serviceName}`);
      return null;
    }

    // Check if service is healthy
    if (instance.healthStatus && instance.healthStatus.status === 'unhealthy') {
      logger.debug(`Service unhealthy: ${serviceName}`);
      return null;
    }

    return instance.config;
  }

  async listServices(): Promise<ServiceConfig[]> {
    return Array.from(this.services.values())
      .filter(instance => 
        !instance.healthStatus || 
        instance.healthStatus.status !== 'unhealthy'
      )
      .map(instance => instance.config);
  }

  /****
  * Perform a health check for a registered service, attempting to call its own health method or returning a default healthy status.
  * @example
  * healthCheck('user-service')
  * { status: 'healthy', timestamp: '2025-11-22T00:00:00.000Z', checks: [ ... ] }
  * @param {{string}} {{serviceName}} - Service name to perform the health check on.
  * @returns {{Promise<ServiceHealth>}} Promise resolving with the service health result.
  ****/
  async healthCheck(serviceName: string): Promise<ServiceHealth> {
    const instance = this.services.get(serviceName);
    
    if (!instance) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // If we have a service instance reference, call its health check
    if (instance.instance && typeof instance.instance.getHealth === 'function') {
      try {
        const health = await instance.instance.getHealth();
        instance.healthStatus = health;
        instance.lastHealthCheck = new Date();
        return health;
      } catch (error) {
        const unhealthyStatus: ServiceHealth = {
          status: 'unhealthy',
          timestamp: new Date(),
          checks: [{
            name: 'health-check',
            status: 'fail',
            duration: 0,
            output: error instanceof Error ? error.message : 'Health check failed'
          }]
        };
        instance.healthStatus = unhealthyStatus;
        return unhealthyStatus;
      }
    }

    // Default health check - just check if service is registered
    const defaultHealth: ServiceHealth = {
      status: 'healthy',
      timestamp: new Date(),
      checks: [{
        name: 'registration',
        status: 'pass',
        duration: 0,
        output: 'Service is registered'
      }]
    };

    instance.healthStatus = defaultHealth;
    return defaultHealth;
  }

  // Register a service instance for health checking
  registerInstance(serviceName: string, instance: any): void {
    const serviceInstance = this.services.get(serviceName);
    if (serviceInstance) {
      serviceInstance.instance = instance;
    }
  }

  // Get service statistics
  /**/ **
  * Compiles service registry health metrics and details for every known service instance.
  * @example
  * serviceRegistry.getStats()
  * { totalServices: 5, healthyServices: 3, unhealthyServices: 1, degradedServices: 1, services: [{ name: "api", status: "healthy", registeredAt: new Date("2025-01-01"), lastHealthCheck: new Date("2025-11-22") }] }
  * @returns {{ totalServices: number; healthyServices: number; unhealthyServices: number; degradedServices: number; services: Array<{ name: string; status: string; registeredAt: Date; lastHealthCheck: Date; }> }} Aggregated health summary of the registered services.
  **/*/
  getStats(): {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    degradedServices: number;
    services: Array<{
      name: string;
      status: string;
      registeredAt: Date;
      lastHealthCheck: Date;
    }>;
  } {
    const services = Array.from(this.services.values());
    
    let healthyCount = 0;
    let unhealthyCount = 0;
    let degradedCount = 0;

    const serviceStats = services.map(instance => {
      const status = instance.healthStatus?.status || 'unknown';
      
      switch (status) {
        case 'healthy':
          healthyCount += 1;
          break;
        case 'unhealthy':
          unhealthyCount += 1;
          break;
        case 'degraded':
          degradedCount += 1;
          break;
      }

      return {
        name: instance.config.name,
        status,
        registeredAt: instance.registeredAt,
        lastHealthCheck: instance.lastHealthCheck
      };
    });

    return {
      totalServices: services.length,
      healthyServices: healthyCount,
      unhealthyServices: unhealthyCount,
      degradedServices: degradedCount,
      services: serviceStats
    };
  }

  // Start periodic health checking
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    logger.debug('Service registry health checking started');
  }

  // Stop health checking
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.debug('Service registry health checking stopped');
    }
  }

  // Perform health checks on all registered services
  private async performHealthChecks(): Promise<void> {
    const services = Array.from(this.services.keys());
    
    for (const serviceName of services) {
      try {
        await this.healthCheck(serviceName);
      } catch (error) {
        logger.error(`Health check failed for service: ${serviceName}`, error);
      }
    }
  }

  // Cleanup unhealthy services
  /**
  * Removes unhealthy services that haven’t reported in the last five minutes from the registry.
  * @example
  * serviceRegistry.cleanup()
  * Promise<void>
  * @param {{void}} none - No arguments are required.
  * @returns {{Promise<void>}} Completes once stale services are unregistered.
  **/
  async cleanup(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const servicesToRemove: string[] = [];

    for (const [serviceName, instance] of this.services) {
      if (
        instance.healthStatus?.status === 'unhealthy' &&
        instance.lastHealthCheck < cutoffTime
      ) {
        servicesToRemove.push(serviceName);
      }
    }

    for (const serviceName of servicesToRemove) {
      await this.unregister(serviceName);
      logger.debug(`Cleaned up unhealthy service: ${serviceName}`);
    }
  }

  // Shutdown the registry
  async shutdown(): Promise<void> {
    this.stopHealthChecking();
    this.services.clear();
    logger.debug('Service registry shutdown complete');
  }
}

// Global service registry instance
export const serviceRegistry = new InMemoryServiceRegistry();