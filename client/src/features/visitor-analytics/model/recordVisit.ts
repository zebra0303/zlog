import { api } from "@/shared/api/client";

export function recordVisit() {
  const token = localStorage.getItem("zlog_token");
  if (token) return; // Is Admin or logged in user

  // Call API
  void api.post("/analytics/visit").catch(() => {
    // silently fail
  });
}
