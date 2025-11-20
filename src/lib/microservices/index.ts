// Export all microservice types and interfaces
export * from './types';

// Export core microservice infrastructure
export { BaseMicroservice } from './base-service';
export { InMemoryServiceRegistry, serviceRegistry } from './service-registry';
export { InMemoryEventBus, eventBus } from './event-bus';
export { ApiGatewayImpl } from './api-gateway';

// Export orchestrator
export { 
  MicroserviceOrchestrator, 
  createOrchestrator, 
  orchestrator,
  type OrchestrationConfig 
} from './orchestrator';

// Export client
export { 
  MicroserviceClient, 
  POServiceClient, 
  VendorServiceClient,
  microserviceClient,
  poClient,
  vendorClient,
  type ClientConfig 
} from './client';

// Export concrete services
export { POMicroservice } from './services/po-service';
export { VendorMicroservice } from './services/vendor-service';

// Utility functions
export function createMicroserviceConfig(overrides: Partial<import('./types').ServiceConfig> = {}): import('./types').ServiceConfig {
  return {
    name: 'default-service',
    version: '1.0.0',
    timeout: 30000,
    retryPolicy: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    },
    ...overrides
  };
}

// Health check utilities
export async function checkServiceHealth(serviceName: string): Promise<import('./types').ServiceHealth | null> {
  try {
    return await serviceRegistry.healthCheck(serviceName);
  } catch (error) {
    return null;
  }
}

export async function checkAllServicesHealth(): Promise<Record<string, import('./types').ServiceHealth | null>> {
  const services = await serviceRegistry.listServices();
  const healthChecks: Record<string, import('./types').ServiceHealth | null> = {};

  await Promise.all(
    services.map(async (service) => {
      healthChecks[service.name] = await checkServiceHealth(service.name);
    })
  );

  return healthChecks;
}

// Event utilities
export function publishServiceEvent<T>(eventType: string, data: T, correlationId?: string): Promise<void> {
  return eventBus.publish({
    type: eventType,
    service: 'client',
    data,
    timestamp: new Date(),
    correlationId
  });
}

export function subscribeToServiceEvent<T>(
  eventType: string, 
  handler: (event: import('./types').ServiceEvent<T>) => Promise<void>
): () => void {
  return eventBus.subscribe(eventType, handler);
}

// Configuration presets
export const DEVELOPMENT_CONFIG: Partial<OrchestrationConfig> = {
  services: ['vendor-service', 'po-service'],
  autoStart: true,
  healthCheckInterval: 10000, // 10 seconds
  enableApiGateway: true,
  gatewayPort: 3001
};

export const PRODUCTION_CONFIG: Partial<OrchestrationConfig> = {
  services: ['vendor-service', 'po-service'],
  autoStart: false, // Manual start in production
  healthCheckInterval: 30000, // 30 seconds
  enableApiGateway: true,
  gatewayPort: 3001
};

export const TEST_CONFIG: Partial<OrchestrationConfig> = {
  services: ['vendor-service', 'po-service'],
  autoStart: false,
  healthCheckInterval: 5000, // 5 seconds
  enableApiGateway: false // No gateway in tests
};

// Migration utilities
export class MicroserviceMigrationHelper {
  static async migrateFromLegacyServices(): Promise<{
    success: boolean;
    migratedServices: string[];
    errors: string[];
  }> {
    const migratedServices: string[] = [];
    const errors: string[] = [];

    try {
      // Start orchestrator with all services
      await orchestrator.start();
      
      // Verify services are running
      const status = orchestrator.getStatus();
      
      for (const service of status.services) {
        if (service.status === 'running') {
          migratedServices.push(service.name);
        } else {
          errors.push(`Failed to start ${service.name}`);
        }
      }

      return {
        success: errors.length === 0,
        migratedServices,
        errors
      };
    } catch (error) {
      errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        migratedServices,
        errors
      };
    }
  }

  static async validateMigration(): Promise<{
    valid: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message: string;
    }>;
  }> {
    const checks: Array<{ name: string; passed: boolean; message: string }> = [];

    // Check if orchestrator is running
    const orchestratorRunning = orchestrator.getStatus().isRunning;
    checks.push({
      name: 'Orchestrator Status',
      passed: orchestratorRunning,
      message: orchestratorRunning ? 'Orchestrator is running' : 'Orchestrator is not running'
    });

    // Check service health
    const health = await orchestrator.healthCheck();
    checks.push({
      name: 'Service Health',
      passed: health.overall === 'healthy',
      message: `Overall health: ${health.overall}`
    });

    // Check event bus
    const eventBusHealth = await eventBus.healthCheck();
    checks.push({
      name: 'Event Bus',
      passed: eventBusHealth.status === 'healthy',
      message: `Event bus status: ${eventBusHealth.status}`
    });

    // Check service registry
    const registryStats = serviceRegistry.getStats();
    checks.push({
      name: 'Service Registry',
      passed: registryStats.totalServices > 0,
      message: `${registryStats.totalServices} services registered`
    });

    const allPassed = checks.every(check => check.passed);

    return {
      valid: allPassed,
      checks
    };
  }
}

// Export migration helper
export const migrationHelper = new MicroserviceMigrationHelper();