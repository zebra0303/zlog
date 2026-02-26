import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, sql, asc, inArray, like, and } from "drizzle-orm";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";
import { createSlug, createUniqueSlug } from "../lib/slug.js";
import type { AppVariables } from "../types/env.js";

const categoriesRoute = new Hono<{ Variables: AppVariables }>();

categoriesRoute.get("/", optionalAuthMiddleware, (c) => {
  const ownerId = c.get("ownerId");
  const isAdmin = !!ownerId;

  const cats = db
    .select()
    .from(schema.categories)
    .where(isAdmin ? undefined : eq(schema.categories.isPublic, true))
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name))
    .all();

  const catIds = cats.map((c) => c.id);

  // Batch: post counts per category (single query)
  const postCountMap = new Map<string, number>();
  if (catIds.length > 0) {
    const rows = db
      .select({
        categoryId: schema.posts.categoryId,
        count: sql<number>`count(*)`,
      })
      .from(schema.posts)
      .where(and(inArray(schema.posts.categoryId, catIds), eq(schema.posts.status, "published")))
      .groupBy(schema.posts.categoryId)
      .all();
    for (const r of rows) {
      if (r.categoryId) postCountMap.set(r.categoryId, r.count);
    }
  }

  // Batch: follower counts per category (single query)
  const followerCountMap = new Map<string, number>();
  if (catIds.length > 0) {
    const rows = db
      .select({
        categoryId: schema.subscribers.categoryId,
        count: sql<number>`count(*)`,
      })
      .from(schema.subscribers)
      .where(inArray(schema.subscribers.categoryId, catIds))
      .groupBy(schema.subscribers.categoryId)
      .all();
    for (const r of rows) {
      followerCountMap.set(r.categoryId, r.count);
    }
  }

  const result = cats.map((cat) => ({
    ...cat,
    postCount: postCountMap.get(cat.id) ?? 0,
    followerCount: followerCountMap.get(cat.id) ?? 0,
  }));

  return c.json(result);
});

categoriesRoute.get("/:slug", optionalAuthMiddleware, (c) => {
  const slug = c.req.param("slug");
  const ownerId = c.get("ownerId");
  const isAdmin = !!ownerId;

  const cat = db
    .select()
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.slug, slug),
        isAdmin ? undefined : eq(schema.categories.isPublic, true),
      ),
    )
    .get();

  if (!cat) {
    return c.json({ error: "Category not found." }, 404);
  }

  const postCountResult = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(and(eq(schema.posts.categoryId, cat.id), eq(schema.posts.status, "published")))
    .get();

  const followerCountResult = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.subscribers)
    .where(eq(schema.subscribers.categoryId, cat.id))
    .get();

  return c.json({
    ...cat,
    postCount: postCountResult?.count ?? 0,
    followerCount: followerCountResult?.count ?? 0,
  });
});

categoriesRoute.post("/", authMiddleware, async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    longDescription?: string;
    coverImage?: string;
    isPublic?: boolean;
  }>();

  if (!body.name) {
    return c.json({ error: "Category name is required." }, 400);
  }

  const baseSlug = createSlug(body.name);
  const conflicting = db
    .select({ slug: schema.categories.slug })
    .from(schema.categories)
    .where(like(schema.categories.slug, `${baseSlug}%`))
    .all()
    .map((c) => c.slug);
  const slug = createUniqueSlug(body.name, conflicting);
  const now = new Date().toISOString();
  const id = generateId();

  db.insert(schema.categories)
    .values({
      id,
      name: body.name,
      slug,
      description: body.description ?? null,
      longDescription: body.longDescription ?? null,
      coverImage: body.coverImage ?? null,
      isPublic: body.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const newCat = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
  return c.json(newCat, 201);
});

categoriesRoute.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    description?: string;
    longDescription?: string;
    coverImage?: string;
    isPublic?: boolean;
    sortOrder?: number;
  }>();

  const existing = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
  if (!existing) {
    return c.json({ error: "Category not found." }, 404);
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (body.name !== undefined) {
    updateData.name = body.name;
    if (body.name !== existing.name) {
      const newBase = createSlug(body.name);
      const conflicting = db
        .select({ slug: schema.categories.slug })
        .from(schema.categories)
        .where(like(schema.categories.slug, `${newBase}%`))
        .all()
        .map((c) => c.slug)
        .filter((s) => s !== existing.slug);
      updateData.slug = createUniqueSlug(body.name, conflicting);
    }
  }
  if (body.description !== undefined) updateData.description = body.description;
  if (body.longDescription !== undefined) updateData.longDescription = body.longDescription;
  if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
  if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  db.update(schema.categories).set(updateData).where(eq(schema.categories.id, id)).run();
  const result = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
  return c.json(result);
});

categoriesRoute.delete("/:id", authMiddleware, (c) => {
  const id = c.req.param("id");
  const existing = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
  if (!existing) {
    return c.json({ error: "Category not found." }, 404);
  }

  db.update(schema.posts).set({ categoryId: null }).where(eq(schema.posts.categoryId, id)).run();

  db.delete(schema.categories).where(eq(schema.categories.id, id)).run();
  return c.json({ message: "Category has been deleted." });
});

export default categoriesRoute;
