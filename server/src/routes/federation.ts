import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
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
  const subscription = db.select().from(schema.categorySubscriptions).where(eq(schema.categorySubscriptions.remoteCategoryId, remoteCategory.id)).get();

  if (body.event === "post.published" || body.event === "post.updated") {
    const existing = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.remoteUri, remoteUri)).get();
    if (existing) {
      db.update(schema.remotePosts).set({ title: body.post.title, slug: body.post.slug, content: body.post.content, excerpt: body.post.excerpt ?? null, coverImage: body.post.coverImage ?? null, remoteStatus: "published", remoteUpdatedAt: body.post.updatedAt, fetchedAt: now }).where(eq(schema.remotePosts.id, existing.id)).run();
    } else {
      db.insert(schema.remotePosts).values({ id: generateId(), remoteUri, remoteBlogId: remoteBlog.id, remoteCategoryId: remoteCategory.id, localCategoryId: subscription?.localCategoryId ?? null, title: body.post.title, slug: body.post.slug, content: body.post.content, excerpt: body.post.excerpt ?? null, coverImage: body.post.coverImage ?? null, remoteStatus: "published", authorName: remoteBlog.displayName, remoteCreatedAt: body.post.createdAt, remoteUpdatedAt: body.post.updatedAt, fetchedAt: now }).run();
    }
  } else if (body.event === "post.deleted" || body.event === "post.unpublished") {
    db.update(schema.remotePosts).set({ remoteStatus: "deleted", fetchedAt: now }).where(eq(schema.remotePosts.remoteUri, remoteUri)).run();
  }

  return c.json({ message: "웹훅 처리 완료" });
});

export default federationRoute;
