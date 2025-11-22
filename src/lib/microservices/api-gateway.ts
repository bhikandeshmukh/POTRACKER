import { 
  ApiGateway, 
  ServiceRequest, 
  ServiceResponse, 
  GatewayMiddleware,
  ServiceRegistry 
} from './types';
import { logger } from '../logger';
import { errorTrackingService } from '../services/error-tracking.service';
import { performanceService } from '../services/performance.service';

interface Route {
  pattern: RegExp;
  serviceName: string;
  methods?: string[];
  middleware?: string[];
}

interface RequestMetrics {
  totalRequests: number;
  requestsByService: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  averageResponseTime: number;
  errorRate: number;
}

export class ApiGatewayImpl implements ApiGateway {
  private routes: Route[] = [];
  private middlewareMap: Map<string, GatewayMiddleware> = new Map();
  private globalMiddleware: GatewayMiddleware[] = [];
  private serviceRegistry: ServiceRegistry;
  private requestMetrics: RequestMetrics = {
    totalRequests: 0,
    requestsByService: {},
    requestsByEndpoint: {},
    averageResponseTime: 0,
    errorRate: 0
  };

  constructor(serviceRegistry: ServiceRegistry) {
    this.serviceRegistry = serviceRegistry;
    this.setupDefaultMiddleware();
  }

  /**
  * Routes incoming service request through discovery, middleware, and metrics while tracking errors and returning the appropriate service response.
  * @example
  * await apiGateway.route({endpoint: '/users', method: 'GET', headers: {}, body: {}});
  * @param {{ServiceRequest<T>}} {{request}} - Request object containing endpoint, method, headers, and payload for routing.
  * @returns {{Promise<ServiceResponse<T>>}} Promise resolving to the routed service response or an error result.
  **/
  async route<T>(request: ServiceRequest<T>): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Find matching route
      const route = this.findRoute(request.endpoint, request.method);
      if (!route) {
        return this.createErrorResponse('ROUTE_NOT_FOUND', 'No route found for request', 404);
      }

      // Discover service
      const serviceConfig = await this.serviceRegistry.discover(route.serviceName);
      if (!serviceConfig) {
        return this.createErrorResponse('SERVICE_UNAVAILABLE', `Service ${route.serviceName} not available`, 503);
      }

      // Add gateway headers
      const enrichedRequest: ServiceRequest<T> = {
        ...request,
        headers: {
          ...request.headers,
          'x-request-id': requestId,
          'x-gateway': 'api-gateway',
          'x-forwarded-for': request.headers?.['x-forwarded-for'] || 'unknown'
        }
      };

      // Execute middleware chain
      const response = await this.executeMiddlewareChain(
        enrichedRequest,
        route,
        async (req) => {
          // This would typically make an HTTP call to the microservice
          // For now, we'll simulate the service call
          return this.callService(route.serviceName, req);
        }
      );

      // Update metrics
      this.updateMetrics(route.serviceName, request.endpoint, Date.now() - startTime, response.success);

      return response;
    } catch (error) {
      // Track error
      errorTrackingService.trackError(error as Error, {
        operation: 'api_gateway_route',
        service: 'api-gateway',
        timestamp: new Date(),
        requestId,
        additionalData: {
          endpoint: request.endpoint,
          method: request.method
        }
      });

      return this.createErrorResponse('GATEWAY_ERROR', 'Internal gateway error', 500);
    }
  }

  /**
  * Registers a new route mapping with an optional set of HTTP methods and middleware in the gateway.
  * @example
  * ddRoute('/users', 'users-service')
  * undefined
  * @param {{string}} pattern - Pattern string to match incoming request paths.
  * @param {{string}} serviceName - Target service name associated with the route.
  * @param {{{methods?: string[]; middleware?: string[];}}} [options] - Optional configuration for HTTP methods and middleware.
  * @returns {{void}} No value is returned.
  **/
  addRoute(pattern: string, serviceName: string, options?: {
    methods?: string[];
    middleware?: string[];
  }): void {
    const route: Route = {
      pattern: new RegExp(pattern),
      serviceName,
      methods: options?.methods,
      middleware: options?.middleware
    };

    this.routes.push(route);
    logger.debug(`Route added: ${pattern} -> ${serviceName}`);
  }

  removeRoute(pattern: string): void {
    const index = this.routes.findIndex(route => route.pattern.source === pattern);
    if (index > -1) {
      this.routes.splice(index, 1);
      logger.debug(`Route removed: ${pattern}`);
    }
  }

  middleware(middleware: GatewayMiddleware): void {
    this.middlewareMap.set(middleware.name, middleware);
    logger.debug(`Middleware registered: ${middleware.name}`);
  }

  // Add global middleware (applies to all routes)
  addGlobalMiddleware(middleware: GatewayMiddleware): void {
    this.globalMiddleware.push(middleware);
    logger.debug(`Global middleware added: ${middleware.name}`);
  }

  // Get middleware by name
  getMiddleware(name: string): GatewayMiddleware | undefined {
    return this.middlewareMap.get(name);
  }

  // Remove global middleware
  removeGlobalMiddleware(middlewareName: string): void {
    const index = this.globalMiddleware.findIndex(m => m.name === middlewareName);
    if (index > -1) {
      this.globalMiddleware.splice(index, 1);
      logger.debug(`Global middleware removed: ${middlewareName}`);
    }
  }

  // Get gateway statistics
  /**
  * Aggregate statistics about registered routes, middleware, and request metrics.
  * @example
  * etStats()
  * { totalRoutes: 10, totalMiddleware: 5, metrics: { ... }, routes: [ { pattern: "/foo", serviceName: "foo", methods: ["GET"] } ] }
  * @returns {{ totalRoutes: number; totalMiddleware: number; metrics: RequestMetrics; routes: Array<{ pattern: string; serviceName: string; methods?: string[] }> }} Aggregated route, middleware, and metric statistics.
  **/
  getStats(): {
    totalRoutes: number;
    totalMiddleware: number;
    metrics: RequestMetrics;
    routes: Array<{
      pattern: string;
      serviceName: string;
      methods?: string[];
    }>;
  } {
    return {
      totalRoutes: this.routes.length,
      totalMiddleware: this.middlewareMap.size + this.globalMiddleware.length,
      metrics: { ...this.requestMetrics },
      routes: this.routes.map(route => ({
        pattern: route.pattern.source,
        serviceName: route.serviceName,
        methods: route.methods
      }))
    };
  }

  // Health check
  /**
  * Checks the current health of the API gateway and reports summary metrics.
  * @example
  * healthCheck()
  * {
  *   status: 'healthy',
  *   details: { totalRoutes: 5, errorRate: 2.3, averageResponseTime: 180 }
  * }
  * @returns {{Promise<{status: 'healthy' | 'degraded' | 'unhealthy'; details: {totalRoutes: number; errorRate: number; averageResponseTime: number}}}} Promise resolving with the health status and metrics.
  **/
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalRoutes: number;
      errorRate: number;
      averageResponseTime: number;
    };
  }> {
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (this.requestMetrics.errorRate > 10) {
      status = 'unhealthy';
    } else if (this.requestMetrics.errorRate > 5 || this.requestMetrics.averageResponseTime > 2000) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        totalRoutes: this.routes.length,
        errorRate: this.requestMetrics.errorRate,
        averageResponseTime: this.requestMetrics.averageResponseTime
      }
    };
  }

  // Private helper methods
  private findRoute(endpoint: string, method: string): Route | null {
    for (const route of this.routes) {
      if (route.pattern.test(endpoint) && (!route.methods || route.methods.includes(method))) {
        return route;
      }
    }
    return null;
  }

  /**
  * Executes the configured middleware chain for a route before invoking the primary handler.
  * @example
  * executeMiddlewareChain(request, route, handler)
  * Promise<ServiceResponse<T>>
  * @param {{ServiceRequest<T>}} request - Incoming service request processed through the middleware stack.
  * @param {{Route}} route - Route metadata that identifies middleware to apply for this request.
  * @param {{(req: ServiceRequest<T>) => Promise<ServiceResponse<T>>}} handler - Primary handler invoked after all middleware have run.
  * @returns {{Promise<ServiceResponse<T>>}} Promise resolving to the service response produced by the handler.
  **/
  private async executeMiddlewareChain<T>(
    request: ServiceRequest<T>,
    route: Route,
    handler: (req: ServiceRequest<T>) => Promise<ServiceResponse<T>>
  ): Promise<ServiceResponse<T>> {
    const middlewareChain: GatewayMiddleware[] = [
      ...this.globalMiddleware,
      ...(route.middleware?.map(name => this.middlewareMap.get(name)).filter((m): m is GatewayMiddleware => m !== undefined) || [])
    ];

    let index = 0;

    const next = async (): Promise<ServiceResponse<T>> => {
      if (index >= middlewareChain.length) {
        return handler(request);
      }

      const middleware = middlewareChain[index++];
      return middleware.execute(request, next);
    };

    return next();
  }

  /**
  * Makes a simulated HTTP call to the given microservice and returns a mock response.
  * @example
  * callService('user-service', { payload: {} })
  * Promise<{ success: true, data: {}, metadata: { requestId: 'abc', timestamp: Date, duration: 42 } }>
  * @param {{string}} serviceName - Name of the microservice to invoke.
  * @param {{ServiceRequest<T>}} request - Payload describing the service call.
  * @returns {{Promise<ServiceResponse<T>>}} Simulated response from the microservice.
  **/
  private async callService<T>(serviceName: string, request: ServiceRequest<T>): Promise<ServiceResponse<T>> {
    // This would typically make an HTTP call to the microservice
    // For now, we'll simulate it by returning a success response
    return {
      success: true,
      data: {} as T,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration: Math.random() * 100 // Simulate response time
      }
    };
  }

  /**
  * Generates a standardized error response object for failed requests.
  * @example
  * this.createErrorResponse('INVALID_INPUT', 'The provided data is invalid.', 400)
  * { success: false, error: { code: 'INVALID_INPUT', message: 'The provided data is invalid.', statusCode: 400, retryable: false }, metadata: { requestId: '...', timestamp: ..., duration: 0 } }
  * @param {{string}} code - Error code identifying the type of failure.
  * @param {{string}} message - Human-readable error message describing the failure.
  * @param {{number}} statusCode - HTTP status code associated with the error response.
  * @returns {{ServiceResponse<T>}} Standardized service response marking the operation as unsuccessful.
  **/
  private createErrorResponse<T>(code: string, message: string, statusCode: number): ServiceResponse<T> {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        retryable: statusCode >= 500
      },
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration: 0
      }
    };
  }

  private generateRequestId(): string {
    return `gw_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
  * Updates aggregate request metrics for monitoring purposes.
  * @example
  * updateMetrics('orders', '/orders', 120, true)
  * undefined
  * @param {{string}} serviceName - Name of the service that handled the request.
  * @param {{string}} endpoint - Endpoint that was invoked.
  * @param {{number}} duration - Duration of the request in milliseconds.
  * @param {{boolean}} success - Whether the request succeeded.
  * @returns {{void}} No return value.
  **/
  private updateMetrics(serviceName: string, endpoint: string, duration: number, success: boolean): void {
    this.requestMetrics.totalRequests += 1;
    this.requestMetrics.requestsByService[serviceName] = 
      (this.requestMetrics.requestsByService[serviceName] || 0) + 1;
    this.requestMetrics.requestsByEndpoint[endpoint] = 
      (this.requestMetrics.requestsByEndpoint[endpoint] || 0) + 1;

    // Update average response time (simple moving average)
    this.requestMetrics.averageResponseTime = 
      (this.requestMetrics.averageResponseTime * (this.requestMetrics.totalRequests - 1) + duration) / 
      this.requestMetrics.totalRequests;

    // Update error rate
    const errorCount = success ? 0 : 1;
    this.requestMetrics.errorRate = 
      (this.requestMetrics.errorRate * (this.requestMetrics.totalRequests - 1) + errorCount * 100) / 
      this.requestMetrics.totalRequests;
  }

  /**
  * Initializes default middleware for logging, rate limiting, and CORS, and registers the logging middleware globally.
  * @example
  * setupDefaultMiddleware()
  * undefined
  * @returns {void} Performs setup without returning a value.
  **/
  private setupDefaultMiddleware(): void {
    // Logging middleware
    this.middlewareMap.set('logging', {
      name: 'logging',
      execute: async <T>(request: ServiceRequest<T>, next: () => Promise<ServiceResponse<T>>) => {
        const startTime = Date.now();
        logger.debug(`Gateway request: ${request.method} ${request.endpoint}`);
        
        const response = await next();
        const duration = Date.now() - startTime;
        
        logger.debug(`Gateway response: ${request.method} ${request.endpoint} - ${response.success ? 'SUCCESS' : 'ERROR'} (${duration}ms)`);
        
        return response;
      }
    });

    // Rate limiting middleware (basic implementation)
    const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
    this.middlewareMap.set('rate-limit', {
      name: 'rate-limit',
      execute: async <T>(request: ServiceRequest<T>, next: () => Promise<ServiceResponse<T>>) => {
        const clientId = request.headers?.['x-client-id'] || 'anonymous';
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 100; // 100 requests per minute

        const clientData = rateLimitMap.get(clientId);
        
        if (!clientData || now > clientData.resetTime) {
          rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
          return next();
        }

        if (clientData.count >= maxRequests) {
          return {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded',
              statusCode: 429,
              retryable: true
            },
            metadata: {
              requestId: this.generateRequestId(),
              timestamp: new Date(),
              duration: 0
            }
          };
        }

        clientData.count += 1;
        return next();
      }
    });

    // CORS middleware
    this.middlewareMap.set('cors', {
      name: 'cors',
      execute: async <T>(request: ServiceRequest<T>, next: () => Promise<ServiceResponse<T>>) => {
        const response = await next();
        
        // Add CORS headers to response (in a real implementation)
        // Note: In a real implementation, these would be added to HTTP response headers
        
        return response;
      }
    });

    // Add default global middleware
    this.addGlobalMiddleware(this.middlewareMap.get('logging')!);
  }
}