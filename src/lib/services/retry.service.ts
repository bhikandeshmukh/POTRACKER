import { logger } from '../logger';
import { errorTrackingService } from './error-tracking.service';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay in milliseconds
  backoffMultiplier?: number;
  jitter?: boolean; // Add random jitter to prevent thundering herd
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening circuit
  resetTimeout?: number; // Time to wait before trying to close circuit (ms)
  monitoringPeriod?: number; // Time window for monitoring failures (ms)
}

export interface RetryContext {
  operation: string;
  service: string;
  userId?: string;
  userRole?: string;
}

enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open, failing fast
  HALF_OPEN = 'half-open' // Testing if service is back
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(private name: string, options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 300000 // 5 minutes
    };
  }

  /**
  * Executes the provided async function while honoring the circuit breaker state and transitions.
  * @example
  * execute(async () => fetchData())
  * Promise resolving to the result of fetchData
  * @param {{() => Promise<T>}} fn - Asynchronous callback executed when the circuit allows execution.
  * @returns {{Promise<T>}} Resolves with the callback result when the circuit is closed or half-open.
  **/
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.options.resetTimeout) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      } else {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.debug(`Circuit breaker ${this.name} moved to HALF_OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
  * Handles success counts and transitions the circuit breaker state appropriately.
  * @example
  * this.onSuccess()
  * undefined
  * @returns {void} Does not return a value.
  **/
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount += 1;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        logger.debug(`Circuit breaker ${this.name} moved to CLOSED`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = Math.max(0, this.failures - 1); // Gradually reduce failure count
    }
  }

  /**
  * Handles circuit breaker failures by incrementing counters and transitioning state with logging
  * @example
  * onFailure()
  * void
  * @param {{void}} {{}} - No parameters.
  * @returns {{void}} No return value; updates internal state only.
  **/
  private onFailure(): void {
    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      logger.debug(`Circuit breaker ${this.name} moved to OPEN from HALF_OPEN`);
    } else if (this.state === CircuitState.CLOSED && this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.debug(`Circuit breaker ${this.name} moved to OPEN due to ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    logger.debug(`Circuit breaker ${this.name} reset`);
  }
}

export class RetryService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private defaultRetryOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: this.defaultRetryCondition,
    onRetry: () => {}
  };

  // Default retry condition - retry on network errors, timeouts, and 5xx errors
  /**
  * Determine if the provided error should trigger a retry.
  * @example
  * defaultRetryCondition({ message: 'Network timeout occurred', status: 504 })
  * true
  * @param {{any}} {{error}} - Error object to evaluate for retryable conditions.
  * @returns {{boolean}} True if the error meets retryable criteria.
  **/
  private defaultRetryCondition(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return true;
    }

    // Firebase errors that are retryable
    if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('resource-exhausted')) {
      return true;
    }

    // HTTP 5xx errors
    return !!(error.status >= 500 && error.status < 600);
  }

  // Calculate delay with exponential backoff and jitter
  /******
  * Calculates the retry delay using exponential backoff with optional jitter.
  * @example
  * calculateDelay(2, { baseDelay: 100, backoffMultiplier: 2, maxDelay: 1000, jitter: true })
  * 200
  * @param {{number}} {{attempt}} - Attempt number for which delay is calculated.
  * @param {{Required<RetryOptions>}} {{options}} - Options controlling the delay calculation.
  * @returns {{number}} Calculated delay in milliseconds.
  ******/
  private calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.baseDelay * (options.backoffMultiplier ** (attempt - 1));
    let delay = Math.min(exponentialDelay, options.maxDelay);

    if (options.jitter) {
      // Add ±25% jitter
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.max(delay, 0);
  }

  // Sleep for specified duration
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get or create circuit breaker for a service
  private getCircuitBreaker(key: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker(key, options));
    }
    return this.circuitBreakers.get(key)!;
  }

  // Execute function with retry logic
  /**
  * Retries an async operation with circuit breaker support until success or attempts exhausted.
  * @example
  * executeWithRetry(() => apiCall(), {service: 'svc', operation: 'op'})
  * Promise.resolve(result)
  * @param {{() => Promise<T>}} fn - Function that performs the async operation to retry.
  * @param {{RetryContext}} context - Contextual metadata describing the service and operation.
  * @param {{RetryOptions}} options - Retry strategy overrides such as max attempts and backoff.
  * @param {{CircuitBreakerOptions|undefined}} circuitBreakerOptions - Optional configuration for the circuit breaker.
  * @returns {{Promise<T>}} Promise that resolves with the operation result or rejects with the last error.
  **/
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: RetryContext,
    options: RetryOptions = {},
    circuitBreakerOptions?: CircuitBreakerOptions
  ): Promise<T> {
    const mergedOptions = { ...this.defaultRetryOptions, ...options };
    const circuitBreakerKey = `${context.service}:${context.operation}`;
    const circuitBreaker = this.getCircuitBreaker(circuitBreakerKey, circuitBreakerOptions);

    let lastError: any;
    let attempt = 0;

    while (attempt < mergedOptions.maxAttempts) {
      attempt+=1;

      try {
        // Execute with circuit breaker
        const result = await circuitBreaker.execute(fn);
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          logger.debug(`Operation succeeded after ${attempt} attempts`, {
            service: context.service,
            operation: context.operation,
            userId: context.userId
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Track the error
        errorTrackingService.trackError(error as Error, {
          operation: context.operation,
          service: context.service,
          userId: context.userId,
          userRole: context.userRole,
          timestamp: new Date(),
          additionalData: {
            attempt,
            maxAttempts: mergedOptions.maxAttempts,
            circuitBreakerState: circuitBreaker.getState()
          }
        });

        // Check if we should retry
        const shouldRetry = attempt < mergedOptions.maxAttempts && 
                           mergedOptions.retryCondition(error) &&
                           circuitBreaker.getState() !== CircuitState.OPEN;

        if (!shouldRetry) {
          logger.error(`Operation failed after ${attempt} attempts`, {
            service: context.service,
            operation: context.operation,
            userId: context.userId,
            error: (error as Error).message,
            circuitBreakerState: circuitBreaker.getState()
          });
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt, mergedOptions);
        
        logger.debug(`Retrying operation in ${delay}ms`, {
          service: context.service,
          operation: context.operation,
          attempt,
          maxAttempts: mergedOptions.maxAttempts,
          error: (error as Error).message
        });

        // Call retry callback
        mergedOptions.onRetry(attempt, error);

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw lastError;
  }

  // Wrapper for service methods
  /**
   * Creates a retryable service method wrapper that preserves context and executes the original function with retry/circuit breaker handling.
   * @example
   * rapServiceMethod('UserService', 'getUser', (id) => fetchUser(id))
   * @param {{string}} {{service}} - Name of the service invoking the method.
   * @param {{string}} {{operation}} - Identifier of the service operation for tracing.
   * @param {{(...args: any[]) => Promise<any>}} {{fn}} - Original asynchronous function to wrap with retries.
   * @param {{RetryOptions}} {{retryOptions}} - Optional retry configuration.
   * @param {{CircuitBreakerOptions}} {{circuitBreakerOptions}} - Optional circuit breaker configuration.
   * @returns {{(...args: any[]) => Promise<any>}} Returns a wrapped function that executes the input with retry and circuit breaker logic.
   **/
  wrapServiceMethod<T extends any[], R>(
    service: string,
    operation: string,
    fn: (...args: T) => Promise<R>,
    retryOptions?: RetryOptions,
    circuitBreakerOptions?: CircuitBreakerOptions
  ) {
    return async (...args: T): Promise<R> => {
      // Extract user context from args if available
      let userId: string | undefined;
      let userRole: string | undefined;

      // Look for user context in arguments
      for (const arg of args) {
        if (arg && typeof arg === 'object' && 'uid' in arg) {
          userId = arg.uid;
          userRole = arg.role;
          break;
        }
      }

      const context: RetryContext = {
        service,
        operation,
        userId,
        userRole
      };

      return this.executeWithRetry(
        () => fn(...args),
        context,
        retryOptions,
        circuitBreakerOptions
      );
    };
  }

  // Get circuit breaker stats
  getCircuitBreakerStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, breaker] of this.circuitBreakers) {
      stats[key] = breaker.getStats();
    }

    return stats;
  }

  // Reset circuit breaker
  resetCircuitBreaker(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  // Reset all circuit breakers
  resetAllCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
    logger.debug('All circuit breakers reset');
  }

  // Get retry statistics
  /**
  * Aggregates retry circuit breaker statistics for monitoring purposes.
  * @example
  * etRetryStats()
  * { circuitBreakers: {...}, totalCircuitBreakers: 5, openCircuitBreakers: 1, halfOpenCircuitBreakers: 0 }
  * @param {{void}} [unused] - No parameters.
  * @returns {{circuitBreakers: Record<string, any>; totalCircuitBreakers: number; openCircuitBreakers: number; halfOpenCircuitBreakers: number}} Object containing circuit breaker stats.
  **/
  getRetryStats(): {
    circuitBreakers: Record<string, any>;
    totalCircuitBreakers: number;
    openCircuitBreakers: number;
    halfOpenCircuitBreakers: number;
  } {
    const circuitBreakers = this.getCircuitBreakerStats();
    const totalCircuitBreakers = this.circuitBreakers.size;
    
    let openCircuitBreakers = 0;
    let halfOpenCircuitBreakers = 0;

    for (const stats of Object.values(circuitBreakers)) {
      if (stats.state === CircuitState.OPEN) {
        openCircuitBreakers+=1;
      } else if (stats.state === CircuitState.HALF_OPEN) {
        halfOpenCircuitBreakers+=1;
      }
    }

    return {
      circuitBreakers,
      totalCircuitBreakers,
      openCircuitBreakers,
      halfOpenCircuitBreakers
    };
  }
}

// Global retry service instance
export const retryService = new RetryService();