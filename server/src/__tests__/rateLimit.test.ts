import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "../middleware/rateLimit.js";

describe("rateLimit middleware", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // Rate limiter bypasses in test env, so temporarily switch to "development"
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should allow requests under the limit", async () => {
    const app = new Hono();
    app.use("*", rateLimit("test-allow", { max: 3, windowMs: 60_000 }));
    app.get("/", (c) => c.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/");
      expect(res.status).toBe(200);
    }
  });

  it("should return 429 when limit is exceeded", async () => {
    const app = new Hono();
    app.use("*", rateLimit("test-exceed", { max: 2, windowMs: 60_000 }));
    app.get("/", (c) => c.json({ ok: true }));

    await app.request("/");
    await app.request("/");
    const res = await app.request("/");

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Too many requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("should use custom message when provided", async () => {
    const app = new Hono();
    app.use("*", rateLimit("test-msg", { max: 1, windowMs: 60_000, message: "Slow down!" }));
    app.get("/", (c) => c.json({ ok: true }));

    await app.request("/");
    const res = await app.request("/");

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Slow down!");
  });

  it("should track different store keys independently", async () => {
    const app = new Hono();
    app.use("/a/*", rateLimit("store-a", { max: 1, windowMs: 60_000 }));
    app.use("/b/*", rateLimit("store-b", { max: 1, windowMs: 60_000 }));
    app.get("/a/test", (c) => c.json({ route: "a" }));
    app.get("/b/test", (c) => c.json({ route: "b" }));

    const resA = await app.request("/a/test");
    expect(resA.status).toBe(200);

    // Different store key, should still allow
    const resB = await app.request("/b/test");
    expect(resB.status).toBe(200);

    // Same store key, should be blocked
    const resA2 = await app.request("/a/test");
    expect(resA2.status).toBe(429);
  });
});
