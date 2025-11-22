import { BaseMicroservice } from './base-service';
import { ServiceRegistry } from './types';
import { eventBus } from './event-bus';
import { serviceRegistry } from './service-registry';
import { ApiGatewayImpl } from './api-gateway';
import { POMicroservice } from './services/po-service';
import { VendorMicroservice } from './services/vendor-service';
import { logger } from '../logger';

export interface OrchestrationConfig {
  services: string[];
  autoStart?: boolean;
  healthCheckInterval?: number;
  enableApiGateway?: boolean;
  gatewayPort?: number;
}

export class MicroserviceOrchestrator {
  private services: Map<string, BaseMicroservice> = new Map();
  private apiGateway?: ApiGatewayImpl;
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(private config: OrchestrationConfig) {
    this.setupServices();
    this.setupApiGateway();
  }

  // Initialize and start all services
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Orchestrator already running');
      return;
    }

    logger.debug('Starting microservice orchestrator');

    try {
      // Start services in dependency order
      const startOrder = this.getServiceStartOrder();
      
      for (const serviceName of startOrder) {
        const service = this.services.get(serviceName);
        if (service) {
          logger.debug(`Starting service: ${serviceName}`);
          await service.start();
          logger.debug(`Service started: ${serviceName}`);
        }
      }

      // Start health checking
      this.startHealthChecking();

      // Setup API Gateway routes
      this.setupGatewayRoutes();

      this.isRunning = true;
      logger.debug('Microservice orchestrator started successfully');

      // Publish orchestrator started event
      await eventBus.publish({
        type: 'orchestrator.started',
        service: 'orchestrator',
        data: {
          services: Array.from(this.services.keys()),
          config: this.config
        },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to start microservice orchestrator', error);
      await this.stop(); // Cleanup on failure
      throw error;
    }
  }

  // Stop all services
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.debug('Orchestrator not running');
      return;
    }

    logger.debug('Stopping microservice orchestrator');

    try {
      // Stop health checking
      this.stopHealthChecking();

      // Stop services in reverse dependency order
      const stopOrder = this.getServiceStartOrder().reverse();
      
      for (const serviceName of stopOrder) {
        const service = this.services.get(serviceName);
        if (service) {
          logger.debug(`Stopping service: ${serviceName}`);
          try {
            await service.stop();
            logger.debug(`Service stopped: ${serviceName}`);
          } catch (error) {
            logger.error(`Failed to stop service: ${serviceName}`, error);
          }
        }
      }

      this.isRunning = false;
      logger.debug('Microservice orchestrator stopped');

      // Publish orchestrator stopped event
      await eventBus.publish({
        type: 'orchestrator.stopped',
        service: 'orchestrator',
        data: {
          services: Array.from(this.services.keys())
        },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error during orchestrator shutdown', error);
      throw error;
    }
  }

  // Get service by name
  getService(serviceName: string): BaseMicroservice | undefined {
    return this.services.get(serviceName);
  }

  // Get all services
  getServices(): Map<string, BaseMicroservice> {
    return new Map(this.services);
  }

  // Get API Gateway
  getApiGateway(): ApiGatewayImpl | undefined {
    return this.apiGateway;
  }

  // Get orchestrator status
  getStatus(): {
    isRunning: boolean;
    services: Array<{
      name: string;
      status: 'running' | 'stopped' | 'error';
      health?: any;
    }>;
    apiGateway?: {
      enabled: boolean;
      stats?: any;
    };
  } {
    const services = Array.from(this.services.entries()).map(([name, service]) => ({
      name,
      status: service.isHealthy() ? 'running' : 'stopped' as 'running' | 'stopped' | 'error'
    }));

    const status = {
      isRunning: this.isRunning,
      services,
      ...(this.apiGateway && {
        apiGateway: {
          enabled: true,
          stats: this.apiGateway.getStats()
        }
      })
    };

    return status;
  }

  // Health check all services
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, any>;
    timestamp: Date;
  }> {
    const serviceHealths: Record<string, any> = {};
    let healthyCount = 0;
    let totalCount = 0;

    for (const [name, service] of this.services) {
      totalCount += 1;
      try {
        const health = await service.getHealth();
        serviceHealths[name] = health;
        
        if (health.status === 'healthy') {
          healthyCount += 1;
        }
      } catch (error) {
        serviceHealths[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        };
      }
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const healthyPercentage = (healthyCount / totalCount) * 100;

    if (healthyPercentage < 50) {
      overall = 'unhealthy';
    } else if (healthyPercentage < 100) {
      overall = 'degraded';
    }

    return {
      overall,
      services: serviceHealths,
      timestamp: new Date()
    };
  }

  // Get orchestrator metrics
  async getMetrics(): Promise<{
    orchestrator: {
      uptime: number;
      servicesCount: number;
      healthyServices: number;
      isRunning: boolean;
    };
    services: Record<string, any>;
    eventBus: any;
    serviceRegistry: any;
    apiGateway?: any;
  }> {
    const health = await this.healthCheck();
    const healthyServices = Object.values(health.services).filter(
      (s: any) => s.status === 'healthy'
    ).length;

    const metrics = {
      orchestrator: {
        uptime: this.isRunning ? Date.now() - this.startTime : 0,
        servicesCount: this.services.size,
        healthyServices,
        isRunning: this.isRunning
      },
      services: health.services,
      eventBus: eventBus.getEventStats(),
      serviceRegistry: serviceRegistry.getStats(),
      ...(this.apiGateway && {
        apiGateway: this.apiGateway.getStats()
      })
    };

    return metrics;
  }

  // Private helper methods
  private setupServices(): void {
    // Create service instances based on configuration
    if (this.config.services.includes('po-service')) {
      const poService = new POMicroservice();
      poService.setEventBus(eventBus);
      poService.setServiceRegistry(serviceRegistry);
      this.services.set('po-service', poService);
      serviceRegistry.registerInstance('po-service', poService);
    }

    if (this.config.services.includes('vendor-service')) {
      const vendorService = new VendorMicroservice();
      vendorService.setEventBus(eventBus);
      vendorService.setServiceRegistry(serviceRegistry);
      this.services.set('vendor-service', vendorService);
      serviceRegistry.registerInstance('vendor-service', vendorService);
    }

    // Add more services as needed
    logger.debug(`Setup ${this.services.size} services`);
  }

  private setupApiGateway(): void {
    if (this.config.enableApiGateway) {
      this.apiGateway = new ApiGatewayImpl(serviceRegistry);
      logger.debug('API Gateway setup complete');
    }
  }

  private setupGatewayRoutes(): void {
    if (!this.apiGateway) return;

    // Setup routes for each service
    this.apiGateway.addRoute('^/api/v1/pos', 'po-service');
    this.apiGateway.addRoute('^/api/v1/vendors', 'vendor-service');
    
    // Add global middleware
    const loggingMiddleware = this.apiGateway.getMiddleware('logging');
    const corsMiddleware = this.apiGateway.getMiddleware('cors');
    
    if (loggingMiddleware) {
      this.apiGateway.addGlobalMiddleware(loggingMiddleware);
    }
    if (corsMiddleware) {
      this.apiGateway.addGlobalMiddleware(corsMiddleware);
    }

    logger.debug('API Gateway routes configured');
  }

  private getServiceStartOrder(): string[] {
    // Define service dependencies and start order
    // Services with no dependencies start first
    const order = [];
    
    if (this.services.has('vendor-service')) {
      order.push('vendor-service');
    }
    
    if (this.services.has('po-service')) {
      order.push('po-service'); // Depends on vendor-service
    }

    return order;
  }

  private startHealthChecking(): void {
    const interval = this.config.healthCheckInterval || 30000; // 30 seconds
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        
        // Log unhealthy services
        Object.entries(health.services).forEach(([name, serviceHealth]: [string, any]) => {
          if (serviceHealth.status !== 'healthy') {
            logger.debug(`Service ${name} is ${serviceHealth.status}`);
          }
        });

        // Publish health status
        await eventBus.publish({
          type: 'orchestrator.health.check',
          service: 'orchestrator',
          data: health,
          timestamp: new Date()
        });

      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, interval);

    logger.debug(`Health checking started with ${interval}ms interval`);
  }

  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.debug('Health checking stopped');
    }
  }

  private startTime = Date.now();

  // Graceful shutdown handler
  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.debug(`Received ${signal}, starting graceful shutdown`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }
}

// Factory function to create orchestrator with default configuration
export function createOrchestrator(config?: Partial<OrchestrationConfig>): MicroserviceOrchestrator {
  const defaultConfig: OrchestrationConfig = {
    services: ['vendor-service', 'po-service'],
    autoStart: false,
    healthCheckInterval: 30000,
    enableApiGateway: true,
    gatewayPort: 3001
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new MicroserviceOrchestrator(finalConfig);
}

// Global orchestrator instance
export const orchestrator = createOrchestrator();