import { Hono } from "hono";
import { db, analyticsDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, gte, lt } from "drizzle-orm";
import { verifyPassword } from "../lib/password.js";
import { createToken, authMiddleware } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";
import type { AppVariables } from "../types/env.js";

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    return first ? first.trim() : "unknown";
  }
  return c.req.header("x-real-ip") ?? "unknown";
}

function getLockoutSeconds(failCount: number): number {
  if (failCount >= 20) return 900; // 15 minutes
  if (failCount >= 10) return 300; // 5 minutes
  if (failCount >= 5) return 30; // 30 seconds
  return 0;
}

const auth = new Hono<{ Variables: AppVariables }>();

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "Email and password are required." }, 400);
  }

  const ip = getClientIp(c);
  const now = new Date();

  // Clean up records older than 24 hours
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  analyticsDb
    .delete(schema.failedLogins)
    .where(lt(schema.failedLogins.attemptedAt, oneDayAgo))
    .run();

  // Count failures in the last 15 minutes for this IP
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const recentFailures = analyticsDb
    .select()
    .from(schema.failedLogins)
    .where(
      and(
        eq(schema.failedLogins.ipAddress, ip),
        gte(schema.failedLogins.attemptedAt, fifteenMinAgo),
      ),
    )
    .all();

  const failCount = recentFailures.length;
  const lockoutSeconds = getLockoutSeconds(failCount);

  if (lockoutSeconds > 0 && failCount > 0) {
    // Find the most recent failure
    const lastFailure = recentFailures.reduce((latest, record) =>
      record.attemptedAt > latest.attemptedAt ? record : latest,
    );
    const lockoutEnd = new Date(
      new Date(lastFailure.attemptedAt).getTime() + lockoutSeconds * 1000,
    );

    if (now < lockoutEnd) {
      const retryAfter = Math.ceil((lockoutEnd.getTime() - now.getTime()) / 1000);
      const minutes = Math.floor(retryAfter / 60);
      const seconds = retryAfter % 60;
      const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      return c.json(
        {
          error: `Too many login attempts. Try again in ${timeStr}.`,
          retryAfter,
        },
        429,
      );
    }
  }

  const ownerRecord = db.select().from(schema.owner).where(eq(schema.owner.email, email)).get();

  if (!ownerRecord) {
    analyticsDb
      .insert(schema.failedLogins)
      .values({
        id: generateId(),
        ipAddress: ip,
        attemptedEmail: email,
        attemptedAt: now.toISOString(),
      })
      .run();
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const valid = verifyPassword(password, ownerRecord.passwordHash);
  if (!valid) {
    analyticsDb
      .insert(schema.failedLogins)
      .values({
        id: generateId(),
        ipAddress: ip,
        attemptedEmail: email,
        attemptedAt: now.toISOString(),
      })
      .run();
    return c.json({ error: "Invalid email or password." }, 401);
  }

  // Successful login: clear all failure records for this IP
  analyticsDb.delete(schema.failedLogins).where(eq(schema.failedLogins.ipAddress, ip)).run();

  const token = await createToken(ownerRecord.id);
  const { passwordHash: _, ...ownerData } = ownerRecord;
  return c.json({ token, owner: ownerData });
});

auth.get("/me", authMiddleware, (c) => {
  const ownerRecord = c.get("owner");
  const { passwordHash: _, ...ownerData } = ownerRecord;
  return c.json(ownerData);
});

export default auth;
