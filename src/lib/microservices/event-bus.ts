import { EventBus, ServiceEvent } from './types';
import { logger } from '../logger';
import { errorTrackingService } from '../services/error-tracking.service';

type EventHandler<T = any> = (event: ServiceEvent<T>) => Promise<void>;

interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  subscribedAt: Date;
  callCount: number;
  lastCalled?: Date;
  errors: number;
}

export class InMemoryEventBus implements EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private eventHistory: ServiceEvent[] = [];
  private readonly maxHistorySize = 1000;
  private readonly maxRetries = 3;

  async publish<T>(event: ServiceEvent<T>): Promise<void> {
    logger.debug(`Publishing event: ${event.type} from ${event.service}`);
    
    // Add to event history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Get subscribers for this event type
    const subscribers = this.subscriptions.get(event.type) || [];
    const wildcardSubscribers = this.subscriptions.get('*') || [];
    const allSubscribers = [...subscribers, ...wildcardSubscribers];

    if (allSubscribers.length === 0) {
      logger.debug(`No subscribers for event: ${event.type}`);
      return;
    }

    // Notify all subscribers
    const promises = allSubscribers.map(subscription => 
      this.notifySubscriber(subscription, event)
    );

    await Promise.allSettled(promises);
    
    logger.debug(`Event published to ${allSubscribers.length} subscribers: ${event.type}`);
  }

  subscribe<T>(eventType: string, handler: EventHandler<T>): () => void {
    logger.debug(`Subscribing to event: ${eventType}`);
    
    const subscription: EventSubscription = {
      eventType,
      handler,
      subscribedAt: new Date(),
      callCount: 0,
      errors: 0
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(subscription);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(eventType, handler);
    };
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const subscribers = this.subscriptions.get(eventType);
    if (!subscribers) {
      return;
    }

    const index = subscribers.findIndex(sub => sub.handler === handler);
    if (index > -1) {
      subscribers.splice(index, 1);
      logger.debug(`Unsubscribed from event: ${eventType}`);
      
      // Clean up empty subscription arrays
      if (subscribers.length === 0) {
        this.subscriptions.delete(eventType);
      }
    }
  }

  // Subscribe to all events (wildcard subscription)
  subscribeToAll<T>(handler: EventHandler<T>): () => void {
    return this.subscribe('*', handler);
  }

  // Get event history
  getEventHistory(eventType?: string, limit?: number): ServiceEvent[] {
    let events = this.eventHistory;
    
    if (eventType) {
      events = events.filter(event => event.type === eventType);
    }
    
    if (limit) {
      events = events.slice(-limit);
    }
    
    return events.reverse(); // Most recent first
  }

  // Get subscription statistics
  getSubscriptionStats(): {
    totalSubscriptions: number;
    subscriptionsByEventType: Record<string, number>;
    subscriptions: Array<{
      eventType: string;
      subscriberCount: number;
      totalCalls: number;
      totalErrors: number;
      lastCalled?: Date;
    }>;
  } {
    const subscriptionsByEventType: Record<string, number> = {};
    const subscriptions: Array<{
      eventType: string;
      subscriberCount: number;
      totalCalls: number;
      totalErrors: number;
      lastCalled?: Date;
    }> = [];

    let totalSubscriptions = 0;

    for (const [eventType, subs] of this.subscriptions) {
      subscriptionsByEventType[eventType] = subs.length;
      totalSubscriptions += subs.length;

      const totalCalls = subs.reduce((sum, sub) => sum + sub.callCount, 0);
      const totalErrors = subs.reduce((sum, sub) => sum + sub.errors, 0);
      const lastCalled = subs.reduce((latest, sub) => {
        if (!sub.lastCalled) return latest;
        if (!latest) return sub.lastCalled;
        return sub.lastCalled > latest ? sub.lastCalled : latest;
      }, undefined as Date | undefined);

      subscriptions.push({
        eventType,
        subscriberCount: subs.length,
        totalCalls,
        totalErrors,
        lastCalled
      });
    }

    return {
      totalSubscriptions,
      subscriptionsByEventType,
      subscriptions
    };
  }

  // Get event statistics
  getEventStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: ServiceEvent[];
    eventRate: number; // events per minute
  } {
    const eventsByType: Record<string, number> = {};
    
    this.eventHistory.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    // Calculate event rate (events per minute in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = this.eventHistory.filter(event => event.timestamp > oneHourAgo);
    const eventRate = recentEvents.length / 60; // per minute

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      recentEvents: this.eventHistory.slice(-10), // Last 10 events
      eventRate
    };
  }

  // Private helper methods
  private async notifySubscriber<T>(
    subscription: EventSubscription, 
    event: ServiceEvent<T>
  ): Promise<void> {
    let attempt = 0;
    
    while (attempt < this.maxRetries) {
      try {
        await subscription.handler(event);
        
        // Update subscription stats
        subscription.callCount++;
        subscription.lastCalled = new Date();
        
        return; // Success, exit retry loop
      } catch (error) {
        attempt++;
        subscription.errors++;
        
        logger.error(
          `Event handler failed (attempt ${attempt}/${this.maxRetries}): ${event.type}`,
          error
        );

        // Track error
        errorTrackingService.trackError(error, {
          operation: 'event_handler',
          service: 'event-bus',
          timestamp: new Date(),
          additionalData: {
            eventType: event.type,
            eventService: event.service,
            attempt,
            maxRetries: this.maxRetries
          }
        });

        if (attempt >= this.maxRetries) {
          logger.error(
            `Event handler failed after ${this.maxRetries} attempts: ${event.type}`,
            error
          );
          break;
        }

        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 100);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup old events
  cleanup(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    this.eventHistory = this.eventHistory.filter(event => event.timestamp > cutoffTime);
    
    logger.debug(`Event bus cleanup completed. Events in history: ${this.eventHistory.length}`);
  }

  // Clear all subscriptions and history
  clear(): void {
    this.subscriptions.clear();
    this.eventHistory = [];
    logger.debug('Event bus cleared');
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalSubscriptions: number;
      totalEvents: number;
      errorRate: number;
      eventRate: number;
    };
  }> {
    const subscriptionStats = this.getSubscriptionStats();
    const eventStats = this.getEventStats();
    
    const totalCalls = subscriptionStats.subscriptions.reduce(
      (sum, sub) => sum + sub.totalCalls, 0
    );
    const totalErrors = subscriptionStats.subscriptions.reduce(
      (sum, sub) => sum + sub.totalErrors, 0
    );
    
    const errorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorRate > 10) {
      status = 'unhealthy';
    } else if (errorRate > 5) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        totalSubscriptions: subscriptionStats.totalSubscriptions,
        totalEvents: eventStats.totalEvents,
        errorRate,
        eventRate: eventStats.eventRate
      }
    };
  }
}

// Global event bus instance
export const eventBus = new InMemoryEventBus();