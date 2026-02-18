import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../lib/password.js";
import { createToken, authMiddleware } from "../middleware/auth.js";
import type { AppVariables } from "../types/env.js";

const auth = new Hono<{ Variables: AppVariables }>();

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "Email and password are required." }, 400);
  }

  const ownerRecord = db.select().from(schema.owner).where(eq(schema.owner.email, email)).get();

  if (!ownerRecord) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const valid = verifyPassword(password, ownerRecord.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

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
