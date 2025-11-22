import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { realtimeService } from '@/lib/services';
import { BaseEntity, QueryOptions } from '@/lib/types';

export interface UseRealtimeOptions extends QueryOptions {
  enabled?: boolean;
  includeMetadataChanges?: boolean;
}

export interface UseRealtimeResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  subscriptionId: string | null;
}

export interface UseRealtimeDocumentResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  subscriptionId: string | null;
}

// Hook for real-time collection subscriptions
/**
* Subscribes to a realtime collection and manages loading, error, and data state.
* @example
* useRealtimeCollection('users', { enabled: true })
* { data, loading, error, refetch, subscriptionId }
* @param {string} collectionName - Name of the collection to observe for realtime updates.
* @param {UseRealtimeOptions=} options - Optional configuration such as enabling and filtering.
* @returns {UseRealtimeResult<T>} Realtime hook result containing data, loading state, errors, and controls.
**/
export function useRealtimeCollection<T extends BaseEntity>(
  collectionName: string,
  options: UseRealtimeOptions = {}
): UseRealtimeResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  const optionsRef = useRef(options);
  const { enabled = true } = options;

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const refetch = useCallback(() => {
    if (subscriptionId) {
      realtimeService.unsubscribe(subscriptionId);
      setSubscriptionId(null);
      setLoading(true);
      setError(null);
    }
  }, [subscriptionId]);

  const optionsString = useMemo(() => JSON.stringify(optionsRef.current), [optionsRef.current]);

  useEffect(() => {
    if (!enabled) {
      if (subscriptionId) {
        realtimeService.unsubscribe(subscriptionId);
        setSubscriptionId(null);
      }
      return;
    }

    const subId = realtimeService.subscribeToCollection<T>(
      collectionName,
      {
        onData: (newData) => {
          setData(newData);
          setLoading(false);
          setError(null);
        },
        onError: (err) => {
          setError(err);
          setLoading(false);
        },
        onLoading: (isLoading) => {
          setLoading(isLoading);
        }
      },
      optionsRef.current
    );

    setSubscriptionId(subId);

    // Cleanup on unmount or dependency change
    return () => {
      realtimeService.unsubscribe(subId);
    };
  }, [collectionName, enabled, subscriptionId, optionsString]);

  return {
    data,
    loading,
    error,
    refetch,
    subscriptionId
  };
}

// Hook for real-time document subscriptions
/****
* Subscribe to realtime updates for a document and keep track of loading, error, and data states.
* @example
* useRealtimeDocument('users', 'user123')
* { data: { id: 'user123', name: 'Alex' }, loading: false, error: null, refetch: () => {}, subscriptionId: 'sub123' }
* @param {{string}} collectionName - The name of the collection containing the document.
* @param {{string|null}} documentId - The ID of the document to subscribe to, or null to skip the subscription.
* @param {{enabled?: boolean; includeMetadataChanges?: boolean}} options - Optional configuration for enabling the subscription and receiving metadata changes.
* @returns {{UseRealtimeDocumentResult<T>}} An object containing the realtime document data, loading state, error state, refetch callback, and subscription ID.
****/
export function useRealtimeDocument<T extends BaseEntity>(
  collectionName: string,
  documentId: string | null,
  options: { enabled?: boolean; includeMetadataChanges?: boolean } = {}
): UseRealtimeDocumentResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  const { enabled = true } = options;
  const includeMetadataChanges = options?.includeMetadataChanges ?? false;

  const refetch = useCallback(() => {
    if (subscriptionId) {
      realtimeService.unsubscribe(subscriptionId);
      setSubscriptionId(null);
      setLoading(true);
      setError(null);
    }
  }, [subscriptionId]);

  useEffect(() => {
    if (!enabled || !documentId) {
      if (subscriptionId) {
        realtimeService.unsubscribe(subscriptionId);
        setSubscriptionId(null);
      }
      setLoading(false);
      return;
    }

    const subId = realtimeService.subscribeToDocument<T>(
      collectionName,
      documentId,
      {
        onData: (newData) => {
          setData(newData);
          setLoading(false);
          setError(null);
        },
        onError: (err) => {
          setError(err);
          setLoading(false);
        },
        onLoading: (isLoading) => {
          setLoading(isLoading);
        }
      },
      options
    );

    setSubscriptionId(subId);

    // Cleanup on unmount or dependency change
    return () => {
      realtimeService.unsubscribe(subId);
    };
  }, [collectionName, documentId, enabled, subscriptionId, includeMetadataChanges]);

  return {
    data,
    loading,
    error,
    refetch,
    subscriptionId
  };
}

// Hook for managing multiple subscriptions
/**
* Manages realtime subscriptions and provides helpers to add, remove, and clean them up.
* @example
* useRealtimeSubscriptions()
* { subscriptions: ['sub1'], addSubscription: () => {}, removeSubscription: () => {}, removeAllSubscriptions: () => {} }
* @param {{void}} {{none}} - This hook does not accept any arguments.
* @returns {{object}} Hook state and helpers for managing realtime subscriptions.
**/
export function useRealtimeSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const addSubscription = useCallback((subscriptionId: string) => {
    setSubscriptions(prev => [...prev, subscriptionId]);
  }, []);

  const removeSubscription = useCallback((subscriptionId: string) => {
    realtimeService.unsubscribe(subscriptionId);
    setSubscriptions(prev => prev.filter(id => id !== subscriptionId));
  }, []);

  const removeAllSubscriptions = useCallback(() => {
    subscriptions.forEach(id => realtimeService.unsubscribe(id));
    setSubscriptions([]);
  }, [subscriptions]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptions.forEach(id => realtimeService.unsubscribe(id));
    };
  }, [subscriptions]);

  return {
    subscriptions,
    addSubscription,
    removeSubscription,
    removeAllSubscriptions
  };
}

// Hook for real-time metrics
/**
* Retrieves the latest realtime metrics and refreshes them every five seconds.
* @example
* useRealtimeMetrics()
* { cpuUsage: 0.3, memoryUsage: 512 }
* @returns {{Record<string, number>}} Current realtime metrics snapshot.
**/
export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState(realtimeService.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(realtimeService.getMetrics());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return metrics;
}