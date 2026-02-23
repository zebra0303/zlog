import { HelmetProvider } from "react-helmet-async";
import { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/shared/api/client";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>{children}</HelmetProvider>
    </QueryClientProvider>
  );
}
