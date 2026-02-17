import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, desc, and, or, sql, like, isNotNull, inArray } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { generateId } from "../lib/uuid.js";
import { createSlug, createUniqueSlug } from "../lib/slug.js";
import { sendWebhookToSubscribers } from "../services/feedService.js";
import { triggerStaleSync } from "../services/syncService.js";
import { unlinkSync } from "node:fs";
import path from "node:path";

function deleteUploadedImage(imageUrl: string) {
  if (!imageUrl.startsWith("/uploads/images/")) return;
  try {
    const filePath = path.join(process.cwd(), imageUrl);
    unlinkSync(filePath);
  } catch {
    /* ignore – file may already be deleted */
  }
}

const postsRoute = new Hono();

postsRoute.get("/", (c) => {
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const categorySlug = c.req.query("category");
  const tagSlug = c.req.query("tag");
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

  const conditions: ReturnType<typeof eq>[] = [];
  if (status === "all") {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    conditions.push(or(eq(schema.posts.status, "published"), eq(schema.posts.status, "draft"))!);
  } else {
    conditions.push(eq(schema.posts.status, status as "draft" | "published" | "deleted"));
  }
  if (categoryId) {
    conditions.push(eq(schema.posts.categoryId, categoryId));
  }
  if (search) {
    conditions.push(like(schema.posts.title, `%${search}%`));
  }
  if (tagSlug) {
    const tag = db.select().from(schema.tags).where(eq(schema.tags.slug, tagSlug)).get();
    if (tag) {
      const tagPostIds = db
        .select({ postId: schema.postTags.postId })
        .from(schema.postTags)
        .where(eq(schema.postTags.tagId, tag.id))
        .all()
        .map((r) => r.postId);
      if (tagPostIds.length > 0) {
        conditions.push(inArray(schema.posts.id, tagPostIds));
      } else {
        conditions.push(sql`0 = 1`);
      }
    } else {
      conditions.push(sql`0 = 1`);
    }
  }

  const whereClause = and(...conditions);

  const localTotal =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(whereClause)
      .get()?.count ?? 0;

  // published 상태 조회 시 remote_posts도 포함 (태그 필터 제외)
  let remoteItems: {
    id: string;
    categoryId: string | null;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    coverImage: string | null;
    status: "published";
    viewCount: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    category: { id: string; name: string; slug: string } | null;
    tags: { id: string; name: string; slug: string }[];
    isRemote: true;
    remoteUri: string | null;
    remoteBlog: {
      siteUrl: string;
      displayName: string | null;
      blogTitle: string | null;
      avatarUrl: string | null;
    } | null;
  }[] = [];

  if (status === "published" && !tagSlug) {
    const remoteConditions = [
      eq(schema.remotePosts.remoteStatus, "published"),
      isNotNull(schema.remotePosts.localCategoryId),
    ];
    if (categoryId) {
      remoteConditions.push(eq(schema.remotePosts.localCategoryId, categoryId));
    }
    if (search) {
      remoteConditions.push(like(schema.remotePosts.title, `%${search}%`));
    }
    const remotePostsResult = db
      .select()
      .from(schema.remotePosts)
      .where(and(...remoteConditions))
      .orderBy(desc(schema.remotePosts.remoteCreatedAt))
      .all();

    remoteItems = remotePostsResult.map((rp) => {
      const cat = rp.localCategoryId
        ? (db
            .select({
              id: schema.categories.id,
              name: schema.categories.name,
              slug: schema.categories.slug,
            })
            .from(schema.categories)
            .where(eq(schema.categories.id, rp.localCategoryId))
            .get() ?? null)
        : null;
      const rb = db
        .select()
        .from(schema.remoteBlogs)
        .where(eq(schema.remoteBlogs.id, rp.remoteBlogId))
        .get();
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
        createdAt: rp.remoteCreatedAt,
        updatedAt: rp.remoteUpdatedAt,
        deletedAt: null,
        category: cat,
        tags: [],
        isRemote: true as const,
        remoteUri: rp.remoteUri,
        remoteBlog: rb
          ? {
              siteUrl: rb.siteUrl,
              displayName: rb.displayName,
              blogTitle: rb.blogTitle,
              avatarUrl: rb.avatarUrl,
            }
          : null,
      };
    });
  }

  const remoteTotal = remoteItems.length;
  const combinedTotal = localTotal + remoteTotal;

  // 로컬 글을 현재 페이지까지 채울 만큼 가져와서 원격 글과 합산 후 페이지네이션
  const localFetchLimit = page * perPage;
  const postsResult = db
    .select()
    .from(schema.posts)
    .where(whereClause)
    .orderBy(desc(schema.posts.createdAt))
    .limit(localFetchLimit)
    .all();

  const localItems = postsResult.map((post) => {
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

    return {
      ...post,
      category,
      tags: tagRows,
      isRemote: false as const,
      remoteUri: null,
      remoteBlog: null,
    };
  });

  // 합치고 날짜순 정렬 후 현재 페이지만 잘라냄
  const allSorted = [...localItems, ...remoteItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const start = (page - 1) * perPage;
  const pageItems = allSorted.slice(start, start + perPage);

  // 원격 게시글이 포함될 때 stale한 구독을 백그라운드 동기화 트리거
  if (remoteItems.length > 0) {
    triggerStaleSync();
  }

  return c.json({
    items: pageItems,
    total: combinedTotal,
    page,
    perPage,
    totalPages: Math.ceil(combinedTotal / perPage),
  });
});

postsRoute.get("/:param", (c) => {
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
  const excerpt = body.excerpt ?? body.content.replace(/[#*`>\-[\]()!]/g, "").slice(0, 200);

  db.insert(schema.posts)
    .values({
      id,
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug,
      content: body.content,
      excerpt,
      coverImage: body.coverImage ?? null,
      status: (body.status ?? "draft") as "draft" | "published",
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
    coverImage?: string | null;
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
      updateData.excerpt = body.content.replace(/[#*`>\-[\]()!]/g, "").slice(0, 200);
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

  const updatedPost = db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (updatedPost) {
    const catId = body.categoryId ?? existing.categoryId;
    if (catId) {
      if (body.status && body.status !== existing.status) {
        // status가 변경된 경우
        if (body.status === "published") {
          void sendWebhookToSubscribers("post.published", updatedPost, catId);
        } else if (body.status === "deleted") {
          void sendWebhookToSubscribers("post.deleted", updatedPost, catId);
        } else if (body.status === "draft" && existing.status === "published") {
          void sendWebhookToSubscribers("post.unpublished", updatedPost, catId);
        }
      } else if (existing.status === "published" && !body.status) {
        // published 상태를 유지하면서 내용이 변경된 경우 (커버이미지, 본문 등)
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
