// Export all services
export { BaseService } from './base.service';
export { auditService, AuditService } from './audit.service';
export { poService, POService } from './po.service';
export { commentService, CommentService } from './comment.service';
export { vendorService, VendorService } from './vendor.service';
export { userService, UserService } from './user.service';
export { transporterService, TransporterService } from './transporter.service';
export { shipmentService, ShipmentService } from './shipment.service';
export { returnOrderService, ReturnOrderService } from './return-order.service';
export { cacheService, CacheService } from './cache.service';
export { performanceService, PerformanceService } from './performance.service';
export { errorTrackingService, ErrorTrackingService } from './error-tracking.service';
export { retryService, RetryService } from './retry.service';
export { realtimeService, RealtimeService } from './realtime.service';
export { healthService, HealthService } from './health.service';

// Service factory for dependency injection
export class ServiceFactory {
  private static instance: ServiceFactory;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }
}

// Initialize services
const serviceFactory = ServiceFactory.getInstance();

// Note: Services are available as direct exports above
// Service factory registration is optional and can be done lazily if needed

export { serviceFactory };