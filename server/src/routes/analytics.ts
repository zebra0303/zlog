import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, desc, and, gte, lt } from "drizzle-orm";
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

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const xForwardedFor = c.req.header("x-forwarded-for");
  const ip = xForwardedFor?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;
  const userAgent = c.req.header("user-agent");
  const referer = c.req.header("referer");
  const { os, browser } = parseUserAgent(userAgent ?? "");
  const country = ip ? (geoip.lookup(ip)?.country ?? null) : null;

  // 3. Upsert Daily Count & Insert Log
  db.transaction((tx) => {
    // Upsert Count
    const existing = tx
      .select()
      .from(schema.dailyVisitorCounts)
      .where(eq(schema.dailyVisitorCounts.date, todayStr))
      .get();
    if (existing) {
      tx.update(schema.dailyVisitorCounts)
        .set({ count: existing.count + 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.dailyVisitorCounts.date, todayStr))
        .run();
    } else {
      tx.insert(schema.dailyVisitorCounts)
        .values({
          date: todayStr,
          count: 1,
          updatedAt: new Date().toISOString(),
        })
        .run();
    }

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
        visitedAt: new Date().toISOString(),
      })
      .run();

    // 4. Cleanup: Keep only last 20 logs for today
    const startOfDayStr = `${todayStr}T00:00:00.000Z`;
    const endOfDayStr = `${todayStr}T23:59:59.999Z`;

    const logs = tx
      .select({ id: schema.visitorLogs.id })
      .from(schema.visitorLogs)
      .where(
        and(
          gte(schema.visitorLogs.visitedAt, startOfDayStr),
          lt(schema.visitorLogs.visitedAt, endOfDayStr),
        ),
      )
      .orderBy(desc(schema.visitorLogs.visitedAt))
      .all();

    if (logs.length > 20) {
      const toDelete = logs.slice(20);
      for (const log of toDelete) {
        tx.delete(schema.visitorLogs).where(eq(schema.visitorLogs.id, log.id)).run();
      }
    }
  });

  // 5. Set Cookie (Expires at end of day)
  const expires = new Date();
  expires.setUTCHours(23, 59, 59, 999); // Expires at UTC midnight? No, should match todayStr.
  // Actually, if we use UTC date, the cookie should expire at next UTC midnight.
  // If we setHours on a local date object, it sets local time.
  // We want the cookie to expire when the "day" ends.
  // If "Day" = UTC Day, then expire at next UTC midnight.
  const now = new Date();
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );

  setCookie(c, "zlog_visited_today", "true", {
    expires: nextUtcMidnight,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "Lax",
  });

  return c.json({ counted: true });
});

// Get visitors (Admin only)
analytics.get("/visitors", authMiddleware, (c) => {
  const todayStr = new Date().toISOString().slice(0, 10); // UTC Date
  const startOfDayStr = `${todayStr}T00:00:00.000Z`;

  const countRecord = db
    .select()
    .from(schema.dailyVisitorCounts)
    .where(eq(schema.dailyVisitorCounts.date, todayStr))
    .get();

  // Get recent logs (max 20)
  const logs = db
    .select()
    .from(schema.visitorLogs)
    .where(gte(schema.visitorLogs.visitedAt, startOfDayStr))
    .orderBy(desc(schema.visitorLogs.visitedAt))
    .limit(20)
    .all();

  return c.json({
    count: countRecord?.count ?? 0,
    recent: logs,
  });
});

export default analytics;
