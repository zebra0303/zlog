import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, desc, and, sql, like } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";
import { createSlug, createUniqueSlug } from "../lib/slug.js";
import { sendWebhookToSubscribers } from "../services/feedService.js";

const postsRoute = new Hono();

postsRoute.get("/", async (c) => {
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const categorySlug = c.req.query("category");
  const search = c.req.query("search");
  const status = c.req.query("status") ?? "published";

  const perPageSetting = db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "posts_per_page"))
    .get();
  const perPage = Number(perPageSetting?.value) || 10;

  let categoryId: string | null = null;
  if (categorySlug) {
    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, categorySlug))
      .get();
    categoryId = cat?.id ?? null;
  }

  const conditions = [eq(schema.posts.status, status as "draft" | "published" | "deleted")];
  if (categoryId) {
    conditions.push(eq(schema.posts.categoryId, categoryId));
  }
  if (search) {
    conditions.push(like(schema.posts.title, `%${search}%`));
  }

  const whereClause = and(...conditions);

  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(whereClause)
    .get();
  const total = totalResult?.count ?? 0;

  const postsResult = db
    .select()
    .from(schema.posts)
    .where(whereClause)
    .orderBy(desc(schema.posts.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .all();

  const items = postsResult.map((post) => {
    const category = post.categoryId
      ? db
          .select({
            id: schema.categories.id,
            name: schema.categories.name,
            slug: schema.categories.slug,
          })
          .from(schema.categories)
          .where(eq(schema.categories.id, post.categoryId))
          .get()
      : null;

    const tagRows = db
      .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
      .from(schema.postTags)
      .innerJoin(schema.tags, eq(schema.postTags.tagId, schema.tags.id))
      .where(eq(schema.postTags.postId, post.id))
      .all();

    return { ...post, category, tags: tagRows };
  });

  return c.json({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

postsRoute.get("/:param", async (c) => {
  const param = c.req.param("param");
  // UUID v7 패턴이면 ID로 조회, 아니면 slug로 조회
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  const post = isUuid
    ? db.select().from(schema.posts).where(eq(schema.posts.id, param)).get()
    : db.select().from(schema.posts).where(eq(schema.posts.slug, param)).get();

  if (!post || post.status === "deleted") {
    return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
  }

  db.update(schema.posts)
    .set({ viewCount: post.viewCount + 1 })
    .where(eq(schema.posts.id, post.id))
    .run();

  const category = post.categoryId
    ? db
        .select({
          id: schema.categories.id,
          name: schema.categories.name,
          slug: schema.categories.slug,
        })
        .from(schema.categories)
        .where(eq(schema.categories.id, post.categoryId))
        .get()
    : null;

  const tagRows = db
    .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.postTags.tagId, schema.tags.id))
    .where(eq(schema.postTags.postId, post.id))
    .all();

  return c.json({ ...post, viewCount: post.viewCount + 1, category, tags: tagRows });
});

postsRoute.post("/", authMiddleware, async (c) => {
  const body = await c.req.json<{
    title: string;
    content: string;
    categoryId?: string;
    status?: string;
    tags?: string[];
    coverImage?: string;
    excerpt?: string;
  }>();

  if (!body.title || !body.content) {
    return c.json({ error: "제목과 내용을 입력해주세요." }, 400);
  }

  const existingSlugs = db
    .select({ slug: schema.posts.slug })
    .from(schema.posts)
    .all()
    .map((p) => p.slug);
  const slug = createUniqueSlug(body.title, existingSlugs);
  const now = new Date().toISOString();
  const id = generateId();
  const excerpt = body.excerpt ?? body.content.replace(/[#*`>\-\[\]()!]/g, "").slice(0, 200);

  db.insert(schema.posts)
    .values({
      id,
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug,
      content: body.content,
      excerpt,
      coverImage: body.coverImage ?? null,
      status: (body.status as "draft" | "published") ?? "draft",
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (body.tags && body.tags.length > 0) {
    for (const tagName of body.tags) {
      const tagSlug = createSlug(tagName);
      let tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get();
      if (!tag) {
        const tagId = generateId();
        db.insert(schema.tags).values({ id: tagId, name: tagName, slug: tagSlug }).run();
        tag = { id: tagId, name: tagName, slug: tagSlug };
      }
      db.insert(schema.postTags).values({ postId: id, tagId: tag.id }).run();
    }
  }

  if (body.status === "published" && body.categoryId) {
    const post = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
    if (post) {
      void sendWebhookToSubscribers("post.published", post, body.categoryId);
    }
  }

  const newPost = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  return c.json(newPost, 201);
});

postsRoute.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    content?: string;
    categoryId?: string;
    status?: string;
    tags?: string[];
    coverImage?: string;
    excerpt?: string;
  }>();

  const existing = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (!existing) {
    return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (body.title !== undefined) {
    updateData.title = body.title;
    if (body.title !== existing.title) {
      const existingSlugs = db
        .select({ slug: schema.posts.slug })
        .from(schema.posts)
        .all()
        .map((p) => p.slug)
        .filter((s) => s !== existing.slug);
      updateData.slug = createUniqueSlug(body.title, existingSlugs);
    }
  }
  if (body.content !== undefined) {
    updateData.content = body.content;
    if (!body.excerpt) {
      updateData.excerpt = body.content.replace(/[#*`>\-\[\]()!]/g, "").slice(0, 200);
    }
  }
  if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
  if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === "deleted") updateData.deletedAt = now;
  }

  db.update(schema.posts).set(updateData).where(eq(schema.posts.id, id)).run();

  if (body.tags !== undefined) {
    db.delete(schema.postTags).where(eq(schema.postTags.postId, id)).run();
    for (const tagName of body.tags) {
      const tagSlug = createSlug(tagName);
      let tag = db.select().from(schema.tags).where(eq(schema.tags.name, tagName)).get();
      if (!tag) {
        const tagId = generateId();
        db.insert(schema.tags).values({ id: tagId, name: tagName, slug: tagSlug }).run();
        tag = { id: tagId, name: tagName, slug: tagSlug };
      }
      db.insert(schema.postTags).values({ postId: id, tagId: tag.id }).run();
    }
  }

  if (body.status && body.status !== existing.status) {
    const updatedPost = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
    if (updatedPost) {
      const catId = body.categoryId ?? existing.categoryId;
      if (catId) {
        if (body.status === "published") {
          void sendWebhookToSubscribers("post.published", updatedPost, catId);
        } else if (body.status === "deleted") {
          void sendWebhookToSubscribers("post.deleted", updatedPost, catId);
        } else if (body.status === "draft" && existing.status === "published") {
          void sendWebhookToSubscribers("post.unpublished", updatedPost, catId);
        }
      }
    }
  }

  const result = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  return c.json(result);
});

postsRoute.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const existing = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (!existing) {
    return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
  }

  const now = new Date().toISOString();
  db.update(schema.posts)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(schema.posts.id, id))
    .run();

  if (existing.categoryId && existing.status === "published") {
    void sendWebhookToSubscribers("post.deleted", existing, existing.categoryId);
  }

  return c.json({ message: "게시글이 삭제되었습니다." });
});

export default postsRoute;
