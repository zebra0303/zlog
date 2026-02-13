import { HelmetProvider } from "react-helmet-async";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <HelmetProvider>{children}</HelmetProvider>;
}
