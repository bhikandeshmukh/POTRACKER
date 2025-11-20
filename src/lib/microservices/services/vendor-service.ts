import { BaseMicroservice } from '../base-service';
import { ServiceConfig, ServiceRequest, ServiceResponse } from '../types';
import { vendorService as legacyVendorService } from '../../services';
import { Vendor, CreateVendorForm } from '../../types';
import { logger } from '../../logger';

export class VendorMicroservice extends BaseMicroservice {
  constructor() {
    const config: ServiceConfig = {
      name: 'vendor-service',
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
    logger.debug('Initializing Vendor Microservice');
    
    // Register health checks
    this.registerHealthCheck('database', async () => {
      try {
        const result = await legacyVendorService.findMany({ limit: 1 });
        return result.success;
      } catch (error) {
        return false;
      }
    });

    // Register event handlers
    if (this.eventBus) {
      this.eventBus.subscribe('po.created', async (event) => {
        await this.handlePOCreated(event);
      });

      this.eventBus.subscribe('vendor.notification.required', async (event) => {
        await this.handleVendorNotification(event);
      });
    }

    logger.debug('Vendor Microservice initialized');
  }

  async shutdown(): Promise<void> {
    logger.debug('Shutting down Vendor Microservice');
  }

  async handleRequest<T>(request: ServiceRequest<T>): Promise<ServiceResponse<T>> {
    const { method, endpoint, data, params } = request;

    try {
      switch (endpoint) {
        case '/vendors':
          return await this.handleVendorsEndpoint(method, data, params) as ServiceResponse<T>;
        
        case '/vendors/search':
          return await this.handleSearchVendors(params) as ServiceResponse<T>;
        
        case '/vendors/stats':
          return await this.handleVendorStats() as ServiceResponse<T>;
        
        default:
          if (endpoint.startsWith('/vendors/')) {
            const vendorId = endpoint.split('/')[2];
            return await this.handleSingleVendor(method, vendorId, data) as ServiceResponse<T>;
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
      logger.error(`Vendor Service request failed: ${endpoint}`, error);
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
  private async handleVendorsEndpoint(
    method: string, 
    data: any, 
    params: any
  ): Promise<ServiceResponse<any>> {
    switch (method) {
      case 'GET':
        return await this.getVendors(params);
      case 'POST':
        return await this.createVendor(data);
      default:
        return {
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed for /vendors`,
            statusCode: 405
          }
        };
    }
  }

  private async handleSingleVendor(
    method: string, 
    vendorId: string, 
    data: any
  ): Promise<ServiceResponse<any>> {
    switch (method) {
      case 'GET':
        return await this.getVendor(vendorId);
      case 'PUT':
        return await this.updateVendor(vendorId, data);
      case 'DELETE':
        return await this.deleteVendor(vendorId, data);
      default:
        return {
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed for /vendors/{id}`,
            statusCode: 405
          }
        };
    }
  }

  private async handleSearchVendors(params: any): Promise<ServiceResponse<any>> {
    const { searchTerm } = params;
    
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

    return await legacyVendorService.searchVendors(searchTerm);
  }

  private async handleVendorStats(): Promise<ServiceResponse<any>> {
    // Get vendor statistics
    const vendorsResult = await legacyVendorService.findMany();
    
    if (!vendorsResult.success) {
      return vendorsResult;
    }

    const vendors = vendorsResult.data?.data || [];
    const stats = {
      totalVendors: vendors.length,
      activeVendors: vendors.filter(v => v.active !== false).length,
      vendorsWithEmail: vendors.filter(v => v.email).length,
      vendorsWithGST: vendors.filter(v => v.gst).length,
      recentVendors: vendors
        .sort((a, b) => (b.createdAt?.toDate().getTime() || 0) - (a.createdAt?.toDate().getTime() || 0))
        .slice(0, 5)
    };

    return {
      success: true,
      data: stats
    };
  }

  private async getVendors(params: any): Promise<ServiceResponse<any>> {
    const { limit, active } = params;
    
    const queryOptions: any = {};
    if (limit) queryOptions.limit = parseInt(limit);
    if (active !== undefined) {
      queryOptions.where = [{ field: 'active', operator: '==', value: active === 'true' }];
    }

    return await legacyVendorService.findMany(queryOptions);
  }

  private async getVendor(vendorId: string): Promise<ServiceResponse<Vendor>> {
    return await legacyVendorService.findById(vendorId);
  }

  private async createVendor(data: any): Promise<ServiceResponse<Vendor>> {
    if (!data || !data.vendorData || !data.userContext) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: vendorData and userContext',
          statusCode: 400
        }
      };
    }

    const result = await legacyVendorService.createVendor(data.vendorData, data.userContext);
    
    if (result.success && result.data) {
      // Publish event
      await this.publishEvent('vendor.created', {
        vendorId: result.data.id,
        vendorName: result.data.name,
        contactPerson: result.data.contactPerson,
        createdBy: data.userContext
      });
    }

    return result;
  }

  private async updateVendor(vendorId: string, data: any): Promise<ServiceResponse<Vendor>> {
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

    const result = await legacyVendorService.updateVendor(vendorId, data.updates, data.userContext);
    
    if (result.success) {
      // Publish update event
      await this.publishEvent('vendor.updated', {
        vendorId,
        updates: data.updates,
        updatedBy: data.userContext
      });
    }

    return result;
  }

  private async deleteVendor(vendorId: string, data: any): Promise<ServiceResponse<void>> {
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

    const result = await legacyVendorService.deleteVendor(vendorId, data.userContext);
    
    if (result.success) {
      // Publish delete event
      await this.publishEvent('vendor.deleted', {
        vendorId,
        deletedBy: data.userContext
      });
    }

    return result;
  }

  // Event handlers
  private async handlePOCreated(event: any): Promise<void> {
    logger.debug(`Handling PO created event for vendor: ${event.data.vendorId}`);
    
    // Update vendor statistics or send notifications
    // This could track how many POs each vendor has
    
    await this.publishEvent('vendor.po.created', {
      vendorId: event.data.vendorId,
      poId: event.data.poId,
      poNumber: event.data.poNumber,
      totalAmount: event.data.totalAmount
    });
  }

  private async handleVendorNotification(event: any): Promise<void> {
    logger.debug(`Handling vendor notification: ${event.data.vendorId}`);
    
    // Get vendor details
    const vendorResult = await this.getVendor(event.data.vendorId);
    
    if (vendorResult.success && vendorResult.data) {
      const vendor = vendorResult.data;
      
      // Send notification (email, SMS, etc.)
      // For now, just log it
      logger.debug(`Notification for vendor ${vendor.name}: ${event.data.message}`);
      
      // Publish notification sent event
      await this.publishEvent('vendor.notification.sent', {
        vendorId: event.data.vendorId,
        vendorName: vendor.name,
        message: event.data.message,
        contactPerson: vendor.contactPerson,
        email: vendor.email,
        phone: vendor.phone
      });
    }
  }

  // Custom business logic methods
  async getActiveVendors(): Promise<ServiceResponse<any>> {
    return await this.getVendors({ active: 'true' });
  }

  async getVendorsByGST(gstNumber: string): Promise<ServiceResponse<any>> {
    const result = await legacyVendorService.findMany();
    
    if (!result.success) {
      return result;
    }

    const vendors = result.data?.data || [];
    const filteredVendors = vendors.filter(vendor => 
      vendor.gst && vendor.gst.toLowerCase().includes(gstNumber.toLowerCase())
    );

    return {
      success: true,
      data: {
        data: filteredVendors,
        total: filteredVendors.length,
        page: 1,
        limit: filteredVendors.length,
        hasMore: false
      }
    };
  }

  async getVendorPOStats(vendorId: string): Promise<ServiceResponse<any>> {
    // This would typically call the PO service to get statistics
    // For now, we'll simulate it
    
    const vendorResult = await this.getVendor(vendorId);
    if (!vendorResult.success) {
      return vendorResult;
    }

    // In a real implementation, this would call the PO service
    const stats = {
      vendorId,
      vendorName: vendorResult.data?.name,
      totalPOs: 0,
      pendingPOs: 0,
      approvedPOs: 0,
      rejectedPOs: 0,
      totalValue: 0,
      averageOrderValue: 0
    };

    return {
      success: true,
      data: stats
    };
  }

  async notifyVendor(vendorId: string, message: string, type: 'email' | 'sms' = 'email'): Promise<ServiceResponse<void>> {
    const vendorResult = await this.getVendor(vendorId);
    
    if (!vendorResult.success) {
      return {
        success: false,
        error: {
          code: 'VENDOR_NOT_FOUND',
          message: 'Vendor not found',
          statusCode: 404
        }
      };
    }

    // Publish notification event
    await this.publishEvent('vendor.notification.required', {
      vendorId,
      message,
      type
    });

    return { success: true };
  }
}