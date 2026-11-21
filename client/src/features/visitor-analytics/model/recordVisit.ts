import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";

export function recordVisit() {
  const { isAuthenticated, isLoading } = useAuthStore.getState();
  // Skip while auth is unresolved or when logged in as admin
  if (isLoading || isAuthenticated) return;

  // Call API
  void api.post("/analytics/visit").catch(() => {
    // silently fail
  });
}
