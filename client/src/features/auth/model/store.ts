import { create } from "zustand";
import { api } from "@/shared/api/client";
import type { PublicOwner, LoginResponse } from "@zlog/shared";

interface AuthState {
  owner: PublicOwner | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  owner: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (email: string, password: string) => {
    const data = await api.post<LoginResponse>("/auth/login", { email, password });
    api.setToken(data.token);
    set({ owner: data.owner, isAuthenticated: true });
  },
  logout: () => {
    api.setToken(null);
    set({ owner: null, isAuthenticated: false });
  },
  checkAuth: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const owner = await api.get<PublicOwner>("/auth/me");
      set({ owner, isAuthenticated: true, isLoading: false });
    } catch {
      api.setToken(null);
      set({ owner: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
