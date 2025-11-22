// Core microservice types and interfaces

export interface ServiceConfig {
  name: string;
  version: string;
  baseUrl?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerConfig;
  authentication?: AuthConfig;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: any) => boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'firebase';
  tokenProvider?: () => Promise<string>;
  apiKey?: string;
}

export interface ServiceRequest<T = any> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: T;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: {
    requestId: string;
    timestamp: Date;
    duration: number;
    fromCache?: boolean;
    retryAttempt?: number;
  };
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
  statusCode?: number;
}

export interface ServiceEvent<T = any> {
  type: string;
  service: string;
  data: T;
  timestamp: Date;
  correlationId?: string;
  userId?: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheck[];
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  duration: number;
  output?: string;
}

// Service Discovery
export interface ServiceRegistry {
  register(service: ServiceConfig): Promise<void>;
  unregister(serviceName: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceConfig | null>;
  listServices(): Promise<ServiceConfig[]>;
  healthCheck(serviceName: string): Promise<ServiceHealth>;
}

// Event Bus
export interface EventBus {
  publish<T>(event: ServiceEvent<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: (event: ServiceEvent<T>) => Promise<void>): () => void;
  unsubscribe(eventType: string, handler: (event: ServiceEvent<any>) => Promise<void>): void;
}

// API Gateway
export interface ApiGateway {
  route<T>(request: ServiceRequest<T>): Promise<ServiceResponse<T>>;
  addRoute(pattern: string, serviceName: string): void;
  removeRoute(pattern: string): void;
  middleware(middleware: GatewayMiddleware): void;
}

export interface GatewayMiddleware {
  name: string;
  execute<T>(request: ServiceRequest<T>, next: () => Promise<ServiceResponse<T>>): Promise<ServiceResponse<T>>;
}

// Service Mesh
export interface ServiceMesh {
  proxy<T>(serviceName: string, request: ServiceRequest<T>): Promise<ServiceResponse<T>>;
  loadBalance(serviceName: string, instances: ServiceConfig[]): ServiceConfig;
  circuitBreaker(serviceName: string): boolean;
}

// Data patterns
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findMany(criteria?: any): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  registerNew<T>(entity: T): void;
  registerDirty<T>(entity: T): void;
  registerDeleted<T>(entity: T): void;
}

// CQRS patterns
export interface Command<T = any> {
  type: string;
  payload: T;
  metadata?: {
    userId?: string;
    correlationId?: string;
    timestamp?: Date;
  };
}

export interface Query<T = any> {
  type: string;
  parameters: T;
  metadata?: {
    userId?: string;
    correlationId?: string;
  };
}

export interface CommandHandler<TCommand extends Command, TResult = any> {
  handle(command: TCommand): Promise<TResult>;
}

export interface QueryHandler<TQuery extends Query, TResult = any> {
  handle(query: TQuery): Promise<TResult>;
}

// Saga pattern
export interface SagaStep<T = any> {
  execute(data: T): Promise<any>;
  compensate(data: T): Promise<void>;
}

export interface Saga<T = any> {
  steps: SagaStep<T>[];
  execute(data: T): Promise<any>;
}

// Domain events
export interface DomainEvent<T = any> {
  aggregateId: string;
  eventType: string;
  eventData: T;
  version: number;
  timestamp: Date;
  userId?: string;
}

export interface EventStore {
  saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromTimestamp?: Date): Promise<DomainEvent[]>;
}