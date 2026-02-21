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

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required." }, 401);
  }

  const token = authHeader.slice(7);
  const ownerId = await verifyToken(token);
  if (!ownerId) {
    return c.json({ error: "Invalid token." }, 401);
  }

  const ownerRecord = db.select().from(schema.owner).where(eq(schema.owner.id, ownerId)).get();
  if (!ownerRecord) {
    return c.json({ error: "User not found." }, 401);
  }

  c.set("owner", ownerRecord);
  c.set("ownerId", ownerId);
  await next();
}
