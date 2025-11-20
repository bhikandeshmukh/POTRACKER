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
          healthyCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
        case 'degraded':
          degradedCount++;
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