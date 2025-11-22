import { BaseMicroservice } from '../base-service';
import { ServiceConfig, ServiceRequest, ServiceResponse } from '../types';
import { poService as legacyPOService } from '../../services';
import { PurchaseOrder, CreatePOForm } from '../../types';
import { logger } from '../../logger';

export class POMicroservice extends BaseMicroservice {
  /**
  * Initializes the PoService with its retry policy and circuit breaker configuration.
  * @example
  * new PoService()
  * undefined
  * @param {{}} [config] - No arguments required.
  * @returns {{void}} Instantiates the service with the predefined configuration.
  **/
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

  /**
  * Initializes the PO microservice by registering health checks and event handlers.
  * @example
  * initialize()
  * undefined
  * @returns {Promise<void>} Promise that resolves when initialization completes.
  **/
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

  /**
  * Handles PO service requests by routing to the appropriate endpoint handler and normalizing errors.
  * @example
  * handleRequest({ method: 'GET', endpoint: '/pos', data: null, params: {} })
  * { success: true, data: [] }
  * @param {{ServiceRequest<T>}} {{request}} - The request payload describing method, endpoint, data, and params.
  * @returns {{Promise<ServiceResponse<T>>}} Normalized service response including success flag and any data or error details.
  **/
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
  /**
  * Handles purchase order endpoint requests with appropriate HTTP methods.
  * @example
  * handlePOsEndpoint('GET', null, { limit: 10 })
  * { success: true, data: [...] }
  * @param {{string}} method - HTTP method for the /pos endpoint.
  * @param {{any}} data - Payload data for POST requests.
  * @param {{any}} params - Query parameters for GET requests.
  * @returns {{Promise<ServiceResponse<any>>}} Service response indicating success, failure, or error details.
  **/
  private async handlePOsEndpoint(
    method: string, 
    data: any, 
    params: any
  ): Promise<ServiceResponse<any>> {
    switch (method) {
      case 'GET':
        return await this.getPOs(params);
      case 'POST':
        return await this.handleCreatePO(data);
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

  /**
  * Handles a single PO request for the specified HTTP method.
  * @example
  * handleSinglePO('GET', 'po-123', null)
  * { success: true, data: {...} }
  * @param {{string}} {{method}} - HTTP method to execute for the PO.
  * @param {{string}} {{poId}} - Identifier of the purchase order.
  * @param {{any}} {{data}} - Payload for PUT or DELETE requests.
  * @returns {{Promise<ServiceResponse<any>>}} Result of the requested PO operation.
  **/
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

  /**
  * Handles creation of a purchase order by validating input, invoking legacy service, and publishing events.
  * @example
  * handleCreatePO({ poData: { sku: '123' }, userContext: { userId: 'u-1' } })
  * { success: true, data: { id: 'po-1', poNumber: 'PO-001' } }
  * @param {{any}} {{data}} - Payload containing poData, userContext, and optional vendor information.
  * @returns {{Promise<ServiceResponse<PurchaseOrder>>}} Returns the converted service response for the purchase order creation.
  **/
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

    const result = await legacyPOService.createPO(
      data.poData, 
      data.userContext, 
      data.vendorName,
      data.customPONumber
    );
    
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

    return this.convertApiResponse(result);
  }

  /**
   * Handles searching purchase orders by delegating to legacy service and converting the response.
   * @example
   * handleSearchPOs({ searchTerm: 'order123', userId: 'user1', role: 'admin' })
   * { success: true, data: [...] }
   * @param {{any}} {{params}} - Parameters containing searchTerm, userId, and role for the query.
   * @returns {{Promise<ServiceResponse<any>>}} Converted service response with the search results.
   */
  private async handleSearchPOs(params: any): Promise<ServiceResponse<any>> {
    const { searchTerm, userId, role } = params;
    
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

    const result = await legacyPOService.searchPOs(searchTerm, userId, role);
    return this.convertApiResponse(result);
  }

  /**
  * Computes purchase order statistics from legacy service data.
  * @example
  * this.handlePOStats()
  * { success: true, data: { total: 5, byStatus: { OPEN: 2, CLOSED: 3 }, totalAmount: 15000 } }
  * @returns {Promise<ServiceResponse<any>>} Aggregated counts and amounts grouped by purchase order status.
  **/
  private async handlePOStats(): Promise<ServiceResponse<any>> {
    // Since getPOStats doesn't exist, let's create a basic stats implementation
    const result = await legacyPOService.findMany({ limit: 1000 });
    
    if (!result.success || !result.data) {
      return this.convertApiResponse(result);
    }

    const pos = result.data.data;
    const stats = {
      total: pos.length,
      byStatus: pos.reduce((acc: any, po: any) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      }, {}),
      totalAmount: pos.reduce((sum: number, po: any) => sum + po.totalAmount, 0)
    };

    return {
      success: true,
      data: stats
    };
  }

  /**
  * Retrieves purchase orders either for a specific user or based on provided query filters in one call.
  * @example
  * getPOs({ userId: '123', role: 'manager', limit: 10 })
  * { success: true, data: [...] }
  * @param {{any}} params - Parameters including optional userId, role, limit, status, and vendorId.
  * @returns {{Promise<ServiceResponse<any>>}} Service response containing purchase order data.
  **/
  private async getPOs(params: any): Promise<ServiceResponse<any>> {
    const { userId, role, limit, status, vendorId } = params;
    
    if (userId && role) {
      const result = await legacyPOService.getPOsForUser(userId, role, limit || 50);
      return this.convertApiResponse(result);
    }
    
    // Build query options
    const queryOptions: any = {};
    if (limit) queryOptions.limit = parseInt(limit);
    if (status || vendorId) {
      queryOptions.where = [];
      if (status) queryOptions.where.push({ field: 'status', operator: '==', value: status });
      if (vendorId) queryOptions.where.push({ field: 'vendorId', operator: '==', value: vendorId });
    }

    const result = await legacyPOService.findMany(queryOptions);
    return this.convertApiResponse(result);
  }

  private async getPO(poId: string): Promise<ServiceResponse<PurchaseOrder>> {
    const result = await legacyPOService.findById(poId);
    return this.convertApiResponse(result);
  }

  /**
  * Updates a purchase order, handling status changes specially and publishing related events.
  * @example
  * updatePO('po123', { updates: { status: 'APPROVED' }, userContext: 'user1', reason: 'reviewed' })
  * { success: true, data: { ... } }
  * @param {{string}} poId - Identifier for the purchase order to update.
  * @param {{any}} data - Payload containing updates, user context, and optional reason.
  * @returns {{ServiceResponse<PurchaseOrder>}} Service response containing the updated purchase order.
  **/
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
      const result = await legacyPOService.updateStatus(
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

      return this.convertApiResponse(result);
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

    return this.convertApiResponse(result);
  }

  /****
  * Deletes a purchase order and optionally publishes a delete event when successful.
  * @example
  * deletePO('abc123', { userContext: 'user-1' })
  * { success: true }
  * @param {{string}} {poId} - ID of the purchase order to delete.
  * @param {{any}} {data} - Payload containing required context for deletion.
  * @returns {{Promise<ServiceResponse<void>>}} Promise resolving to the service response for the deletion request.
  ****/
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

    const result = await legacyPOService.delete(poId);
    
    if (result.success) {
      // Publish delete event
      await this.publishEvent('po.deleted', {
        poId,
        deletedBy: data.userContext
      });
    }

    return this.convertApiResponse(result);
  }

  // Event handlers
  /**
  * Handles purchase order status change events and triggers follow-up actions.
  * @example
  * handlePOStatusChanged({ data: { poId: 'PO123', newStatus: 'Approved', vendorId: 'VEND1' }})
  * undefined
  * @param {{any}} event - Event payload containing PO status and related metadata.
  * @returns {{Promise<void>}} Promise resolved once the status change has been processed.
  **/
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

  // Helper method to convert ApiResponse to ServiceResponse
  /**
  * Maps a raw API response into the internal ServiceResponse format.
  * @example
  * convertApiResponse({ success: true, data: { id: 1 } })
  * { success: true, data: { id: 1 } }
  * @param {{any}} apiResponse - API response object containing success flag and payload or error details.
  * @returns {{ServiceResponse<T>}} Standardized service response wrapping success data or error details.
  **/
  private convertApiResponse<T>(apiResponse: any): ServiceResponse<T> {
    if (apiResponse.success) {
      return {
        success: true,
        data: apiResponse.data
      };
    } else {
      return {
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message: apiResponse.error || 'Unknown error',
          statusCode: 500
        }
      };
    }
  }
}