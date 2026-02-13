import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../lib/password.js";
import { createToken, authMiddleware } from "../middleware/auth.js";

const auth = new Hono();

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "이메일과 비밀번호를 입력해주세요." }, 400);
  }

  const ownerRecord = db
    .select()
    .from(schema.owner)
    .where(eq(schema.owner.email, email))
    .get();

  if (!ownerRecord) {
    return c.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, 401);
  }

  const valid = verifyPassword(password, ownerRecord.passwordHash);
  if (!valid) {
    return c.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, 401);
  }

  const token = await createToken(ownerRecord.id);
  const { passwordHash: _, ...ownerData } = ownerRecord;
  return c.json({ token, owner: ownerData });
});

auth.get("/me", authMiddleware, async (c) => {
  const ownerRecord = c.get("owner") as typeof schema.owner.$inferSelect;
  const { passwordHash: _, ...ownerData } = ownerRecord;
  return c.json(ownerData);
});

export default auth;
