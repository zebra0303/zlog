import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db, analyticsDb, sqlite } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { eq, desc, and, or, sql, like, inArray, isNull, type SQL } from "drizzle-orm";
import { authMiddleware, verifyToken } from "../../middleware/auth.js";
import { PostListResponseSchema, CreatePostSchema } from "./schema.js";
import { generateId } from "../../lib/uuid.js";
import { createSlug, createUniqueSlug } from "../../lib/slug.js";
import { stripMarkdown } from "../../lib/markdown.js";
import { sendWebhookToSubscribers } from "../../services/feedService.js";
import { triggerStaleSync } from "../../services/syncService.js";
import { unlinkSync } from "node:fs";
import path from "node:path";
import geoip from "geoip-lite";
import { parseUserAgent } from "../../lib/userAgent.js";

function deleteUploadedImage(imageUrl: string) {
  if (!imageUrl.startsWith("/uploads/images/")) return;
  try {
    const filePath = path.join(process.cwd(), imageUrl);
    unlinkSync(filePath);
  } catch {
    /* ignore – file may already be deleted */
  }
}

// Re-using helper functions (would ideally be shared utils)
function batchLoadCategories(categoryIds: string[]) {
  const map = new Map<string, { id: string; name: string; slug: string }>();
  if (categoryIds.length === 0) return map;
  const rows = db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
    })
    .from(schema.categories)
    .where(inArray(schema.categories.id, categoryIds))
    .all();
  for (const r of rows) map.set(r.id, r);
  return map;
}

function batchLoadCommentCounts(postIds: string[]) {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;
  const rows = db
    .select({ postId: schema.comments.postId, count: sql<number>`count(*)` })
    .from(schema.comments)
    .where(and(inArray(schema.comments.postId, postIds), isNull(schema.comments.deletedAt)))
    .groupBy(schema.comments.postId)
    .all();
  for (const r of rows) map.set(r.postId, r.count);
  return map;
}

function batchLoadLikeCounts(postIds: string[]) {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;
  const rows = db
    .select({ postId: schema.postLikes.postId, count: sql<number>`count(*)` })
    .from(schema.postLikes)
    .where(inArray(schema.postLikes.postId, postIds))
    .groupBy(schema.postLikes.postId)
    .all();
  for (const r of rows) map.set(r.postId, r.count);
  return map;
}

function batchLoadTags(postIds: string[]) {
  const map = new Map<string, { id: string; name: string; slug: string }[]>();
  if (postIds.length === 0) return map;
  const rows = db
    .select({
      postId: schema.postTags.postId,
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
    })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.postTags.tagId, schema.tags.id))
    .where(inArray(schema.postTags.postId, postIds))
    .all();
  for (const r of rows) {
    const arr = map.get(r.postId) ?? [];
    arr.push({ id: r.id, name: r.name, slug: r.slug });
    map.set(r.postId, arr);
  }
  return map;
}

const postsRoute = new OpenAPIHono();

// GET /api/posts
postsRoute.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Posts"],
    description: "Get list of posts",
    request: {
      query: z.object({
        page: z.string().optional().default("1"),
        category: z.string().optional(),
        tag: z.string().optional(),
        search: z.string().optional(),
        status: z.enum(["draft", "published", "deleted", "all"]).optional().default("published"),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PostListResponseSchema,
          },
        },
        description: "List of posts",
      },
    },
  }),
  (c) => {
    const {
      page: pageStr,
      category: categorySlug,
      tag: tagSlug,
      search,
      status,
    } = c.req.valid("query");
    const page = Math.max(1, Number(pageStr) || 1);

    const perPageSetting = db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, "posts_per_page"))
      .get();
    const perPage = Number(perPageSetting?.value) || 10;
    const offset = (page - 1) * perPage;

    // Convert category slug to ID
    let categoryId: string | null = null;
    if (categorySlug) {
      const cat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.slug, categorySlug))
        .get();
      categoryId = cat?.id ?? null;
    }

    // Convert tag slug to postId list
    let tagPostIds: string[] | null = null;
    if (tagSlug) {
      const tag = db.select().from(schema.tags).where(eq(schema.tags.slug, tagSlug)).get();
      if (tag) {
        tagPostIds = db
          .select({ postId: schema.postTags.postId })
          .from(schema.postTags)
          .where(eq(schema.postTags.tagId, tag.id))
          .all()
          .map((r) => r.postId);
        if (tagPostIds.length === 0) tagPostIds = null;
      }
      if (!tagPostIds) {
        return c.json({ items: [], total: 0, page, perPage, totalPages: 0 });
      }
    }

    const includeRemote = status === "published" && !tagSlug;

    // Path A: Local only
    if (!includeRemote) {
      const conditions: SQL[] = [];
      if (status === "all") {
        const cond = or(eq(schema.posts.status, "published"), eq(schema.posts.status, "draft"));
        if (cond) conditions.push(cond);
      } else {
        conditions.push(eq(schema.posts.status, status));
      }
      if (categoryId) conditions.push(eq(schema.posts.categoryId, categoryId));
      if (search) {
        const ftsPostIds = sqlite
          .prepare(
            `SELECT p.id FROM posts p INNER JOIN posts_fts f ON p.rowid = f.rowid WHERE posts_fts MATCH ? ORDER BY rank`,
          )
          .all(`"${search.replace(/"/g, '""')}"`)
          .map((r) => (r as { id: string }).id);
        if (ftsPostIds.length > 0) {
          conditions.push(inArray(schema.posts.id, ftsPostIds));
        } else {
          conditions.push(like(schema.posts.title, `%${search}%`));
        }
      }
      if (tagPostIds) conditions.push(inArray(schema.posts.id, tagPostIds));
      const whereClause = and(...conditions);

      const total =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.posts)
          .where(whereClause)
          .get()?.count ?? 0;

      const postsResult = db
        .select()
        .from(schema.posts)
        .where(whereClause)
        .orderBy(desc(schema.posts.createdAt))
        .limit(perPage)
        .offset(offset)
        .all();

      const postIds = postsResult.map((p) => p.id);
      const catIds = [...new Set(postsResult.map((p) => p.categoryId).filter(Boolean))] as string[];
      const categoriesMap = batchLoadCategories(catIds);
      const tagsMap = batchLoadTags(postIds);
      const commentCountsMap = batchLoadCommentCounts(postIds);

      const items = postsResult.map((post) => ({
        ...post,
        category: post.categoryId ? (categoriesMap.get(post.categoryId) ?? null) : null,
        tags: tagsMap.get(post.id) ?? [],
        commentCount: commentCountsMap.get(post.id) ?? 0,
        isRemote: false,
        remoteUri: null,
        remoteBlog: null,
      }));

      return c.json({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) });
    }

    // Path B: Combined feed
    const localWhereParts: string[] = ["status = 'published'"];
    const remoteWhereParts: string[] = [
      "remote_status = 'published'",
      "local_category_id IS NOT NULL",
    ];
    const params: unknown[] = [];

    if (categoryId) {
      localWhereParts.push("category_id = ?");
      params.push(categoryId);
      remoteWhereParts.push("local_category_id = ?");
      params.push(categoryId);
    }
    if (search) {
      localWhereParts.push("title LIKE ?");
      params.push(`%${search}%`);
      remoteWhereParts.push("title LIKE ?");
      params.push(`%${search}%`);
    }

    const localWhere = localWhereParts.join(" AND ");
    const remoteWhere = remoteWhereParts.join(" AND ");

    const countSql = `
      SELECT
        (SELECT COUNT(*) FROM posts WHERE ${localWhere}) +
        (SELECT COUNT(*) FROM remote_posts WHERE ${remoteWhere})
      AS total
    `;
    const countParams = [...params];
    const totalRow = sqlite.prepare(countSql).get(...countParams) as { total: number } | undefined;
    const total = totalRow?.total ?? 0;

    if (total === 0) {
      return c.json({ items: [], total: 0, page, perPage, totalPages: 0 });
    }

    const unionSql = `
      SELECT id, 'local' AS source, created_at, category_id
      FROM posts WHERE ${localWhere}
      UNION ALL
      SELECT id, 'remote' AS source, remote_created_at AS created_at, local_category_id AS category_id
      FROM remote_posts WHERE ${remoteWhere}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const unionParams = [...params, perPage, offset];
    const pageRows = sqlite.prepare(unionSql).all(...unionParams) as {
      id: string;
      source: string;
      created_at: string;
      category_id: string | null;
    }[];

    const localIds = pageRows.filter((r) => r.source === "local").map((r) => r.id);
    const remoteIds = pageRows.filter((r) => r.source === "remote").map((r) => r.id);

    const localPostsMap = new Map<string, typeof schema.posts.$inferSelect>();
    if (localIds.length > 0) {
      const rows = db.select().from(schema.posts).where(inArray(schema.posts.id, localIds)).all();
      for (const r of rows) localPostsMap.set(r.id, r);
    }

    const remotePostsMap = new Map<string, typeof schema.remotePosts.$inferSelect>();
    if (remoteIds.length > 0) {
      const rows = db
        .select()
        .from(schema.remotePosts)
        .where(inArray(schema.remotePosts.id, remoteIds))
        .all();
      for (const r of rows) remotePostsMap.set(r.id, r);
    }

    const allCatIds = [...new Set(pageRows.map((r) => r.category_id).filter(Boolean))] as string[];
    const categoriesMap = batchLoadCategories(allCatIds);
    const tagsMap = batchLoadTags(localIds);
    const commentCountsMap = batchLoadCommentCounts(localIds);
    const likeCountsMap = batchLoadLikeCounts(localIds);

    const remoteBlogsMap = new Map<
      string,
      {
        siteUrl: string;
        displayName: string | null;
        blogTitle: string | null;
        avatarUrl: string | null;
      }
    >();
    if (remoteIds.length > 0) {
      const blogIds = [...new Set([...remotePostsMap.values()].map((rp) => rp.remoteBlogId))];
      if (blogIds.length > 0) {
        const blogs = db
          .select()
          .from(schema.remoteBlogs)
          .where(inArray(schema.remoteBlogs.id, blogIds))
          .all();
        for (const b of blogs) {
          remoteBlogsMap.set(b.id, {
            siteUrl: b.siteUrl,
            displayName: b.displayName,
            blogTitle: b.blogTitle,
            avatarUrl: b.avatarUrl,
          });
        }
      }
    }

    const items = pageRows
      .map((row) => {
        if (row.source === "local") {
          const post = localPostsMap.get(row.id);
          if (!post) return null;
          return {
            ...post,
            category: post.categoryId ? (categoriesMap.get(post.categoryId) ?? null) : null,
            tags: tagsMap.get(post.id) ?? [],
            commentCount: commentCountsMap.get(post.id) ?? 0,
            likeCount: likeCountsMap.get(post.id) ?? 0,
            isRemote: false,
            remoteUri: null,
            remoteBlog: null,
          };
        }
        const rp = remotePostsMap.get(row.id);
        if (!rp) return null;
        return {
          id: rp.id,
          categoryId: rp.localCategoryId,
          title: rp.title,
          slug: rp.slug,
          content: rp.content,
          excerpt: rp.excerpt,
          coverImage: rp.coverImage,
          status: "published" as const,
          viewCount: 0,
          commentCount: 0,
          likeCount: 0,
          createdAt: rp.remoteCreatedAt,
          updatedAt: rp.remoteUpdatedAt,
          deletedAt: null,
          category: rp.localCategoryId ? (categoriesMap.get(rp.localCategoryId) ?? null) : null,
          tags: [],
          isRemote: true,
          remoteUri: rp.remoteUri,
          remoteBlog: remoteBlogsMap.get(rp.remoteBlogId) ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (remoteIds.length > 0) {
      triggerStaleSync();
    }

    return c.json({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  },
);

// We need to implement other routes (POST, PUT, DELETE, GET :id) using standard Hono or OpenAPIHono
// For now, let's keep them as standard Hono routes attached to the same instance if possible,
// or just mix them. OpenAPIHono extends Hono, so we can use .post(), .put(), etc.

postsRoute.get("/tags", (c) => {
  const allTags = db.select({ name: schema.tags.name }).from(schema.tags).all();
  return c.json(allTags.map((t) => t.name));
});

postsRoute.get("/:id/access-logs", authMiddleware, (c) => {
  const postId = c.req.param("id");
  const logs = analyticsDb
    .select()
    .from(schema.postAccessLogs)
    .where(eq(schema.postAccessLogs.postId, postId))
    .orderBy(desc(schema.postAccessLogs.createdAt))
    .limit(10)
    .all();
  return c.json(logs);
});

postsRoute.get("/:param", async (c) => {
  const param = c.req.param("param");
  // If UUID v7 pattern, look up by ID; otherwise look up by slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  const post = isUuid
    ? db.select().from(schema.posts).where(eq(schema.posts.id, param)).get()
    : db.select().from(schema.posts).where(eq(schema.posts.slug, param)).get();

  if (!post || post.status === "deleted") {
    return c.json({ error: "Post not found." }, 404);
  }

  // Determine whether to increment view count: exclude admins or already-viewed visitors
  let shouldCount = true;
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const ownerId = await verifyToken(authHeader.slice(7));
    if (ownerId) shouldCount = false;
  }
  const viewedCookie = `zlog_viewed_${post.id}`;
  const cookies = c.req.header("Cookie") ?? "";
  if (cookies.includes(viewedCookie)) {
    shouldCount = false;
  }

  let { viewCount } = post;
  if (shouldCount) {
    viewCount = post.viewCount + 1;
    // Update view count in main DB
    db.update(schema.posts).set({ viewCount }).where(eq(schema.posts.id, post.id)).run();
    // Do not count re-views of the same post for 24 hours
    c.header("Set-Cookie", `${viewedCookie}=1; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`);

    // Log access in analytics DB
    const ua = c.req.header("User-Agent") ?? "";
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "";
    const referer = c.req.header("X-Referrer") ?? c.req.header("Referer") ?? "";
    const { os, browser } = parseUserAgent(ua);
    const country = ip ? (geoip.lookup(ip)?.country ?? null) : null;

    analyticsDb
      .insert(schema.postAccessLogs)
      .values({
        id: generateId(),
        postId: post.id,
        ip: ip || null,
        country,
        referer: referer || null,
        userAgent: ua || null,
        os,
        browser,
        createdAt: new Date().toISOString(),
      })
      .run();

    // Prune: keep only 10 most recent logs per post
    const recent = analyticsDb
      .select({ id: schema.postAccessLogs.id })
      .from(schema.postAccessLogs)
      .where(eq(schema.postAccessLogs.postId, post.id))
      .orderBy(desc(schema.postAccessLogs.createdAt))
      .all();

    if (recent.length > 10) {
      const idsToDelete = recent.slice(10).map((r) => r.id);
      analyticsDb
        .delete(schema.postAccessLogs)
        .where(inArray(schema.postAccessLogs.id, idsToDelete))
        .run();
    }
  }

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

  const commentCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.comments)
      .where(and(eq(schema.comments.postId, post.id), isNull(schema.comments.deletedAt)))
      .get()?.count ?? 0;

  // Liked info
  const visitorId = c.req.query("visitorId") ?? "";
  const likeCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.postLikes)
      .where(eq(schema.postLikes.postId, post.id))
      .get()?.count ?? 0;

  let isLikedByMe = false;
  if (visitorId) {
    const existing = db
      .select()
      .from(schema.postLikes)
      .where(and(eq(schema.postLikes.postId, post.id), eq(schema.postLikes.visitorId, visitorId)))
      .get();
    isLikedByMe = !!existing;
  }

  return c.json({
    ...post,
    viewCount,
    category,
    tags: tagRows,
    commentCount,
    likeCount,
    isLikedByMe,
  });
});

postsRoute.post("/:id/like", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json<{ visitorId: string }>();

  if (!body.visitorId) {
    return c.json({ error: "visitorId is required." }, 400);
  }

  const existing = db
    .select()
    .from(schema.postLikes)
    .where(and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.visitorId, body.visitorId)))
    .get();

  if (existing) {
    db.delete(schema.postLikes).where(eq(schema.postLikes.id, existing.id)).run();
    return c.json({ liked: false });
  } else {
    db.insert(schema.postLikes)
      .values({
        id: generateId(),
        postId,
        visitorId: body.visitorId,
        createdAt: new Date().toISOString(),
      })
      .run();
    return c.json({ liked: true });
  }
});

postsRoute.post("/", authMiddleware, async (c) => {
  // Legacy implementation - to be migrated to OpenAPI
  const body = await c.req.json<z.infer<typeof CreatePostSchema>>();
  // ... (rest of the logic same as before)
  if (!body.title || !body.content) {
    return c.json({ error: "Title and content are required." }, 400);
  }

  const baseSlug = createSlug(body.title);
  const conflicting = db
    .select({ slug: schema.posts.slug })
    .from(schema.posts)
    .where(like(schema.posts.slug, `${baseSlug}%`))
    .all()
    .map((p) => p.slug);
  const slug = createUniqueSlug(body.title, conflicting);
  const now = new Date().toISOString();
  const id = generateId();
  const excerpt = body.excerpt ?? stripMarkdown(body.content).slice(0, 200);

  db.insert(schema.posts)
    .values({
      id,
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug,
      content: body.content,
      excerpt,
      coverImage: body.coverImage ?? null,
      status: body.status ?? "draft",
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (body.tags && body.tags.length > 0) {
    for (const tagName of body.tags) {
      const normalizedName = tagName.toLowerCase().trim();
      const tagSlug = createSlug(tagName);
      let tag = db.select().from(schema.tags).where(eq(schema.tags.slug, tagSlug)).get();
      if (!tag) {
        const tagId = generateId();
        db.insert(schema.tags).values({ id: tagId, name: normalizedName, slug: tagSlug }).run();
        tag = { id: tagId, name: normalizedName, slug: tagSlug };
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
    coverImage?: string | null;
    excerpt?: string;
  }>();

  const existing = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (!existing) {
    return c.json({ error: "Post not found." }, 404);
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (body.title !== undefined) {
    updateData.title = body.title;
    if (body.title !== existing.title) {
      const newBase = createSlug(body.title);
      const conflicting = db
        .select({ slug: schema.posts.slug })
        .from(schema.posts)
        .where(like(schema.posts.slug, `${newBase}%`))
        .all()
        .map((p) => p.slug)
        .filter((s) => s !== existing.slug);
      updateData.slug = createUniqueSlug(body.title, conflicting);
    }
  }
  if (body.content !== undefined) {
    updateData.content = body.content;
    if (!body.excerpt) {
      updateData.excerpt = stripMarkdown(body.content).slice(0, 200);
    }
  }
  if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
  if (body.coverImage !== undefined) {
    // Delete old cover image file if it's being changed or removed
    if (existing.coverImage && existing.coverImage !== body.coverImage) {
      deleteUploadedImage(existing.coverImage);
    }
    updateData.coverImage = body.coverImage;
  }
  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === "deleted") updateData.deletedAt = now;
  }

  db.update(schema.posts).set(updateData).where(eq(schema.posts.id, id)).run();

  if (body.tags !== undefined) {
    db.delete(schema.postTags).where(eq(schema.postTags.postId, id)).run();
    for (const tagName of body.tags) {
      const normalizedName = tagName.toLowerCase().trim();
      const tagSlug = createSlug(tagName);
      let tag = db.select().from(schema.tags).where(eq(schema.tags.slug, tagSlug)).get();
      if (!tag) {
        const tagId = generateId();
        db.insert(schema.tags).values({ id: tagId, name: normalizedName, slug: tagSlug }).run();
        tag = { id: tagId, name: normalizedName, slug: tagSlug };
      }
      db.insert(schema.postTags).values({ postId: id, tagId: tag.id }).run();
    }
  }

  const updatedPost = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (updatedPost) {
    const catId = body.categoryId ?? existing.categoryId;
    if (catId) {
      if (body.status && body.status !== existing.status) {
        // Status has changed
        if (body.status === "published") {
          void sendWebhookToSubscribers("post.published", updatedPost, catId);
        } else if (body.status === "deleted") {
          void sendWebhookToSubscribers("post.deleted", updatedPost, catId);
        } else if (body.status === "draft" && existing.status === "published") {
          void sendWebhookToSubscribers("post.unpublished", updatedPost, catId);
        }
      } else if (existing.status === "published" && !body.status) {
        // Content changed while maintaining published status (cover image, body, etc.)
        const contentChanged =
          (body.title !== undefined && body.title !== existing.title) ||
          (body.content !== undefined && body.content !== existing.content) ||
          (body.coverImage !== undefined && body.coverImage !== existing.coverImage) ||
          (body.excerpt !== undefined && body.excerpt !== existing.excerpt) ||
          (body.categoryId !== undefined && body.categoryId !== existing.categoryId);
        if (contentChanged) {
          void sendWebhookToSubscribers("post.updated", updatedPost, catId);
        }
      }
    }
  }

  const result = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  return c.json(result);
});

postsRoute.delete("/:id", authMiddleware, (c) => {
  const id = c.req.param("id");
  const existing = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (!existing) {
    return c.json({ error: "Post not found." }, 404);
  }

  const now = new Date().toISOString();
  db.update(schema.posts)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(schema.posts.id, id))
    .run();

  if (existing.categoryId && existing.status === "published") {
    void sendWebhookToSubscribers("post.deleted", existing, existing.categoryId);
  }

  return c.json({ message: "Post has been deleted." });
});

export default postsRoute;
