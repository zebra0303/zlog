import { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

// Initialize secret once
let secretStr = process.env.JWT_SECRET;
if (!secretStr) {
  secretStr = randomBytes(32).toString("hex");
  console.warn(
    "⚠️ JWT_SECRET is not set. Using a random secret (sessions will expire on restart).",
  );
}
const SECRET_KEY = new TextEncoder().encode(secretStr);

export async function createToken(ownerId: string): Promise<string> {
  return new SignJWT({ sub: ownerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<{ sub: string; iat: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (!payload.sub || typeof payload.iat !== "number") return null;
    return { sub: payload.sub, iat: payload.iat };
  } catch {
    return null;
  }
}

// Threshold for sliding session renewal (24 hours)
const TOKEN_REFRESH_AGE_SEC = 24 * 60 * 60;

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required." }, 401);
  }

  const token = authHeader.slice(7);
  const result = await verifyToken(token);
  if (!result) {
    return c.json({ error: "Invalid token." }, 401);
  }

  const ownerRecord = db.select().from(schema.owner).where(eq(schema.owner.id, result.sub)).get();
  if (!ownerRecord) {
    return c.json({ error: "User not found." }, 401);
  }

  c.set("owner", ownerRecord);
  c.set("ownerId", result.sub);

  // Sliding session: flag renewal if token is older than 24h
  const tokenAge = Math.floor(Date.now() / 1000) - result.iat;
  if (tokenAge >= TOKEN_REFRESH_AGE_SEC) {
    c.set("shouldRefreshToken", true);
  }

  await next();
}

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await verifyToken(token);
    if (result) {
      const ownerRecord = db
        .select()
        .from(schema.owner)
        .where(eq(schema.owner.id, result.sub))
        .get();
      if (ownerRecord) {
        c.set("owner", ownerRecord);
        c.set("ownerId", result.sub);
      }
    }
  }
  await next();
}
