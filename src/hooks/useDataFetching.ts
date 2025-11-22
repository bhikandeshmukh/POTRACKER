import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiResponse, PaginatedResponse } from '@/lib/types';

interface UseDataFetchingOptions {
  immediate?: boolean;
  dependencies?: any[];
}

interface UseDataFetchingReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

/****
 * Manages API calls, loading state, and error handling for data fetching hooks.
 * @example
 * useDataFetching(() => fetchDataFromApi(), { immediate: false })
 * { data: null, loading: true, error: null, refetch: [Function], reset: [Function] }
 * @param {{() => Promise<ApiResponse<T>>}} {{fetchFunction}} - Function that performs the API call and returns a promise.
 * @param {{UseDataFetchingOptions}} {{options}} - Optional settings to control immediacy and dependencies.
 * @returns {{UseDataFetchingReturn<T>}} Return object containing current data, loading state, error, refetch, and reset helpers.
 ****/
export function useDataFetching<T>(
  fetchFunction: () => Promise<ApiResponse<T>>,
  options: UseDataFetchingOptions = {}
): UseDataFetchingReturn<T> {
  const { immediate = true, dependencies = [] } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFunction();
      
      if (!mountedRef.current) return;
      
      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setData(null);
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setData(null);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFunction]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    if (immediate) {
      fetchData();
    }
    
    return () => {
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, immediate, ...dependencies]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    reset
  };
}

// Specialized hook for paginated data
export function usePaginatedDataFetching<T>(
  fetchFunction: () => Promise<ApiResponse<PaginatedResponse<T>>>,
  options: UseDataFetchingOptions = {}
): UseDataFetchingReturn<PaginatedResponse<T>> {
  return useDataFetching(fetchFunction, options);
}