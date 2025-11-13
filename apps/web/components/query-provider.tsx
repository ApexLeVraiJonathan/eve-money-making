"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * TanStack Query provider with DevTools enabled in development
 *
 * Features:
 * - Global query client configuration
 * - DevTools for debugging queries (dev only)
 * - Automatic stale time and caching
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 1 minute
            staleTime: 60 * 1000,
            // Failed queries will retry twice
            retry: 2,
            // Refetch on window focus in production only
            refetchOnWindowFocus: process.env.NODE_ENV === "production",
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* Only show DevTools in development */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
