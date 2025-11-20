// Export all services
export { BaseService } from './base.service';
export { auditService, AuditService } from './audit.service';
export { poService, POService } from './po.service';
export { commentService, CommentService } from './comment.service';

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

// Register services after they're imported
import('./audit.service').then(({ auditService }) => {
  serviceFactory.register('audit', auditService);
});
import('./po.service').then(({ poService }) => {
  serviceFactory.register('po', poService);
});
import('./comment.service').then(({ commentService }) => {
  serviceFactory.register('comment', commentService);
});

export { serviceFactory };