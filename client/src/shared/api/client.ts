const API_BASE = "/api";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) { localStorage.setItem("zlog_token", token); }
    else { localStorage.removeItem("zlog_token"); }
  }

  getToken(): string | null {
    if (!this.token) { this.token = localStorage.getItem("zlog_token"); }
    return this.token;
  }

  private getHeaders(contentType?: string): HeadersInit {
    const headers: HeadersInit = {};
    if (contentType) headers["Content-Type"] = contentType;
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.getHeaders() });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "요청에 실패했습니다." }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST", headers: this.getHeaders("application/json"),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "요청에 실패했습니다." }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT", headers: this.getHeaders("application/json"),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "요청에 실패했습니다." }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: this.getHeaders(body ? "application/json" : undefined),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "요청에 실패했습니다." }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const headers: HeadersInit = {};
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "업로드에 실패했습니다." }));
      throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }
}

export const api = new ApiClient();
