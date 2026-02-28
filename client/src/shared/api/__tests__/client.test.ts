import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../client";

describe("ApiClient 401 Interceptor", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient();
    localStorage.clear();
    vi.spyOn(window, "dispatchEvent");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should clear token and dispatch zlog_unauthorized on 401 error (not /auth/login)", async () => {
    apiClient.setToken("dummy-token");

    const mockResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

    await expect(apiClient.get("/users/me")).rejects.toThrow("Unauthorized");

    expect(apiClient.getToken()).toBeNull();
    expect(localStorage.getItem("zlog_token")).toBeNull();

    const dispatchCalls = vi.mocked(window.dispatchEvent).mock.calls;
    expect(dispatchCalls.length).toBe(1);
    const event = Array.isArray(dispatchCalls[0])
      ? (dispatchCalls[0][0] as CustomEvent)
      : (null as unknown as CustomEvent);
    expect(event.type).toBe("zlog_unauthorized");
  });

  it("should NOT dispatch zlog_unauthorized on 401 error during login (/auth/login)", async () => {
    const mockResponse = new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse);

    await expect(
      apiClient.post("/auth/login", { email: "admin@example.com", password: "wrong" }),
    ).rejects.toThrow("Invalid credentials");

    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});
