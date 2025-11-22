import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  QueryConstraint,
  DocumentSnapshot,
  QuerySnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../logger';
import { BaseEntity, QueryOptions } from '../types';
import { errorTrackingService } from './error-tracking.service';

export interface SubscriptionOptions extends QueryOptions {
  includeMetadataChanges?: boolean;
}

export interface SubscriptionCallback<T> {
  onData: (data: T[]) => void;
  onError?: (error: Error) => void;
  onLoading?: (loading: boolean) => void;
}

export interface DocumentSubscriptionCallback<T> {
  onData: (data: T | null) => void;
  onError?: (error: Error) => void;
  onLoading?: (loading: boolean) => void;
}

export interface Subscription {
  id: string;
  collectionName: string;
  type: 'collection' | 'document';
  active: boolean;
  createdAt: Date;
  lastUpdate: Date;
  errorCount: number;
  unsubscribe: Unsubscribe;
}

export interface RealtimeMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  subscriptionsByCollection: Record<string, number>;
  averageUpdateFrequency: number;
  errorRate: number;
  totalUpdates: number;
  recentErrors: Array<{
    subscriptionId: string;
    error: string;
    timestamp: Date;
  }>;
}

export class RealtimeService {
  private subscriptions: Map<string, Subscription> = new Map();
  private updateCounts: Map<string, number> = new Map();
  private recentErrors: Array<{
    subscriptionId: string;
    error: string;
    timestamp: Date;
  }> = [];

  // Generate unique subscription ID
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Build query constraints
  /**
  * Builds Firestore query constraints for a collection based on the provided options.
  * @example
  * buildQuery('users', { where: [{ field: 'active', operator: '==', value: true }], limit: 10 })
  * [QueryConstraint, ...]
  * @param {{string}} {{collectionName}} - Name of the collection to query.
  * @param {{SubscriptionOptions|undefined}} {{options}} - Optional filtering, ordering, and limiting options.
  * @returns {{QueryConstraint[]}} Array of Firestore query constraints derived from the provided options.
  **/
  private buildQuery(collectionName: string, options?: SubscriptionOptions): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];

    if (options?.where) {
      options.where.forEach(condition => {
        constraints.push(where(condition.field, condition.operator, condition.value));
      });
    }

    if (options?.orderBy) {
      constraints.push(orderBy(options.orderBy, options.orderDirection || 'desc'));
    }

    if (options?.limit) {
      constraints.push(limit(options.limit));
    }

    return constraints;
  }

  // Subscribe to a collection
  /**
  * Subscribes to a collection and manages real-time updates through the provided callback.
  * @example
  * ubscribeToCollection('users', realtimeCallback, { includeMetadataChanges: true })
  * 'subscriptionId123'
  * @param {{string}} collectionName - Name of the collection to subscribe to.
  * @param {{SubscriptionCallback<T>}} callback - Callback invoked on loading, data, and errors.
  * @param {{SubscriptionOptions}} [options] - Optional query and subscription configuration.
  * @returns {{string}} Identifier for the created subscription.
  **/
  subscribeToCollection<T extends BaseEntity>(
    collectionName: string,
    callback: SubscriptionCallback<T>,
    options?: SubscriptionOptions
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    try {
      callback.onLoading?.(true);

      const constraints = this.buildQuery(collectionName, options);
      const q = query(collection(db, collectionName), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        {
          includeMetadataChanges: options?.includeMetadataChanges || false
        },
        (snapshot: QuerySnapshot) => {
          try {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as T));

            // Update metrics
            this.updateSubscriptionMetrics(subscriptionId);

            callback.onLoading?.(false);
            callback.onData(data);

            logger.debug(`Collection subscription ${subscriptionId} updated`, {
              collection: collectionName,
              documentCount: data.length,
              fromCache: snapshot.metadata.fromCache
            });
          } catch (error) {
            this.handleSubscriptionError(subscriptionId, error as Error, callback.onError);
          }
        },
        (error: Error) => {
          this.handleSubscriptionError(subscriptionId, error, callback.onError);
        }
      );

      // Register subscription
      const subscription: Subscription = {
        id: subscriptionId,
        collectionName,
        type: 'collection',
        active: true,
        createdAt: new Date(),
        lastUpdate: new Date(),
        errorCount: 0,
        unsubscribe
      };

      this.subscriptions.set(subscriptionId, subscription);
      this.updateCounts.set(subscriptionId, 0);

      logger.debug(`Collection subscription created`, {
        subscriptionId,
        collection: collectionName,
        options
      });

      return subscriptionId;
    } catch (error) {
      callback.onError?.(error as Error);
      throw error;
    }
  }

  // Subscribe to a single document
  /**
  * Subscribes to realtime updates for a single document and returns the subscription identifier.
  * @example
  * subscribeToDocument('users', 'userId123', callback)
  * 'subscriptionId123'
  * @param {{string}} collectionName - Collection name containing the document to observe.
  * @param {{string}} documentId - Identifier of the document to subscribe to.
  * @param {{DocumentSubscriptionCallback<T>}} callback - Callback invoked on loading, data, or error events.
  * @param {{{ includeMetadataChanges?: boolean }}} [options] - Optional flags controlling metadata updates.
  * @returns {{string}} Unique identifier for the created document subscription.
  **/
  subscribeToDocument<T extends BaseEntity>(
    collectionName: string,
    documentId: string,
    callback: DocumentSubscriptionCallback<T>,
    options?: { includeMetadataChanges?: boolean }
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    try {
      callback.onLoading?.(true);

      const docRef = doc(db, collectionName, documentId);

      const unsubscribe = onSnapshot(
        docRef,
        {
          includeMetadataChanges: options?.includeMetadataChanges || false
        },
        (snapshot: DocumentSnapshot) => {
          try {
            const data = snapshot.exists() 
              ? { id: snapshot.id, ...snapshot.data() } as T
              : null;

            // Update metrics
            this.updateSubscriptionMetrics(subscriptionId);

            callback.onLoading?.(false);
            callback.onData(data);

            logger.debug(`Document subscription ${subscriptionId} updated`, {
              collection: collectionName,
              documentId,
              exists: snapshot.exists(),
              fromCache: snapshot.metadata.fromCache
            });
          } catch (error) {
            this.handleSubscriptionError(subscriptionId, error as Error, callback.onError);
          }
        },
        (error: Error) => {
          this.handleSubscriptionError(subscriptionId, error, callback.onError);
        }
      );

      // Register subscription
      const subscription: Subscription = {
        id: subscriptionId,
        collectionName,
        type: 'document',
        active: true,
        createdAt: new Date(),
        lastUpdate: new Date(),
        errorCount: 0,
        unsubscribe
      };

      this.subscriptions.set(subscriptionId, subscription);
      this.updateCounts.set(subscriptionId, 0);

      logger.debug(`Document subscription created`, {
        subscriptionId,
        collection: collectionName,
        documentId
      });

      return subscriptionId;
    } catch (error) {
      callback.onError?.(error as Error);
      throw error;
    }
  }

  // Handle subscription errors
  /**
  * Handles subscription errors by tracking them, recording recent occurrences, and invoking an optional callback.
  * @example
  * handleSubscriptionError('sub123', new Error('network failure'))
  * undefined
  * @param {{string}} {{subscriptionId}} - Identifier of the subscription that encountered the error.
  * @param {{Error}} {{error}} - Error object describing the failure.
  * @param {{(error: Error) => void}} {{onError}} - Optional callback invoked after processing the error.
  * @returns {{void}} Nothing.
  **/
  private handleSubscriptionError(
    subscriptionId: string,
    error: Error,
    onError?: (error: Error) => void
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (subscription) {
      subscription.errorCount += 1;
      
      // Track error
      errorTrackingService.trackError(error, {
        operation: 'realtime_subscription',
        service: 'realtime',
        timestamp: new Date(),
        additionalData: {
          subscriptionId,
          collection: subscription.collectionName,
          type: subscription.type
        }
      });

      // Add to recent errors
      this.recentErrors.push({
        subscriptionId,
        error: error.message,
        timestamp: new Date()
      });

      // Keep only last 100 errors
      if (this.recentErrors.length > 100) {
        this.recentErrors = this.recentErrors.slice(-100);
      }

      logger.error(`Subscription ${subscriptionId} error:`, error);
    }

    onError?.(error);
  }

  // Update subscription metrics
  private updateSubscriptionMetrics(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    const currentCount = this.updateCounts.get(subscriptionId) || 0;

    if (subscription) {
      subscription.lastUpdate = new Date();
      this.updateCounts.set(subscriptionId, currentCount + 1);
    }
  }

  // Unsubscribe from a subscription
  /**
  * Unsubscribes the given subscription and updates related state.
  * @example
  * unsubscribe('sub-123')
  * true
  * @param {{string}} {{subscriptionId}} - Identifier of the subscription to cancel.
  * @returns {{boolean}} True if the subscription was found and unsubscribed, otherwise false.
  **/
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (subscription) {
      subscription.unsubscribe();
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);
      this.updateCounts.delete(subscriptionId);

      logger.debug(`Subscription ${subscriptionId} unsubscribed`);
      return true;
    }

    return false;
  }

  // Unsubscribe from all subscriptions
  unsubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }

    this.subscriptions.clear();
    this.updateCounts.clear();

    logger.debug('All subscriptions unsubscribed');
  }

  // Get subscription by ID
  getSubscription(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  // Get all active subscriptions
  getActiveSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.active);
  }

  // Get subscriptions by collection
  getSubscriptionsByCollection(collectionName: string): Subscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.collectionName === collectionName);
  }

  // Get realtime metrics
  /**
  * Computes current real-time metrics for all subscriptions managed by the service.
  * @example
  * etMetrics()
  * { totalSubscriptions: 5, activeSubscriptions: 3, subscriptionsByCollection: { orders: 2, users: 3 }, averageUpdateFrequency: 1.2, errorRate: 0, totalUpdates: 120, recentErrors: [] }
  * @returns {{RealtimeMetrics}} Aggregated realtime metrics for subscriptions.
  **/
  getMetrics(): RealtimeMetrics {
    const subscriptions = Array.from(this.subscriptions.values());
    const activeSubscriptions = subscriptions.filter(sub => sub.active);
    
    const subscriptionsByCollection: Record<string, number> = {};
    let totalUpdates = 0;

    subscriptions.forEach(sub => {
      subscriptionsByCollection[sub.collectionName] = 
        (subscriptionsByCollection[sub.collectionName] || 0) + 1;
      
      totalUpdates += this.updateCounts.get(sub.id) || 0;
    });

    // Calculate average update frequency (updates per minute)
    const now = Date.now();
    const totalMinutes = subscriptions.reduce((sum, sub) => {
      const minutes = (now - sub.createdAt.getTime()) / (1000 * 60);
      return sum + Math.max(minutes, 1); // At least 1 minute
    }, 0);

    const averageUpdateFrequency = totalMinutes > 0 ? totalUpdates / totalMinutes : 0;

    // Calculate error rate
    const totalErrors = subscriptions.reduce((sum, sub) => sum + sub.errorCount, 0);
    const errorRate = totalUpdates > 0 ? (totalErrors / totalUpdates) * 100 : 0;

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      subscriptionsByCollection,
      averageUpdateFrequency,
      errorRate,
      totalUpdates,
      recentErrors: this.recentErrors.slice(-20) // Last 20 errors
    };
  }

  // Health check for realtime service
  /**
   * Performs a health check using recent metrics to categorize service status.
   * @example
   * healthCheck()
   * { status: 'healthy', details: { activeSubscriptions: 10, errorRate: 2, recentErrors: 0 } }
   * @returns {{Promise<{status: 'healthy' | 'degraded' | 'unhealthy'; details: { activeSubscriptions: number; errorRate: number; recentErrors: number; }; }>; Current health status and metrics.}}
   **/
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      activeSubscriptions: number;
      errorRate: number;
      recentErrors: number;
    };
  }> {
    const metrics = this.getMetrics();
    const recentErrorCount = this.recentErrors.filter(
      error => Date.now() - error.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    ).length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.errorRate > 10 || recentErrorCount > 10) {
      status = 'unhealthy';
    } else if (metrics.errorRate > 5 || recentErrorCount > 5) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        activeSubscriptions: metrics.activeSubscriptions,
        errorRate: metrics.errorRate,
        recentErrors: recentErrorCount
      }
    };
  }

  // Cleanup old error records
  cleanupErrors(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.recentErrors = this.recentErrors.filter(
      error => error.timestamp.getTime() > fiveMinutesAgo
    );
  }
}

// Global realtime service instance
export const realtimeService = new RealtimeService();