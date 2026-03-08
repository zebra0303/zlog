import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";

export function recordVisit() {
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (isAuthenticated) return; // Is Admin or logged in user

  // Call API
  void api.post("/analytics/visit").catch(() => {
    // silently fail
  });
}
