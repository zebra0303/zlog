import { QueryClient } from "@tanstack/react-query";
import { ApiClient } from "@zebra/core/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Project-specific ApiClient with zlog's 401 handling
export const api = new ApiClient({
  onUnauthorized: (path) => {
    if (!path.includes("/auth/login") && !path.includes("/auth/me")) {
      window.dispatchEvent(new CustomEvent("zlog_unauthorized"));
    }
  },
});

export { ApiClient };
