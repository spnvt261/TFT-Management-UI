import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: (failureCount, error: any) => {
        const status = error?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }

        return failureCount < 2;
      },
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});
