'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

/**
* Provides a React Query client context with default caching and retry settings.
* @example
* QueryProvider({children: <App />})
* <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
* @param {{ReactNode}} {{children}} - React nodes rendered inside the query client provider.
* @returns {{JSX.Element}} React element tree wrapped with QueryClientProvider.
**/
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Cache data for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus
            refetchOnWindowFocus: false,
            // Refetch on reconnect
            refetchOnReconnect: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
