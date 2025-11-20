import { useState, useCallback } from 'react';
import { ApiResponse } from '@/lib/types';

interface UseAsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncOperationReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useAsyncOperation<T>(
  asyncFunction: (...args: any[]) => Promise<ApiResponse<T>>
): UseAsyncOperationReturn<T> {
  const [state, setState] = useState<UseAsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null
  });

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await asyncFunction(...args);
      
      if (result.success && result.data) {
        setState({
          data: result.data,
          loading: false,
          error: null
        });
        return result.data;
      } else {
        setState({
          data: null,
          loading: false,
          error: result.error || 'Operation failed'
        });
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState({
        data: null,
        loading: false,
        error: errorMessage
      });
      return null;
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null
    });
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset
  };
}