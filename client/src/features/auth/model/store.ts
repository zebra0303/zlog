import { create } from "zustand";
import { api } from "@/shared/api/client";
import type { PublicOwner, LoginResponse, MeResponse } from "@zlog/shared";

interface AuthState {
  owner: PublicOwner | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  owner: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (email: string, password: string) => {
    const data = await api.post<LoginResponse>("/auth/login", { email, password });
    set({ owner: data.owner, isAuthenticated: true });
  },
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors on logout
    }
    set({ owner: null, isAuthenticated: false });
    // Force a full page reload to clear any sensitive data (like secret posts/categories) from memory
    window.location.href = "/";
  },
  checkAuth: async () => {
    try {
      const owner = await api.get<MeResponse>("/auth/me");
      set({ owner, isAuthenticated: true, isLoading: false });
    } catch {
      set({ owner: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// Setup global 401 interceptor listener
if (typeof window !== "undefined") {
  window.addEventListener("zlog_unauthorized", () => {
    void useAuthStore.getState().logout();
  });
}
