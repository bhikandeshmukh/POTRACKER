import { logger } from '../logger';

export interface ErrorContext {
  userId?: string;
  userRole?: string;
  operation: string;
  service: string;
  timestamp: Date;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  additionalData?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  code?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  occurrences: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  tags: string[];
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByService: Record<string, number>;
  errorsByOperation: Record<string, number>;
  errorsByUser: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorRate: number;
  averageResolutionTime: number;
  topErrors: TrackedError[];
  recentErrors: TrackedError[];
}

export class ErrorTrackingService {
  private errors: Map<string, TrackedError> = new Map();
  private maxErrors = 10000; // Keep last 10k errors
  private errorCallbacks: Array<(error: TrackedError) => void> = [];

  // Generate error fingerprint for deduplication
  private generateFingerprint(error: Error, context: ErrorContext): string {
    const { operation, service } = context;
    const message = error.message || 'Unknown error';
    
    // Create a hash-like fingerprint
    return `${service}:${operation}:${message}`.replace(/[^a-zA-Z0-9:]/g, '');
  }

  // Determine error severity
  /**
  * Determine the severity level of an error based on its message and operation context.
  * @example
  * determineSeverity(new Error('Database connection failed'), {operation: 'updateRecord'})
  * 'critical'
  * @param {{Error}} {{error}} - The error object to evaluate for severity clues.
  * @param {{ErrorContext}} {{context}} - Context containing the operation that triggered the error.
  * @returns {{'low' | 'medium' | 'high' | 'critical'}} The assessed severity level for the error.
  **/
  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message?.toLowerCase() || '';
    const operation = context.operation.toLowerCase();

    // Critical errors
    if (message.includes('database') || message.includes('connection') || message.includes('timeout')) {
      return 'critical';
    }

    // High severity errors
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'high';
    }

    // Medium severity errors
    if (operation.includes('create') || operation.includes('update') || operation.includes('delete')) {
      return 'medium';
    }

    // Low severity errors (validation, not found, etc.)
    return 'low';
  }

  // Extract tags from error and context
  /**
  * Builds tags from the error and context for tracking purposes.
  * @example
  * extractTags(new Error('Network timeout occurred'), {service: 'payment', operation: 'charge', userRole: 'admin'})
  * ['service:payment', 'operation:charge', 'network', 'timeout', 'role:admin']
  * @param {{Error}} error - The error whose message is inspected for keywords.
  * @param {{ErrorContext}} context - Metadata containing service, operation, and optional user role.
  * @returns {{string[]}} The list of tags derived from the error and context.
  **/
  private extractTags(error: Error, context: ErrorContext): string[] {
    const tags: string[] = [];
    const message = error.message?.toLowerCase() || '';

    // Add service and operation tags
    tags.push(`service:${context.service}`);
    tags.push(`operation:${context.operation}`);

    // Add error type tags
    if (message.includes('network')) tags.push('network');
    if (message.includes('timeout')) tags.push('timeout');
    if (message.includes('permission')) tags.push('permission');
    if (message.includes('validation')) tags.push('validation');
    if (message.includes('not found')) tags.push('not-found');
    if (message.includes('duplicate')) tags.push('duplicate');

    // Add user role tag
    if (context.userRole) {
      tags.push(`role:${context.userRole}`);
    }

    return tags;
  }

  // Track an error
  /**
  * Records or updates an error occurrence with context and notifies callbacks.
  * @example
  * rackError(new Error('Test'), { userId: '123' })
  * { id: 'fingerprint', message: 'Test', ... }
  * @param {{Error}} error - Error instance to track.
  * @param {{ErrorContext}} context - Additional context associated with the error.
  * @returns {{TrackedError}} The tracked error record with updated metadata.
  **/
  trackError(error: Error, context: ErrorContext): TrackedError {
    const fingerprint = this.generateFingerprint(error, context);
    const now = new Date();

    let trackedError = this.errors.get(fingerprint);

    if (trackedError) {
      // Update existing error
      trackedError.occurrences += 1;
      trackedError.lastOccurrence = now;
      trackedError.context = { ...trackedError.context, ...context }; // Merge context
    } else {
      // Create new tracked error
      trackedError = {
        id: fingerprint,
        message: error.message || 'Unknown error',
        stack: error.stack,
        code: (error as any).code,
        context,
        severity: this.determineSeverity(error, context),
        resolved: false,
        occurrences: 1,
        firstOccurrence: now,
        lastOccurrence: now,
        tags: this.extractTags(error, context)
      };

      this.errors.set(fingerprint, trackedError);

      // Cleanup old errors if we exceed the limit
      if (this.errors.size > this.maxErrors) {
        this.cleanupOldErrors();
      }
    }

    // Log the error
    this.logError(trackedError);

    // Notify callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(trackedError);
      } catch (callbackError) {
        logger.error('Error in error tracking callback:', callbackError);
      }
    });

    return trackedError;
  }

  // Log error with appropriate level
  /**
  * Logs tracked error details with severity-based logging actions.
  * @example
  * logError({ id: '123', message: 'failure', severity: 'high', context: { service: 'auth', operation: 'login', userId: 'user@example.com' }, occurrences: 1, tags: ['auth'] })
  * undefined
  * @param {{TrackedError}} {{trackedError}} - The tracked error containing metadata, service context, and severity.
  * @returns {{void}} Does not return a value.
  **/
  private logError(trackedError: TrackedError): void {
    const logData = {
      errorId: trackedError.id,
      message: trackedError.message,
      severity: trackedError.severity,
      service: trackedError.context.service,
      operation: trackedError.context.operation,
      userId: trackedError.context.userId,
      occurrences: trackedError.occurrences,
      tags: trackedError.tags
    };

    switch (trackedError.severity) {
      case 'critical':
        logger.error('Critical error tracked:', logData);
        break;
      case 'high':
        logger.error('High severity error tracked:', logData);
        break;
      case 'medium':
        logger.debug('Medium severity error tracked:', logData);
        break;
      case 'low':
        logger.debug('Low severity error tracked:', logData);
        break;
    }
  }

  // Cleanup old errors
  /**
  * Removes the oldest tracked errors to keep the error store within limits.
  * @example
  * cleanupOldErrors()
  * undefined
  * @returns {void} Cleans up a portion of stored errors when the limit is reached.
  **/
  private cleanupOldErrors(): void {
    const errors = Array.from(this.errors.values());
    const sortedErrors = errors.sort((a, b) => a.lastOccurrence.getTime() - b.lastOccurrence.getTime());
    
    // Remove oldest 10%
    const toRemove = Math.floor(this.maxErrors * 0.1);
    for (let i = 0; i < toRemove; i+=1) {
      this.errors.delete(sortedErrors[i].id);
    }

    logger.debug(`Cleaned up ${toRemove} old errors`);
  }

  // Mark error as resolved
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      logger.debug(`Error ${errorId} marked as resolved`);
      return true;
    }
    return false;
  }

  // Get error by ID
  getError(errorId: string): TrackedError | undefined {
    return this.errors.get(errorId);
  }

  // Get all errors
  getAllErrors(): TrackedError[] {
    return Array.from(this.errors.values());
  }

  // Get errors by filter
  /****
  * Filters tracked errors by the provided criteria and returns them sorted by most recent occurrence.
  * @example
  * etErrorsByFilter({ service: 'auth', resolved: true })
  * [TrackedError, TrackedError]
  * @param {{service?: string; operation?: string; severity?: string; resolved?: boolean; userId?: string; tags?: string[]; timeRange?: { start: Date; end: Date }}} filter - Filters used to narrow tracked errors.
  * @returns {{TrackedError[]}} Sorted array of tracked errors matching the filter.
  ****/
  getErrorsByFilter(filter: {
    service?: string;
    operation?: string;
    severity?: string;
    resolved?: boolean;
    userId?: string;
    tags?: string[];
    timeRange?: { start: Date; end: Date };
  }): TrackedError[] {
    let errors = Array.from(this.errors.values());

    if (filter.service) {
      errors = errors.filter(e => e.context.service === filter.service);
    }

    if (filter.operation) {
      errors = errors.filter(e => e.context.operation === filter.operation);
    }

    if (filter.severity) {
      errors = errors.filter(e => e.severity === filter.severity);
    }

    if (filter.resolved !== undefined) {
      errors = errors.filter(e => e.resolved === filter.resolved);
    }

    if (filter.userId) {
      errors = errors.filter(e => e.context.userId === filter.userId);
    }

    if (filter.tags && filter.tags.length > 0) {
      errors = errors.filter(e => 
        filter.tags!.some(tag => e.tags.includes(tag))
      );
    }

    if (filter.timeRange) {
      errors = errors.filter(e => 
        e.lastOccurrence >= filter.timeRange!.start && 
        e.lastOccurrence <= filter.timeRange!.end
      );
    }

    return errors.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());
  }

  // Get error metrics
  /**
  * Computes aggregated error metrics such as counts, rates, top occurrences, and resolution times optionally scoped to a time range.
  * @example
  * etMetrics({ start: new Date('2025-01-01'), end: new Date('2025-01-02') })
  * {
  *   totalErrors: 42,
  *   errorsByService: {...},
  *   errorsByOperation: {...},
  *   errorsByUser: {...},
  *   errorsBySeverity: {...},
  *   errorRate: 1.75,
  *   averageResolutionTime: 3600000,
  *   topErrors: [...],
  *   recentErrors: [...]
  * }
  * @param {{ start: Date; end: Date }} [timeRange] - Optional time range to filter the errors included in the metrics.
  * @returns {{totalErrors: number; errorsByService: Record<string, number>; errorsByOperation: Record<string, number>; errorsByUser: Record<string, number>; errorsBySeverity: Record<string, number>; errorRate: number; averageResolutionTime: number; topErrors: ErrorRecord[]; recentErrors: ErrorRecord[]}} Aggregated error metrics for the specified time window or the last 24 hours by default.
  **/
  getMetrics(timeRange?: { start: Date; end: Date }): ErrorMetrics {
    let errors = Array.from(this.errors.values());

    if (timeRange) {
      errors = errors.filter(e => 
        e.lastOccurrence >= timeRange.start && e.lastOccurrence <= timeRange.end
      );
    }

    const totalErrors = errors.reduce((sum, e) => sum + e.occurrences, 0);
    const errorsByService: Record<string, number> = {};
    const errorsByOperation: Record<string, number> = {};
    const errorsByUser: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    errors.forEach(error => {
      // By service
      errorsByService[error.context.service] = 
        (errorsByService[error.context.service] || 0) + error.occurrences;

      // By operation
      errorsByOperation[error.context.operation] = 
        (errorsByOperation[error.context.operation] || 0) + error.occurrences;

      // By user
      if (error.context.userId) {
        errorsByUser[error.context.userId] = 
          (errorsByUser[error.context.userId] || 0) + error.occurrences;
      }

      // By severity
      errorsBySeverity[error.severity] = 
        (errorsBySeverity[error.severity] || 0) + error.occurrences;
    });

    // Calculate error rate (errors per hour)
    const timeRangeHours = timeRange 
      ? (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60)
      : 24; // Default to last 24 hours

    const errorRate = totalErrors / timeRangeHours;

    // Top errors by occurrences
    const topErrors = errors
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    // Recent errors
    const recentErrors = errors
      .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime())
      .slice(0, 20);

    // Calculate average resolution time (for resolved errors)
    const resolvedErrors = errors.filter(e => e.resolved);
    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, e) => 
          sum + (e.lastOccurrence.getTime() - e.firstOccurrence.getTime()), 0
        ) / resolvedErrors.length
      : 0;

    return {
      totalErrors,
      errorsByService,
      errorsByOperation,
      errorsByUser,
      errorsBySeverity,
      errorRate,
      averageResolutionTime,
      topErrors,
      recentErrors
    };
  }

  // Register error callback
  onError(callback: (error: TrackedError) => void): () => void {
    this.errorCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  // Clear all errors
  clearErrors(): void {
    this.errors.clear();
    logger.debug('All errors cleared');
  }

  // Export errors for external analysis
  exportErrors(): TrackedError[] {
    return Array.from(this.errors.values());
  }
}

// Global error tracking service instance
export const errorTrackingService = new ErrorTrackingService();