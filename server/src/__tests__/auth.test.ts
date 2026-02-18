import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import {
  seedTestAdmin,
  seedDefaultSettings,
  getAuthToken,
  cleanDb,
  type TestAdmin,
} from "./helpers.js";

describe("Auth API", () => {
  const app = createApp();
  let admin: TestAdmin;
  let token: string;

  beforeAll(async () => {
    cleanDb();
    admin = seedTestAdmin();
    seedDefaultSettings();
    token = await getAuthToken(admin.id);
  });

  beforeEach(() => {
    // Clear failed_logins between tests to avoid cross-test interference
    db.delete(schema.failedLogins).run();
  });

  describe("POST /api/auth/login", () => {
    it("should return token and owner on valid credentials", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: admin.password }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { token: string; owner: Record<string, unknown> };
      expect(data.token).toBeDefined();
      expect(data.owner).toBeDefined();
      expect(data.owner).not.toHaveProperty("passwordHash");
    });

    it("should return 401 for wrong email", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "wrong@test.com", password: admin.password }),
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 for wrong password", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: "wrongpassword" }),
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 for missing fields", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return owner data with valid token", async () => {
      const res = await app.request("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.email).toBe(admin.email);
      expect(data).not.toHaveProperty("passwordHash");
    });

    it("should return 401 without Authorization header", async () => {
      const res = await app.request("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const res = await app.request("/api/auth/me", {
        headers: { Authorization: "Bearer invalid-token-here" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Brute-force protection", () => {
    const loginWithWrongPassword = (ip = "192.168.1.100") =>
      app.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({ email: admin.email, password: "wrongpassword" }),
      });

    const loginWithCorrectPassword = (ip = "192.168.1.100") =>
      app.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({ email: admin.email, password: admin.password }),
      });

    it("should return 429 after 5 failed attempts", async () => {
      // First 5 attempts should return 401
      for (let i = 0; i < 5; i++) {
        const res = await loginWithWrongPassword();
        expect(res.status).toBe(401);
      }

      // 6th attempt should be blocked
      const res = await loginWithWrongPassword();
      expect(res.status).toBe(429);
    });

    it("should block correct password during lockout", async () => {
      // Trigger lockout with 5 failures
      for (let i = 0; i < 5; i++) {
        await loginWithWrongPassword();
      }

      // Correct password should also be blocked
      const res = await loginWithCorrectPassword();
      expect(res.status).toBe(429);
    });

    it("should include retryAfter in 429 response", async () => {
      for (let i = 0; i < 5; i++) {
        await loginWithWrongPassword();
      }

      const res = await loginWithWrongPassword();
      expect(res.status).toBe(429);
      const data = (await res.json()) as { error: string; retryAfter: number };
      expect(data.retryAfter).toBeDefined();
      expect(typeof data.retryAfter).toBe("number");
      expect(data.retryAfter).toBeGreaterThan(0);
      expect(data.error).toMatch(/^Too many login attempts\. Try again in \d+/);
    });

    it("should not affect different IPs", async () => {
      // Trigger lockout for one IP
      for (let i = 0; i < 5; i++) {
        await loginWithWrongPassword("10.0.0.1");
      }

      // Different IP should still work
      const res = await loginWithCorrectPassword("10.0.0.2");
      expect(res.status).toBe(200);
    });
  });
});
