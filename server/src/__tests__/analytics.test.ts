import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createApp } from "../app.js";
import { analyticsDb } from "../db/index.js";
import * as analyticsSchema from "../db/schema/analytics.js";
import { seedTestAdmin, getAuthToken, cleanDb } from "./helpers.js";

describe("Analytics API", () => {
  const app = createApp();
  let adminId: string;
  let token: string;

  beforeAll(async () => {
    cleanDb();
    const admin = seedTestAdmin();
    adminId = admin.id;
    token = await getAuthToken(adminId);
  });

  beforeEach(() => {
    analyticsDb.delete(analyticsSchema.visitorLogs).run();
    analyticsDb.delete(analyticsSchema.dailyVisitorCounts).run();
  });

  it("should record a visit for anonymous user", async () => {
    const res = await app.request("/api/analytics/visit", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Test)",
        "X-Forwarded-For": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ counted: true });

    // Check DB
    const log = analyticsDb.select().from(analyticsSchema.visitorLogs).get();
    expect(log).toBeDefined();
    expect(log?.ip).toBe("1.2.3.4");

    const daily = analyticsDb.select().from(analyticsSchema.dailyVisitorCounts).get();
    expect(daily).toBeDefined();
    expect(daily?.count).toBe(1);
  });

  it("should not count visit if cookie exists", async () => {
    // 1. First visit
    const res1 = await app.request("/api/analytics/visit", {
      method: "POST",
    });
    expect(res1.status).toBe(200);
    const cookie = res1.headers.get("Set-Cookie");
    expect(cookie).toContain("zlog_visited_today=true");

    // 2. Second visit with cookie
    const res2 = await app.request("/api/analytics/visit", {
      method: "POST",
      headers: { Cookie: cookie ?? "" },
    });
    expect(res2.status).toBe(200);
    const data = await res2.json();
    expect(data).toEqual({ counted: false, reason: "already_visited" });

    // Count should still be 1
    const daily = analyticsDb.select().from(analyticsSchema.dailyVisitorCounts).get();
    expect(daily?.count).toBe(1);
  });

  it("should not count visit for admin", async () => {
    const res = await app.request("/api/analytics/visit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ counted: false, reason: "is_admin" });

    const daily = analyticsDb.select().from(analyticsSchema.dailyVisitorCounts).get();
    expect(daily).toBeUndefined(); // No row created
  });

  it("should return visitor stats for admin", async () => {
    // Generate some data
    await app.request("/api/analytics/visit", { method: "POST" });

    const res = await app.request("/api/analytics/visitors", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { count: number; recent: unknown[] };
    expect(data.count).toBe(1);
    expect(data.recent).toHaveLength(1);
  });

  it("should block non-admin from viewing stats", async () => {
    const res = await app.request("/api/analytics/visitors");
    expect(res.status).toBe(401);
  });
});
