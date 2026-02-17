import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
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
    // auth tests don't mutate admin, no per-test cleanup needed
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
});
