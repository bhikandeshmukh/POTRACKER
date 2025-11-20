import { ServiceRequest, ServiceResponse } from './types';
import { logger } from '../logger';
import { errorTrackingService } from '../services/error-tracking.service';
import { performanceService } from '../services/performance.service';

export interface ClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  enableMetrics?: boolean;
}

export class MicroserviceClient {
  private config: ClientConfig;
  private requestInterceptors: Array<(request: ServiceRequest) => ServiceRequest | Promise<ServiceRequest>> = [];
  private responseInterceptors: Array<(response: ServiceResponse) => ServiceResponse | Promise<ServiceResponse>> = [];

  constructor(config: ClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || '/api/v1',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      headers: config.headers || {},
      enableMetrics: config.enableMetrics !== false
    };

    this.setupDefaultInterceptors();
  }

  // Make a request to a microservice
  async request<T, R = any>(request: ServiceRequest<T>): Promise<ServiceResponse<R>> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: any;

    // Apply request interceptors
    let processedRequest = request;
    for (const interceptor of this.requestInterceptors) {
      processedRequest = await interceptor(processedRequest);
    }

    while (attempt < (this.config.retries || 1)) {
      attempt++;

      try {
        const response = await this.executeRequest<T, R>(processedRequest);
        
        // Apply response interceptors
        let processedResponse = response;
        for (const interceptor of this.responseInterceptors) {
          processedResponse = await interceptor(processedResponse);
        }

        // Track metrics
        if (this.config.enableMetrics) {
          this.trackMetrics(request.endpoint, Date.now() - startTime, response.success, attempt);
        }

        return processedResponse;
      } catch (error) {
        lastError = error;
        
        // Track error
        if (this.config.enableMetrics) {
          errorTrackingService.trackError(error as Error, {
            operation: request.endpoint,
            service: 'microservice-client',
            timestamp: new Date(),
            additionalData: {
              attempt,
              maxRetries: this.config.retries,
              method: request.method
            }
          });
        }

        // Check if we should retry
        if (attempt >= (this.config.retries || 1) || !this.shouldRetry(error)) {
          break;
        }

        // Wait before retry
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: {
        code: 'CLIENT_ERROR',
        message: lastError?.message || 'Request failed',
        details: lastError,
        retryable: this.shouldRetry(lastError)
      },
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration: Date.now() - startTime
      }
    };
  }

  // Convenience methods for different HTTP methods
  async get<R = any>(endpoint: string, params?: Record<string, any>): Promise<ServiceResponse<R>> {
    return this.request<never, R>({
      method: 'GET',
      endpoint,
      params
    });
  }

  async post<T, R = any>(endpoint: string, data: T): Promise<ServiceResponse<R>> {
    return this.request<T, R>({
      method: 'POST',
      endpoint,
      data
    });
  }

  async put<T, R = any>(endpoint: string, data: T): Promise<ServiceResponse<R>> {
    return this.request<T, R>({
      method: 'PUT',
      endpoint,
      data
    });
  }

  async delete<R = any>(endpoint: string): Promise<ServiceResponse<R>> {
    return this.request<never, R>({
      method: 'DELETE',
      endpoint
    });
  }

  // Interceptor management
  addRequestInterceptor(interceptor: (request: ServiceRequest) => ServiceRequest | Promise<ServiceRequest>): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: (response: ServiceResponse) => ServiceResponse | Promise<ServiceResponse>): void {
    this.responseInterceptors.push(interceptor);
  }

  // Service-specific client methods
  createPOClient(): POServiceClient {
    return new POServiceClient(this);
  }

  createVendorClient(): VendorServiceClient {
    return new VendorServiceClient(this);
  }

  // Private helper methods
  private async executeRequest<T, R>(request: ServiceRequest<T>): Promise<ServiceResponse<R>> {
    // In a real implementation, this would make HTTP requests
    // For now, we'll simulate the request by calling the orchestrator directly
    
    // This is a simplified implementation - in production, you'd use fetch or axios
    const url = `${this.config.baseUrl}${request.endpoint}`;
    const options: RequestInit = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
        ...request.headers
      },
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    };

    if (request.data && request.method !== 'GET') {
      options.body = JSON.stringify(request.data);
    }

    // Add query parameters for GET requests
    let finalUrl = url;
    if (request.params && Object.keys(request.params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(request.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      finalUrl += `?${searchParams.toString()}`;
    }

    try {
      const response = await fetch(finalUrl, options);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || response.statusText,
            statusCode: response.status,
            retryable: response.status >= 500
          },
          metadata: {
            requestId: this.generateRequestId(),
            timestamp: new Date(),
            duration: 0
          }
        };
      }

      return {
        success: true,
        data,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date(),
          duration: 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Network errors, timeouts, and 5xx errors are retryable
    return error?.name === 'AbortError' ||
           error?.code === 'NETWORK_ERROR' ||
           (error?.statusCode && error.statusCode >= 500);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private trackMetrics(endpoint: string, duration: number, success: boolean, attempts: number): void {
    performanceService.recordMetric({
      operation: endpoint,
      service: 'microservice-client',
      duration,
      timestamp: new Date(),
      success,
      cacheHit: false
    });
  }

  private setupDefaultInterceptors(): void {
    // Request logging interceptor
    this.addRequestInterceptor((request) => {
      logger.debug(`Client request: ${request.method} ${request.endpoint}`);
      return request;
    });

    // Response logging interceptor
    this.addResponseInterceptor((response) => {
      logger.debug(`Client response: ${response.success ? 'SUCCESS' : 'ERROR'}`);
      return response;
    });

    // Authentication interceptor (if needed)
    this.addRequestInterceptor((request) => {
      // Add authentication headers if available
      const token = this.getAuthToken();
      if (token) {
        request.headers = {
          ...request.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      return request;
    });
  }

  private getAuthToken(): string | null {
    // Get authentication token from storage or context
    // This would integrate with your auth system
    return null;
  }
}

// Service-specific client classes
export class POServiceClient {
  constructor(private client: MicroserviceClient) {}

  async getPOs(params?: { userId?: string; role?: string; limit?: number; status?: string; vendorId?: string }) {
    return this.client.get('/pos', params);
  }

  async getPO(poId: string) {
    return this.client.get(`/pos/${poId}`);
  }

  async createPO(poData: any, userContext: any) {
    return this.client.post('/pos', { poData, userContext });
  }

  async updatePO(poId: string, updates: any, userContext: any) {
    return this.client.put(`/pos/${poId}`, { updates, userContext });
  }

  async deletePO(poId: string, userContext: any) {
    return this.client.delete(`/pos/${poId}`);
  }

  async searchPOs(searchTerm: string, userId?: string, role?: string, limit?: number) {
    return this.client.get('/pos/search', { searchTerm, userId, role, limit });
  }

  async getPOStats() {
    return this.client.get('/pos/stats');
  }

  async approvePO(poId: string, userContext: any, reason?: string) {
    return this.client.put(`/pos/${poId}`, {
      updates: { status: 'Approved' },
      userContext,
      reason
    });
  }

  async rejectPO(poId: string, userContext: any, reason: string) {
    return this.client.put(`/pos/${poId}`, {
      updates: { status: 'Rejected' },
      userContext,
      reason
    });
  }
}

export class VendorServiceClient {
  constructor(private client: MicroserviceClient) {}

  async getVendors(params?: { limit?: number; active?: boolean }) {
    return this.client.get('/vendors', params);
  }

  async getVendor(vendorId: string) {
    return this.client.get(`/vendors/${vendorId}`);
  }

  async createVendor(vendorData: any, userContext: any) {
    return this.client.post('/vendors', { vendorData, userContext });
  }

  async updateVendor(vendorId: string, updates: any, userContext: any) {
    return this.client.put(`/vendors/${vendorId}`, { updates, userContext });
  }

  async deleteVendor(vendorId: string, userContext: any) {
    return this.client.delete(`/vendors/${vendorId}`);
  }

  async searchVendors(searchTerm: string) {
    return this.client.get('/vendors/search', { searchTerm });
  }

  async getVendorStats() {
    return this.client.get('/vendors/stats');
  }

  async getActiveVendors() {
    return this.client.get('/vendors', { active: true });
  }

  async notifyVendor(vendorId: string, message: string, type: 'email' | 'sms' = 'email') {
    return this.client.post(`/vendors/${vendorId}/notify`, { message, type });
  }
}

// Global client instance
export const microserviceClient = new MicroserviceClient();

// Export service clients
export const poClient = microserviceClient.createPOClient();
export const vendorClient = microserviceClient.createVendorClient();