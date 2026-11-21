import { Navigate, useLocation } from "react-router";
import { useAuthStore } from "@/features/auth/model/store";
import { Skeleton } from "@/shared/ui";

/**
 * Route guard for admin-only pages. Waits for initial auth check to avoid flashing
 * unauthorized views or prematurely redirecting an authenticated admin.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
