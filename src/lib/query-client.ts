import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // 5 minutes — data stays fresh
      gcTime: 30 * 60_000, // 30 minutes — keep unused data in cache
      retry: 1, // One retry for transient failures
      refetchOnWindowFocus: false, // Desktop app — no need
      refetchOnReconnect: true, // Recover on network reconnect
    },
    mutations: {
      retry: 0, // Never retry mutations
    },
  },
});
