import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";
import { verifyPassword, hashPassword } from "../lib/password.js";
import sharp from "sharp";
import { mkdirSync, unlinkSync, readdirSync } from "fs";
import path from "path";
import type { AppVariables } from "../types/env.js";

const settingsRoute = new Hono<{ Variables: AppVariables }>();

settingsRoute.get("/profile", async (c) => {
  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  if (!ownerRecord) return c.json({ error: "프로필을 찾을 수 없습니다." }, 404);

  const { passwordHash: _, ...ownerData } = ownerRecord;
  const socialLinksData = db.select().from(schema.socialLinks).orderBy(schema.socialLinks.sortOrder).all();

  const totalPosts = db.select({ count: sql<number>`count(*)` }).from(schema.posts).where(eq(schema.posts.status, "published")).get();
  const totalCategories = db.select({ count: sql<number>`count(*)` }).from(schema.categories).get();
  const totalViews = db.select({ total: sql<number>`coalesce(sum(view_count), 0)` }).from(schema.posts).get();

  return c.json({
    ...ownerData,
    socialLinks: socialLinksData,
    stats: {
      totalPosts: totalPosts?.count ?? 0,
      totalCategories: totalCategories?.count ?? 0,
      totalViews: totalViews?.total ?? 0,
    },
  });
});

settingsRoute.put("/profile", authMiddleware, async (c) => {
  const ownerId = c.get("ownerId");
  const body = await c.req.json<{
    displayName?: string; bio?: string; aboutMe?: string; jobTitle?: string;
    company?: string; location?: string; blogTitle?: string; blogDescription?: string;
  }>();

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };
  if (body.displayName !== undefined) updateData.displayName = body.displayName;
  if (body.bio !== undefined) updateData.bio = body.bio;
  if (body.aboutMe !== undefined) updateData.aboutMe = body.aboutMe;
  if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
  if (body.company !== undefined) updateData.company = body.company;
  if (body.location !== undefined) updateData.location = body.location;
  if (body.blogTitle !== undefined) updateData.blogTitle = body.blogTitle;
  if (body.blogDescription !== undefined) updateData.blogDescription = body.blogDescription;

  db.update(schema.owner).set(updateData).where(eq(schema.owner.id, ownerId)).run();
  const updated = db.select().from(schema.owner).where(eq(schema.owner.id, ownerId)).get();
  if (!updated) return c.json({ error: "업데이트 실패" }, 500);
  const { passwordHash: _, ...ownerData } = updated;
  return c.json(ownerData);
});

settingsRoute.post("/profile/avatar", authMiddleware, async (c) => {
  const ownerId = c.get("ownerId");
  const formData = await c.req.formData();
  const file = formData.get("avatar") as File | null;
  if (!file) return c.json({ error: "이미지 파일을 선택해주세요." }, 400);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) return c.json({ error: "JPEG, PNG, WebP, GIF 형식만 지원합니다." }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: "파일 크기는 최대 5MB입니다." }, 400);

  const uploadsBase = path.join(process.cwd(), "uploads", "avatar");
  mkdirSync(path.join(uploadsBase, "original"), { recursive: true });
  mkdirSync(path.join(uploadsBase, "256"), { recursive: true });
  mkdirSync(path.join(uploadsBase, "64"), { recursive: true });

  const uuid = generateId();
  const ext = file.name.split(".").pop() ?? "jpg";
  const buffer = Buffer.from(await file.arrayBuffer());

  await sharp(buffer).toFile(path.join(uploadsBase, "original", `${uuid}.${ext}`));
  await sharp(buffer).resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toFile(path.join(uploadsBase, "256", `${uuid}.webp`));
  await sharp(buffer).resize(64, 64, { fit: "cover" }).webp({ quality: 85 }).toFile(path.join(uploadsBase, "64", `${uuid}.webp`));

  const current = db.select().from(schema.owner).where(eq(schema.owner.id, ownerId)).get();
  if (current?.avatarUrl) {
    const oldUuid = current.avatarUrl.split("/").pop()?.replace(".webp", "");
    if (oldUuid) {
      for (const dir of ["original", "256", "64"]) {
        try {
          for (const f of readdirSync(path.join(uploadsBase, dir))) {
            if (f.startsWith(oldUuid)) unlinkSync(path.join(uploadsBase, dir, f));
          }
        } catch { /* ignore */ }
      }
    }
  }

  const avatarUrl = `/uploads/avatar/256/${uuid}.webp`;
  db.update(schema.owner).set({
    avatarUrl, avatarOriginalName: file.name, avatarMimeType: file.type,
    avatarSizeBytes: file.size, updatedAt: new Date().toISOString(),
  }).where(eq(schema.owner.id, ownerId)).run();

  return c.json({ avatarUrl });
});

settingsRoute.delete("/profile/avatar", authMiddleware, async (c) => {
  const ownerId = c.get("ownerId");
  db.update(schema.owner).set({
    avatarUrl: null, avatarOriginalName: null, avatarMimeType: null,
    avatarSizeBytes: null, updatedAt: new Date().toISOString(),
  }).where(eq(schema.owner.id, ownerId)).run();
  return c.json({ message: "아바타가 삭제되었습니다." });
});

settingsRoute.get("/profile/social-links", async (c) => {
  return c.json(db.select().from(schema.socialLinks).orderBy(schema.socialLinks.sortOrder).all());
});

settingsRoute.put("/profile/social-links", authMiddleware, async (c) => {
  const body = await c.req.json<{ links: { platform: string; url: string; label?: string; sortOrder?: number }[] }>();
  db.delete(schema.socialLinks).run();
  for (let i = 0; i < body.links.length; i++) {
    const link = body.links[i]!;
    db.insert(schema.socialLinks).values({
      id: generateId(), platform: link.platform, url: link.url,
      label: link.label ?? null, sortOrder: link.sortOrder ?? i,
    }).run();
  }
  return c.json(db.select().from(schema.socialLinks).orderBy(schema.socialLinks.sortOrder).all());
});

// ============ 계정 (이메일/비밀번호) 변경 ============
settingsRoute.put("/profile/account", authMiddleware, async (c) => {
  const ownerId = c.get("ownerId");
  const body = await c.req.json<{
    email?: string;
    currentPassword: string;
    newPassword?: string;
  }>();

  if (!body.currentPassword) {
    return c.json({ error: "현재 비밀번호를 입력해주세요." }, 400);
  }

  const ownerRecord = db.select().from(schema.owner).where(eq(schema.owner.id, ownerId)).get();
  if (!ownerRecord) {
    return c.json({ error: "사용자를 찾을 수 없습니다." }, 404);
  }

  // 현재 비밀번호 확인
  if (!verifyPassword(body.currentPassword, ownerRecord.passwordHash)) {
    return c.json({ error: "현재 비밀번호가 올바르지 않습니다." }, 401);
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };

  // 이메일 변경
  if (body.email !== undefined && body.email !== ownerRecord.email) {
    if (!body.email.includes("@")) {
      return c.json({ error: "유효한 이메일 주소를 입력해주세요." }, 400);
    }
    updateData.email = body.email;
  }

  // 비밀번호 변경
  if (body.newPassword) {
    if (body.newPassword.length < 8) {
      return c.json({ error: "새 비밀번호는 최소 8자 이상이어야 합니다." }, 400);
    }
    updateData.passwordHash = hashPassword(body.newPassword);
  }

  db.update(schema.owner).set(updateData).where(eq(schema.owner.id, ownerId)).run();

  const updated = db.select().from(schema.owner).where(eq(schema.owner.id, ownerId)).get();
  if (!updated) return c.json({ error: "업데이트 실패" }, 500);
  const { passwordHash: _, ...ownerData } = updated;
  return c.json({ ...ownerData, message: "계정 정보가 변경되었습니다." });
});

// ============ 범용 이미지 업로드 ============
settingsRoute.post("/upload/image", authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return c.json({ error: "이미지 파일을 선택해주세요." }, 400);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) return c.json({ error: "JPEG, PNG, WebP, GIF 형식만 지원합니다." }, 400);
  if (file.size > 10 * 1024 * 1024) return c.json({ error: "파일 크기는 최대 10MB입니다." }, 400);

  const uploadsDir = path.join(process.cwd(), "uploads", "images");
  mkdirSync(uploadsDir, { recursive: true });

  const uuid = generateId();
  const buffer = Buffer.from(await file.arrayBuffer());

  // 원본 비율 유지, 최대 1920px, WebP 변환
  await sharp(buffer)
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(path.join(uploadsDir, `${uuid}.webp`));

  const url = `/uploads/images/${uuid}.webp`;
  return c.json({ url });
});

settingsRoute.get("/settings", async (c) => {
  const settings = db.select().from(schema.siteSettings).all();
  const result: Record<string, string> = {};
  for (const s of settings) result[s.key] = s.value;
  return c.json(result);
});

settingsRoute.put("/settings", authMiddleware, async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(body)) {
    const existing = db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, key)).get();
    if (existing) {
      db.update(schema.siteSettings).set({ value, updatedAt: now }).where(eq(schema.siteSettings.key, key)).run();
    } else {
      db.insert(schema.siteSettings).values({ id: generateId(), key, value, updatedAt: now }).run();
    }
  }
  const settings = db.select().from(schema.siteSettings).all();
  const result: Record<string, string> = {};
  for (const s of settings) result[s.key] = s.value;
  return c.json(result);
});

export default settingsRoute;
