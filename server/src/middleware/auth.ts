import { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET_KEY = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? "please-change-this");

export async function createToken(ownerId: string): Promise<string> {
  return new SignJWT({ sub: ownerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY());
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "인증이 필요합니다." }, 401);
  }

  const token = authHeader.slice(7);
  const ownerId = await verifyToken(token);
  if (!ownerId) {
    return c.json({ error: "유효하지 않은 토큰입니다." }, 401);
  }

  const ownerRecord = db.select().from(schema.owner).where(eq(schema.owner.id, ownerId)).get();
  if (!ownerRecord) {
    return c.json({ error: "사용자를 찾을 수 없습니다." }, 401);
  }

  c.set("owner", ownerRecord);
  c.set("ownerId", ownerId);
  await next();
}
