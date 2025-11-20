import { BaseMicroservice } from '../base-service';
import { ServiceConfig, ServiceRequest, ServiceResponse } from '../types';
import { poService as legacyPOService } from '../../services';
import { PurchaseOrder, CreatePOForm } from '../../types';
import { logger } from '../../logger';

export class POMicroservice extends BaseMicroservice {
  constructor() {
    const config: ServiceConfig = {
      name: 'po-service',
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
      }
    };

    super(config);
  }

  async initialize(): Promise<void> {
    logger.debug('Initializing PO Microservice');
    
    // Register health checks specific to PO service
    this.registerHealthCheck('database', async () => {
      try {
        // Test database connectivity by attempting to count POs
        const result = await legacyPOService.findMany({ limit: 1 });
        return result.success;
      } catch (error) {
        return false;
      }
    });

    // Register event handlers
    if (this.eventBus) {
      this.eventBus.subscribe('po.status.changed', async (event) => {
        await this.handlePOStatusChanged(event);
      });

      this.eventBus.subscribe('vendor.updated', async (event) => {
        await this.handleVendorUpdated(event);
      });
    }

    logger.debug('PO Microservice initialized');
  }

  async shutdown(): Promise<void> {
    logger.debug('Shutting down PO Microservice');
    // Cleanup resources if needed
  }

  async handleRequest<T>(request: ServiceRequest<T>): Promise<ServiceResponse<T>> {
    const { method, endpoint, data, params } = request;

    try {
      switch (endpoint) {
        case '/pos':
          return await this.handlePOsEndpoint(method, data, params) as ServiceResponse<T>;
        
        case '/pos/create':
          return await this.handleCreatePO(data) as ServiceResponse<T>;
        
        case '/pos/search':
          return await this.handleSearchPOs(params) as ServiceResponse<T>;
        
        case '/pos/stats':
          return await this.handlePOStats() as ServiceResponse<T>;
        
        default:
          if (endpoint.startsWith('/pos/')) {
            const poId = endpoint.split('/')[2];
            return await this.handleSinglePO(method, poId, data) as ServiceResponse<T>;
          }
          
          return {
            success: false,
            error: {
              code: 'ENDPOINT_NOT_FOUND',
              message: `Endpoint not found: ${endpoint}`,
              statusCode: 404
            }
          };
      }
    } catch (error) {
      logger.error(`PO Service request failed: ${endpoint}`, error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal service error',
          statusCode: 500,
          details: error
        }
      };
    }
  }

  // Endpoint handlers
  private async handlePOsEndpoint(
    method: string, 
    data: any, 
    params: any
  ): Promise<ServiceResponse<any>> {
    switch (method) {
      case 'GET':
        return await this.getPOs(params);
      case 'POST':
        return await this.createPO(data);
      default:
        return {
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed for /pos`,
            statusCode: 405
          }
        };
    }
  }

  private async handleSinglePO(
    method: string, 
    poId: string, 
    data: any
  ): Promise<ServiceResponse<any>> {
    switch (method) {
      case 'GET':
        return await this.getPO(poId);
      case 'PUT':
        return await this.updatePO(poId, data);
      case 'DELETE':
        return await this.deletePO(poId, data);
      default:
        return {
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed for /pos/{id}`,
            statusCode: 405
          }
        };
    }
  }

  private async handleCreatePO(data: any): Promise<ServiceResponse<PurchaseOrder>> {
    if (!data || !data.poData || !data.userContext) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: poData and userContext',
          statusCode: 400
        }
      };
    }

    const result = await legacyPOService.createPO(data.poData, data.userContext);
    
    if (result.success && result.data) {
      // Publish event
      await this.publishEvent('po.created', {
        poId: result.data.id,
        poNumber: result.data.poNumber,
        vendorId: result.data.vendorId,
        totalAmount: result.data.totalAmount,
        createdBy: data.userContext
      });
    }

    return result;
  }

  private async handleSearchPOs(params: any): Promise<ServiceResponse<any>> {
    const { searchTerm, userId, role, limit } = params;
    
    if (!searchTerm) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required parameter: searchTerm',
          statusCode: 400
        }
      };
    }

    return await legacyPOService.searchPOs(searchTerm, userId, role, limit);
  }

  private async handlePOStats(): Promise<ServiceResponse<any>> {
    return await legacyPOService.getPOStats();
  }

  private async getPOs(params: any): Promise<ServiceResponse<any>> {
    const { userId, role, limit, status, vendorId } = params;
    
    if (userId && role) {
      return await legacyPOService.getPOsForUser(userId, role, limit);
    }
    
    // Build query options
    const queryOptions: any = {};
    if (limit) queryOptions.limit = parseInt(limit);
    if (status || vendorId) {
      queryOptions.where = [];
      if (status) queryOptions.where.push({ field: 'status', operator: '==', value: status });
      if (vendorId) queryOptions.where.push({ field: 'vendorId', operator: '==', value: vendorId });
    }

    return await legacyPOService.findMany(queryOptions);
  }

  private async getPO(poId: string): Promise<ServiceResponse<PurchaseOrder>> {
    return await legacyPOService.findById(poId);
  }

  private async updatePO(poId: string, data: any): Promise<ServiceResponse<PurchaseOrder>> {
    if (!data.updates || !data.userContext) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: updates and userContext',
          statusCode: 400
        }
      };
    }

    // Handle status updates specially
    if (data.updates.status) {
      const result = await legacyPOService.updatePOStatus(
        poId, 
        data.updates.status, 
        data.userContext,
        data.reason
      );

      if (result.success) {
        // Publish status change event
        await this.publishEvent('po.status.changed', {
          poId,
          oldStatus: data.oldStatus,
          newStatus: data.updates.status,
          reason: data.reason,
          updatedBy: data.userContext
        });
      }

      return result;
    }

    // Regular update
    const result = await legacyPOService.update(poId, data.updates);
    
    if (result.success) {
      // Publish update event
      await this.publishEvent('po.updated', {
        poId,
        updates: data.updates,
        updatedBy: data.userContext
      });
    }

    return result;
  }

  private async deletePO(poId: string, data: any): Promise<ServiceResponse<void>> {
    if (!data.userContext) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required field: userContext',
          statusCode: 400
        }
      };
    }

    const result = await legacyPOService.deletePO(poId, data.userContext);
    
    if (result.success) {
      // Publish delete event
      await this.publishEvent('po.deleted', {
        poId,
        deletedBy: data.userContext
      });
    }

    return result;
  }

  // Event handlers
  private async handlePOStatusChanged(event: any): Promise<void> {
    logger.debug(`Handling PO status change event: ${event.data.poId}`);
    
    // Could trigger additional business logic here
    // For example, notify vendors, update inventory, etc.
    
    if (event.data.newStatus === 'Approved') {
      // Trigger vendor notification
      await this.publishEvent('vendor.notification.required', {
        vendorId: event.data.vendorId,
        poId: event.data.poId,
        message: 'Your purchase order has been approved'
      });
    }
  }

  private async handleVendorUpdated(event: any): Promise<void> {
    logger.debug(`Handling vendor update event: ${event.data.vendorId}`);
    
    // Update POs with new vendor information if needed
    // This is an example of cross-service data consistency
  }

  // Custom business logic methods
  async approvePO(poId: string, userContext: any, reason?: string): Promise<ServiceResponse<PurchaseOrder>> {
    return await this.updatePO(poId, {
      updates: { status: 'Approved' },
      userContext,
      reason
    });
  }

  async rejectPO(poId: string, userContext: any, reason: string): Promise<ServiceResponse<PurchaseOrder>> {
    return await this.updatePO(poId, {
      updates: { status: 'Rejected' },
      userContext,
      reason
    });
  }

  async getPOsByVendor(vendorId: string): Promise<ServiceResponse<any>> {
    return await this.getPOs({ vendorId });
  }

  async getPOsByStatus(status: string): Promise<ServiceResponse<any>> {
    return await this.getPOs({ status });
  }
}