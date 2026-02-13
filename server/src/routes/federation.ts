import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { authMiddleware } from "../middleware/auth.js";
import type { WebhookEvent } from "@zlog/shared";

const federationRoute = new Hono();

federationRoute.get("/info", async (c) => {
  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  if (!ownerRecord) return c.json({ error: "블로그 정보를 찾을 수 없습니다." }, 404);
  return c.json({
    siteUrl: ownerRecord.siteUrl, displayName: ownerRecord.displayName,
    blogTitle: ownerRecord.blogTitle, blogDescription: ownerRecord.blogDescription,
    avatarUrl: ownerRecord.avatarUrl, blogHandle: ownerRecord.blogHandle,
  });
});

federationRoute.get("/categories", async (c) => {
  const cats = db.select().from(schema.categories).where(eq(schema.categories.isPublic, true)).all();
  return c.json(cats.map((cat) => ({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description })));
});

federationRoute.get("/categories/:id/posts", async (c) => {
  const categoryId = c.req.param("id");
  const since = c.req.query("since");

  const conditions = and(eq(schema.posts.categoryId, categoryId), eq(schema.posts.status, "published"));
  const postsResult = since
    ? db.select().from(schema.posts).where(and(conditions, gt(schema.posts.updatedAt, since))).orderBy(desc(schema.posts.createdAt)).all()
    : db.select().from(schema.posts).where(conditions).orderBy(desc(schema.posts.createdAt)).all();

  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  const siteUrl = ownerRecord?.siteUrl ?? "";

  return c.json(postsResult.map((post) => ({
    id: post.id, title: post.title, slug: post.slug, content: post.content,
    excerpt: post.excerpt, coverImage: post.coverImage,
    uri: `${siteUrl}/posts/${post.id}`, createdAt: post.createdAt, updatedAt: post.updatedAt,
  })));
});

federationRoute.get("/posts/:id", async (c) => {
  const id = c.req.param("id");
  const post = db.select().from(schema.posts).where(and(eq(schema.posts.id, id), eq(schema.posts.status, "published"))).get();
  if (!post) return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  return c.json({
    id: post.id, title: post.title, slug: post.slug, content: post.content,
    excerpt: post.excerpt, coverImage: post.coverImage,
    uri: `${ownerRecord?.siteUrl ?? ""}/posts/${post.id}`,
    createdAt: post.createdAt, updatedAt: post.updatedAt, author: ownerRecord?.displayName ?? "",
  });
});

federationRoute.post("/subscribe", async (c) => {
  const body = await c.req.json<{ categoryId: string; subscriberUrl: string; callbackUrl: string }>();
  if (!body.categoryId || !body.subscriberUrl || !body.callbackUrl) return c.json({ error: "필수 필드가 누락되었습니다." }, 400);

  const cat = db.select().from(schema.categories).where(eq(schema.categories.id, body.categoryId)).get();
  if (!cat) return c.json({ error: "카테고리를 찾을 수 없습니다." }, 404);

  const existing = db.select().from(schema.subscribers).where(and(eq(schema.subscribers.categoryId, body.categoryId), eq(schema.subscribers.subscriberUrl, body.subscriberUrl))).get();
  if (existing) {
    db.update(schema.subscribers).set({ isActive: true, callbackUrl: body.callbackUrl }).where(eq(schema.subscribers.id, existing.id)).run();
    return c.json({ message: "구독이 재활성화되었습니다.", id: existing.id });
  }

  const id = generateId();
  db.insert(schema.subscribers).values({ id, categoryId: body.categoryId, subscriberUrl: body.subscriberUrl, callbackUrl: body.callbackUrl, createdAt: new Date().toISOString() }).run();
  return c.json({ message: "구독이 등록되었습니다.", id }, 201);
});

federationRoute.post("/unsubscribe", async (c) => {
  const body = await c.req.json<{ categoryId: string; subscriberUrl: string }>();
  const existing = db.select().from(schema.subscribers).where(and(eq(schema.subscribers.categoryId, body.categoryId), eq(schema.subscribers.subscriberUrl, body.subscriberUrl))).get();
  if (!existing) return c.json({ error: "구독 정보를 찾을 수 없습니다." }, 404);
  db.update(schema.subscribers).set({ isActive: false }).where(eq(schema.subscribers.id, existing.id)).run();
  return c.json({ message: "구독이 해제되었습니다." });
});

federationRoute.post("/webhook", async (c) => {
  const body = await c.req.json<WebhookEvent>();
  if (!body.event || !body.post || !body.categoryId || !body.siteUrl) return c.json({ error: "잘못된 웹훅 데이터입니다." }, 400);

  let remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.siteUrl, body.siteUrl)).get();
  if (!remoteBlog) {
    try {
      const infoRes = await fetch(`${body.siteUrl}/api/federation/info`);
      const info = (await infoRes.json()) as { displayName?: string; blogTitle?: string; avatarUrl?: string };
      const id = generateId();
      db.insert(schema.remoteBlogs).values({ id, siteUrl: body.siteUrl, displayName: info.displayName ?? null, blogTitle: info.blogTitle ?? null, avatarUrl: info.avatarUrl ?? null, createdAt: new Date().toISOString() }).run();
      remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, id)).get()!;
    } catch { return c.json({ error: "원격 블로그 정보를 가져올 수 없습니다." }, 502); }
  }

  let remoteCategory = db.select().from(schema.remoteCategories).where(and(eq(schema.remoteCategories.remoteBlogId, remoteBlog.id), eq(schema.remoteCategories.remoteId, body.categoryId))).get();
  if (!remoteCategory) {
    const id = generateId();
    db.insert(schema.remoteCategories).values({ id, remoteBlogId: remoteBlog.id, remoteId: body.categoryId, name: "Unknown", slug: "unknown", createdAt: new Date().toISOString() }).run();
    remoteCategory = db.select().from(schema.remoteCategories).where(eq(schema.remoteCategories.id, id)).get()!;
  }

  const remoteUri = `${body.siteUrl}/posts/${body.post.id}`;
  const now = new Date().toISOString();
  const subscription = db.select().from(schema.categorySubscriptions).where(and(eq(schema.categorySubscriptions.remoteCategoryId, remoteCategory.id), eq(schema.categorySubscriptions.isActive, true))).get();
  const localCatId = subscription?.localCategoryId ?? null;

  if (body.event === "post.published" || body.event === "post.updated") {
    const existing = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.remoteUri, remoteUri)).get();
    if (existing) {
      db.update(schema.remotePosts).set({ title: body.post.title, slug: body.post.slug, content: body.post.content, excerpt: body.post.excerpt ?? null, coverImage: body.post.coverImage ?? null, remoteStatus: "published", remoteUpdatedAt: body.post.updatedAt, fetchedAt: now, localCategoryId: localCatId ?? existing.localCategoryId }).where(eq(schema.remotePosts.id, existing.id)).run();
    } else {
      db.insert(schema.remotePosts).values({ id: generateId(), remoteUri, remoteBlogId: remoteBlog.id, remoteCategoryId: remoteCategory.id, localCategoryId: localCatId, title: body.post.title, slug: body.post.slug, content: body.post.content, excerpt: body.post.excerpt ?? null, coverImage: body.post.coverImage ?? null, remoteStatus: "published", authorName: remoteBlog.displayName, remoteCreatedAt: body.post.createdAt, remoteUpdatedAt: body.post.updatedAt, fetchedAt: now }).run();
    }
  } else if (body.event === "post.deleted" || body.event === "post.unpublished") {
    db.update(schema.remotePosts).set({ remoteStatus: "deleted", fetchedAt: now }).where(eq(schema.remotePosts.remoteUri, remoteUri)).run();
  }

  return c.json({ message: "웹훅 처리 완료" });
});

// ============ 로컬 구독 등록 (내가 외부 블로그 카테고리를 구독) ============
federationRoute.post("/local-subscribe", async (c) => {
  const body = await c.req.json<{
    remoteSiteUrl: string;
    remoteCategoryId: string;
    remoteCategoryName: string;
    remoteCategorySlug: string;
    localCategorySlug: string;
  }>();

  if (!body.remoteSiteUrl || !body.remoteCategoryId || !body.localCategorySlug) {
    return c.json({ error: "필수 필드가 누락되었습니다." }, 400);
  }

  // 로컬 카테고리 찾기
  const localCat = db.select().from(schema.categories).where(eq(schema.categories.slug, body.localCategorySlug)).get();
  if (!localCat) return c.json({ error: "로컬 카테고리를 찾을 수 없습니다." }, 404);

  // remoteBlog 찾기/생성
  let remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.siteUrl, body.remoteSiteUrl)).get();
  if (!remoteBlog) {
    const id = generateId();
    try {
      const infoRes = await fetch(`${body.remoteSiteUrl}/api/federation/info`);
      const info = (await infoRes.json()) as { displayName?: string; blogTitle?: string; avatarUrl?: string };
      db.insert(schema.remoteBlogs).values({ id, siteUrl: body.remoteSiteUrl, displayName: info.displayName ?? null, blogTitle: info.blogTitle ?? null, avatarUrl: info.avatarUrl ?? null, createdAt: new Date().toISOString() }).run();
    } catch {
      db.insert(schema.remoteBlogs).values({ id, siteUrl: body.remoteSiteUrl, createdAt: new Date().toISOString() }).run();
    }
    remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, id)).get()!;
  }

  // remoteCategory 찾기/생성
  let remoteCat = db.select().from(schema.remoteCategories).where(and(eq(schema.remoteCategories.remoteBlogId, remoteBlog.id), eq(schema.remoteCategories.remoteId, body.remoteCategoryId))).get();
  if (!remoteCat) {
    const id = generateId();
    db.insert(schema.remoteCategories).values({ id, remoteBlogId: remoteBlog.id, remoteId: body.remoteCategoryId, name: body.remoteCategoryName || "Unknown", slug: body.remoteCategorySlug || "unknown", createdAt: new Date().toISOString() }).run();
    remoteCat = db.select().from(schema.remoteCategories).where(eq(schema.remoteCategories.id, id)).get()!;
  }

  // categorySubscription 찾기/생성
  const existingSub = db.select().from(schema.categorySubscriptions).where(and(eq(schema.categorySubscriptions.localCategoryId, localCat.id), eq(schema.categorySubscriptions.remoteCategoryId, remoteCat.id))).get();
  if (existingSub) {
    db.update(schema.categorySubscriptions).set({ isActive: true }).where(eq(schema.categorySubscriptions.id, existingSub.id)).run();
    return c.json({ message: "구독이 재활성화되었습니다.", subscriptionId: existingSub.id });
  }

  const subId = generateId();
  db.insert(schema.categorySubscriptions).values({ id: subId, localCategoryId: localCat.id, remoteCategoryId: remoteCat.id, createdAt: new Date().toISOString() }).run();
  return c.json({ message: "로컬 구독이 등록되었습니다.", subscriptionId: subId }, 201);
});

// ============ 로컬 구독 해제 ============
federationRoute.post("/local-unsubscribe", async (c) => {
  const body = await c.req.json<{ remoteSiteUrl: string; remoteCategoryId: string; localCategorySlug: string }>();

  const localCat = db.select().from(schema.categories).where(eq(schema.categories.slug, body.localCategorySlug)).get();
  if (!localCat) return c.json({ error: "로컬 카테고리를 찾을 수 없습니다." }, 404);

  const remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.siteUrl, body.remoteSiteUrl)).get();
  if (!remoteBlog) return c.json({ error: "원격 블로그를 찾을 수 없습니다." }, 404);

  const remoteCat = db.select().from(schema.remoteCategories).where(and(eq(schema.remoteCategories.remoteBlogId, remoteBlog.id), eq(schema.remoteCategories.remoteId, body.remoteCategoryId))).get();
  if (!remoteCat) return c.json({ error: "원격 카테고리를 찾을 수 없습니다." }, 404);

  const sub = db.select().from(schema.categorySubscriptions).where(and(eq(schema.categorySubscriptions.localCategoryId, localCat.id), eq(schema.categorySubscriptions.remoteCategoryId, remoteCat.id))).get();
  if (!sub) return c.json({ error: "구독 정보를 찾을 수 없습니다." }, 404);

  db.update(schema.categorySubscriptions).set({ isActive: false }).where(eq(schema.categorySubscriptions.id, sub.id)).run();
  return c.json({ message: "로컬 구독이 해제되었습니다." });
});

// ============ 외부 글 상세보기 ============
federationRoute.get("/remote-posts/:id", async (c) => {
  const id = c.req.param("id");
  const rp = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.id, id)).get();
  if (!rp || rp.remoteStatus !== "published") return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);

  const remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, rp.remoteBlogId)).get();

  return c.json({
    ...rp,
    remoteBlog: remoteBlog ? { siteUrl: remoteBlog.siteUrl, displayName: remoteBlog.displayName, blogTitle: remoteBlog.blogTitle, avatarUrl: remoteBlog.avatarUrl } : null,
  });
});

// ============ 관리자용: 구독자 목록 조회 ============
federationRoute.get("/subscribers", authMiddleware, async (c) => {
  const subs = db
    .select({
      id: schema.subscribers.id,
      categoryId: schema.subscribers.categoryId,
      categoryName: schema.categories.name,
      subscriberUrl: schema.subscribers.subscriberUrl,
      callbackUrl: schema.subscribers.callbackUrl,
      isActive: schema.subscribers.isActive,
      createdAt: schema.subscribers.createdAt,
    })
    .from(schema.subscribers)
    .leftJoin(schema.categories, eq(schema.subscribers.categoryId, schema.categories.id))
    .orderBy(desc(schema.subscribers.createdAt))
    .all();

  return c.json(subs);
});

// ============ 관리자용: 구독자 삭제 ============
federationRoute.delete("/subscribers/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const existing = db.select().from(schema.subscribers).where(eq(schema.subscribers.id, id)).get();
  if (!existing) return c.json({ error: "구독 정보를 찾을 수 없습니다." }, 404);
  db.delete(schema.subscribers).where(eq(schema.subscribers.id, id)).run();
  return c.json({ message: "구독자가 삭제되었습니다." });
});

export default federationRoute;
