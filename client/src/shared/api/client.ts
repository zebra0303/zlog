import { QueryClient } from "@tanstack/react-query";

const API_BASE = "/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export class ApiClient {
  private token: string | null = null;

  async getErrorMessage(res: Response, fallback: string): Promise<string> {
    const text = await res.text().catch(() => "");
    if (!text) return fallback;

    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
        const errorValue = (parsed as { error?: unknown }).error;
        if (typeof errorValue === "string" && errorValue.trim()) {
          return errorValue;
        }
      }
    } catch {
      return fallback;
    }

    return fallback;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("zlog_token", token);
    } else {
      localStorage.removeItem("zlog_token");
    }
  }

  getToken(): string | null {
    this.token ??= localStorage.getItem("zlog_token");
    return this.token;
  }

  private getHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async get<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
    const headers = { ...(this.getHeaders() as Record<string, string>), ...extraHeaders };
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) {
      if (res.status === 401 && !path.includes("/auth/login")) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent("zlog_unauthorized"));
      }
      throw new Error(await this.getErrorMessage(res, `HTTP ${res.status}`));
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = this.getHeaders("application/json");
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status === 401 && !path.includes("/auth/login")) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent("zlog_unauthorized"));
      }
      throw new Error(await this.getErrorMessage(res, `HTTP ${res.status}`));
    }
    return res.json() as Promise<T>;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const headers = this.getHeaders("application/json");
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent("zlog_unauthorized"));
      }
      throw new Error(await this.getErrorMessage(res, `HTTP ${res.status}`));
    }
    return res.json() as Promise<T>;
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    const headers = this.getHeaders(body ? "application/json" : undefined);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent("zlog_unauthorized"));
      }
      throw new Error(await this.getErrorMessage(res, `HTTP ${res.status}`));
    }
    return res.json() as Promise<T>;
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      if (res.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent("zlog_unauthorized"));
      }
      throw new Error(await this.getErrorMessage(res, `HTTP ${res.status}`));
    }
    return res.json() as Promise<T>;
  }
}

export const api = new ApiClient();
