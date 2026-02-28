import { Hono } from "hono";
import { analyticsDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import { desc, gte, lt } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { generateId } from "../lib/uuid.js";
import { authMiddleware, verifyToken } from "../middleware/auth.js";
import { parseUserAgent } from "../lib/userAgent.js";
import type { AppVariables } from "../types/env.js";
import geoip from "geoip-lite";

const analytics = new Hono<{ Variables: AppVariables }>();

// Record a visit
analytics.post("/visit", async (c) => {
  // 1. Check Cookie
  const visitedToday = getCookie(c, "zlog_visited_today");
  if (visitedToday) {
    return c.json({ counted: false, reason: "already_visited" });
  }

  // 2. Check Admin (via Token)
  // If the client sends an Authorization header, we verify it.
  // If it's a valid admin token, we DO NOT count the visit.
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const ownerId = await verifyToken(token);
    if (ownerId) {
      return c.json({ counted: false, reason: "is_admin" });
    }
  }

  const xForwardedFor = c.req.header("x-forwarded-for");
  const ip = xForwardedFor?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;
  const userAgent = c.req.header("user-agent");
  const referer = c.req.header("referer");
  const { os, browser } = parseUserAgent(userAgent ?? "");
  const country = ip ? (geoip.lookup(ip)?.country ?? null) : null;

  const nowISO = new Date().toISOString();
  const twentyFourHoursAgoStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 3. Insert Log and cleanup old logs
  analyticsDb.transaction((tx) => {
    // Insert Log
    tx.insert(schema.visitorLogs)
      .values({
        id: generateId(),
        ip,
        country,
        userAgent,
        os,
        browser,
        referer,
        visitedAt: nowISO,
      })
      .run();

    // 4. Cleanup: Delete logs older than 24 hours
    tx.delete(schema.visitorLogs)
      .where(lt(schema.visitorLogs.visitedAt, twentyFourHoursAgoStr))
      .run();
  });

  // 5. Set Cookie (Expires 24 hours from now)
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  setCookie(c, "zlog_visited_today", "true", {
    expires,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "Lax",
  });

  return c.json({ counted: true });
});

// Get visitors (Admin only)
analytics.get("/visitors", authMiddleware, (c) => {
  const twentyFourHoursAgoStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get total count of visitors in the last 24 hours
  const countResult = analyticsDb
    .select({ id: schema.visitorLogs.id })
    .from(schema.visitorLogs)
    .where(gte(schema.visitorLogs.visitedAt, twentyFourHoursAgoStr))
    .all();

  // Get recent logs (max 20)
  const logs = analyticsDb
    .select()
    .from(schema.visitorLogs)
    .where(gte(schema.visitorLogs.visitedAt, twentyFourHoursAgoStr))
    .orderBy(desc(schema.visitorLogs.visitedAt))
    .limit(20)
    .all();

  return c.json({
    count: countResult.length,
    recent: logs,
  });
});

export default analytics;
