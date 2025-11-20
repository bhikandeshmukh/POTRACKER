import { 
  ServiceConfig, 
  ServiceRequest, 
  ServiceResponse, 
  ServiceError, 
  ServiceHealth,
  EventBus,
  ServiceRegistry
} from './types';
import { logger } from '../logger';
import { errorTrackingService } from '../services/error-tracking.service';
import { performanceService } from '../services/performance.service';
import { retryService } from '../services/retry.service';

export abstract class BaseMicroservice {
  protected config: ServiceConfig;
  protected eventBus?: EventBus;
  protected registry?: ServiceRegistry;
  protected isRunning = false;
  protected healthChecks: Map<string, () => Promise<boolean>> = new Map();

  constructor(config: ServiceConfig) {
    this.config = config;
    this.registerDefaultHealthChecks();
  }

  // Abstract methods that must be implemented by concrete services
  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract handleRequest<T>(request: ServiceRequest<T>): Promise<ServiceResponse<T>>;

  // Service lifecycle management
  async start(): Promise<void> {
    try {
      logger.debug(`Starting microservice: ${this.config.name}`);
      
      await this.initialize();
      
      if (this.registry) {
        await this.registry.register(this.config);
      }
      
      this.isRunning = true;
      logger.debug(`Microservice started: ${this.config.name}`);
      
      // Publish service started event
      if (this.eventBus) {
        await this.eventBus.publish({
          type: 'service.started',
          service: this.config.name,
          data: { config: this.config },
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Failed to start microservice: ${this.config.name}`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.debug(`Stopping microservice: ${this.config.name}`);
      
      this.isRunning = false;
      
      if (this.registry) {
        await this.registry.unregister(this.config.name);
      }
      
      await this.shutdown();
      
      logger.debug(`Microservice stopped: ${this.config.name}`);
      
      // Publish service stopped event
      if (this.eventBus) {
        await this.eventBus.publish({
          type: 'service.stopped',
          service: this.config.name,
          data: { config: this.config },
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Failed to stop microservice: ${this.config.name}`, error);
      throw error;
    }
  }

  // Request processing with middleware
  async processRequest<T>(request: ServiceRequest<T>): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Add request metadata
      const enrichedRequest = {
        ...request,
        headers: {
          ...request.headers,
          'x-request-id': requestId,
          'x-service': this.config.name
        }
      };

      // Execute with retry logic
      const response = await retryService.executeWithRetry(
        () => this.handleRequest(enrichedRequest),
        {
          operation: request.endpoint,
          service: this.config.name
        },
        this.config.retryPolicy
      );

      // Add response metadata
      const enrichedResponse: ServiceResponse<T> = {
        ...response,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          ...response.metadata
        }
      };

      // Track performance
      performanceService.recordMetric({
        operation: request.endpoint,
        service: this.config.name,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        success: response.success
      });

      return enrichedResponse;
    } catch (error) {
      // Track error
      errorTrackingService.trackError(error as Error, {
        operation: request.endpoint,
        service: this.config.name,
        timestamp: new Date(),
        requestId,
        additionalData: {
          method: request.method,
          endpoint: request.endpoint
        }
      });

      return {
        success: false,
        error: this.createServiceError(error),
        metadata: {
          requestId,
          timestamp: new Date(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  // Health check implementation
  async getHealth(): Promise<ServiceHealth> {
    const checks: any[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, checkFn] of this.healthChecks) {
      const startTime = Date.now();
      try {
        const result = await checkFn();
        const duration = Date.now() - startTime;
        
        checks.push({
          name,
          status: result ? 'pass' : 'fail',
          duration,
          output: result ? 'OK' : 'Check failed'
        });

        if (!result && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        checks.push({
          name,
          status: 'fail',
          duration,
          output: error instanceof Error ? error.message : 'Unknown error'
        });
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      metadata: {
        service: this.config.name,
        version: this.config.version,
        uptime: this.isRunning ? Date.now() - this.startTime : 0
      }
    };
  }

  // Event handling
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  setServiceRegistry(registry: ServiceRegistry): void {
    this.registry = registry;
  }

  // Protected helper methods
  protected generateRequestId(): string {
    return `${this.config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected createServiceError(error: any): ServiceError {
    return {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An internal error occurred',
      details: error.details || error,
      retryable: this.isRetryableError(error),
      statusCode: error.statusCode || 500
    };
  }

  protected isRetryableError(error: any): boolean {
    const retryableCodes = ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'];
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    
    return retryableCodes.includes(error.code) || 
           retryableStatusCodes.includes(error.statusCode);
  }

  protected registerHealthCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.healthChecks.set(name, checkFn);
  }

  private registerDefaultHealthChecks(): void {
    // Basic service health check
    this.registerHealthCheck('service', async () => {
      return this.isRunning;
    });

    // Memory usage check
    this.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      return heapUsagePercent < 90; // Fail if memory usage > 90%
    });
  }

  private startTime = Date.now();

  // Utility methods for concrete services
  protected async publishEvent<T>(eventType: string, data: T, correlationId?: string): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.publish({
        type: eventType,
        service: this.config.name,
        data,
        timestamp: new Date(),
        correlationId
      });
    }
  }

  protected async callService<T, R>(
    serviceName: string, 
    request: ServiceRequest<T>
  ): Promise<ServiceResponse<R>> {
    if (!this.registry) {
      throw new Error('Service registry not configured');
    }

    const serviceConfig = await this.registry.discover(serviceName);
    if (!serviceConfig) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // This would typically make an HTTP call to the service
    // For now, we'll simulate it
    return {
      success: true,
      data: {} as R,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration: 0
      }
    };
  }

  // Configuration access
  getConfig(): ServiceConfig {
    return { ...this.config };
  }

  getName(): string {
    return this.config.name;
  }

  getVersion(): string {
    return this.config.version;
  }

  isHealthy(): boolean {
    return this.isRunning;
  }
}