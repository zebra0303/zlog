import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { authMiddleware } from "../middleware/auth.js";
import type { WebhookEvent } from "@zlog/shared";

const federationRoute = new Hono();

/** 마크다운 content 내 상대 경로 이미지를 절대 URL로 변환 (제공 측에서 사용) */
function resolveRelativeUrls(content: string, siteUrl: string): string {
  return content.replace(/(\!\[.*?\]\()(\/(uploads|img)\/[^)]+\))/g, `$1${siteUrl}$2`);
}

/** 상대 경로를 절대 URL로 변환 (coverImage 등) */
function resolveUrl(url: string | null, siteUrl: string): string | null {
  if (!url) return url;
  return url.startsWith("/") ? siteUrl + url : url;
}

/**
 * 수신 측에서 사용: content 내 이미지 URL의 도메인을 실제 원격 블로그 URL로 치환
 * - 상대 경로: /uploads/... → remoteSiteUrl/uploads/...
 * - 잘못된 도메인: http://localhost/uploads/... → remoteSiteUrl/uploads/...
 * - 마크다운 ![...](...) 및 HTML <img src="..."> 모두 처리
 */
function fixRemoteContentUrls(content: string, remoteSiteUrl: string): string {
  let fixed = content;
  // 1) 마크다운 이미지 상대 경로
  fixed = fixed.replace(/(\!\[.*?\]\()(\/(uploads|img)\/[^)]+\))/g, `$1${remoteSiteUrl}$2`);
  // 2) 마크다운 이미지 잘못된 절대 URL → 올바른 도메인으로 교체
  fixed = fixed.replace(/(\!\[.*?\]\()https?:\/\/[^/\s"')]+(\/(uploads|img)\/[^)]+\))/g, `$1${remoteSiteUrl}$2`);
  // 3) HTML img src 상대 경로
  fixed = fixed.replace(/(src=["'])(\/(uploads|img)\/)/g, `$1${remoteSiteUrl}$2`);
  // 4) HTML img src 잘못된 절대 URL → 올바른 도메인으로 교체
  fixed = fixed.replace(/(src=["'])https?:\/\/[^/\s"']+(\/(uploads|img)\/)/g, `$1${remoteSiteUrl}$2`);
  return fixed;
}

/** 단일 URL의 도메인을 실제 원격 블로그 URL로 치환 */
function fixRemoteUrl(url: string | null, remoteSiteUrl: string): string | null {
  if (!url) return url;
  if (url.startsWith("/")) return remoteSiteUrl + url;
  // 잘못된 도메인 교체 (예: http://localhost/uploads/... → remoteSiteUrl/uploads/...)
  return url.replace(/^https?:\/\/[^/]+(\/(uploads|img)\/)/, `${remoteSiteUrl}$1`);
}

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
    id: post.id, title: post.title, slug: post.slug,
    content: resolveRelativeUrls(post.content, siteUrl),
    excerpt: post.excerpt, coverImage: resolveUrl(post.coverImage, siteUrl),
    uri: `${siteUrl}/posts/${post.id}`, createdAt: post.createdAt, updatedAt: post.updatedAt,
  })));
});

federationRoute.get("/posts/:id", async (c) => {
  const id = c.req.param("id");
  const post = db.select().from(schema.posts).where(and(eq(schema.posts.id, id), eq(schema.posts.status, "published"))).get();
  if (!post) return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  const siteUrl = ownerRecord?.siteUrl ?? "";
  return c.json({
    id: post.id, title: post.title, slug: post.slug,
    content: resolveRelativeUrls(post.content, siteUrl),
    excerpt: post.excerpt, coverImage: resolveUrl(post.coverImage, siteUrl),
    uri: `${siteUrl}/posts/${post.id}`,
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
    const fixedContent = fixRemoteContentUrls(body.post.content, body.siteUrl);
    const fixedCover = fixRemoteUrl(body.post.coverImage ?? null, body.siteUrl);
    const existing = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.remoteUri, remoteUri)).get();
    if (existing) {
      db.update(schema.remotePosts).set({ title: body.post.title, slug: body.post.slug, content: fixedContent, excerpt: body.post.excerpt ?? null, coverImage: fixedCover, remoteStatus: "published", remoteUpdatedAt: body.post.updatedAt, fetchedAt: now, localCategoryId: localCatId ?? existing.localCategoryId }).where(eq(schema.remotePosts.id, existing.id)).run();
    } else {
      db.insert(schema.remotePosts).values({ id: generateId(), remoteUri, remoteBlogId: remoteBlog.id, remoteCategoryId: remoteCategory.id, localCategoryId: localCatId, title: body.post.title, slug: body.post.slug, content: fixedContent, excerpt: body.post.excerpt ?? null, coverImage: fixedCover, remoteStatus: "published", authorName: remoteBlog.displayName, remoteCreatedAt: body.post.createdAt, remoteUpdatedAt: body.post.updatedAt, fetchedAt: now }).run();
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
    // 기존 remotePosts의 localCategoryId 복원
    db.update(schema.remotePosts)
      .set({ localCategoryId: localCat.id })
      .where(
        and(
          eq(schema.remotePosts.remoteCategoryId, remoteCat.id),
          eq(schema.remotePosts.remoteStatus, "published"),
        ),
      )
      .run();
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

// ============ 외부 글 상세보기 (원본 상태 실시간 확인) ============
federationRoute.get("/remote-posts/:id", async (c) => {
  const id = c.req.param("id");
  const rp = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.id, id)).get();
  if (!rp) return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);

  const remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, rp.remoteBlogId)).get();

  // 원본 블로그에서 최신 상태 확인 (백그라운드 검증)
  if (remoteBlog && rp.remoteUri) {
    // remoteUri 형태: "https://blog.example.com/posts/{postId}"
    const uriParts = rp.remoteUri.split("/posts/");
    const remotePostId = uriParts.length > 1 ? uriParts[uriParts.length - 1] : null;
    if (remotePostId) {
      try {
        const res = await fetch(`${remoteBlog.siteUrl}/api/federation/posts/${remotePostId}`, {
          signal: AbortSignal.timeout(8000),
        });
        const now = new Date().toISOString();
        if (res.status === 404) {
          // 원본이 삭제됨 → 로컬 상태 업데이트
          db.update(schema.remotePosts)
            .set({ remoteStatus: "deleted", fetchedAt: now })
            .where(eq(schema.remotePosts.id, id))
            .run();
          return c.json({
            ...rp,
            remoteStatus: "deleted",
            remoteBlog: remoteBlog ? { siteUrl: remoteBlog.siteUrl, displayName: remoteBlog.displayName, blogTitle: remoteBlog.blogTitle, avatarUrl: remoteBlog.avatarUrl } : null,
          });
        } else if (res.ok) {
          const original = await res.json() as {
            title: string; slug: string; content: string;
            excerpt?: string | null; coverImage?: string | null;
            updatedAt: string;
          };
          // 원본이 업데이트되었다면 로컬 캐시 갱신
          if (original.updatedAt > rp.remoteUpdatedAt) {
            db.update(schema.remotePosts)
              .set({
                title: original.title,
                slug: original.slug,
                content: original.content,
                excerpt: original.excerpt ?? null,
                coverImage: original.coverImage ?? null,
                remoteUpdatedAt: original.updatedAt,
                fetchedAt: now,
              })
              .where(eq(schema.remotePosts.id, id))
              .run();
            // 갱신된 데이터로 응답
            const updated = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.id, id)).get();
            return c.json({
              ...updated,
              remoteBlog: remoteBlog ? { siteUrl: remoteBlog.siteUrl, displayName: remoteBlog.displayName, blogTitle: remoteBlog.blogTitle, avatarUrl: remoteBlog.avatarUrl } : null,
            });
          }
        }
        // res가 다른 상태(502, timeout 등)이면 기존 캐시 그대로 반환
      } catch {
        // 네트워크 오류 시 기존 캐시 반환
      }
    }
  }

  if (rp.remoteStatus !== "published") return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);

  return c.json({
    ...rp,
    remoteBlog: remoteBlog ? { siteUrl: remoteBlog.siteUrl, displayName: remoteBlog.displayName, blogTitle: remoteBlog.blogTitle, avatarUrl: remoteBlog.avatarUrl } : null,
  });
});

// ============ 관리자용: 원격 블로그 카테고리 프록시 조회 ============
federationRoute.get("/remote-categories", authMiddleware, async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "url 파라미터가 필요합니다." }, 400);

  const normalized = url.replace(/\/+$/, "");
  try {
    const res = await fetch(`${normalized}/api/federation/categories`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return c.json({ error: `원격 서버 응답 오류: ${res.status}` }, 502);
    const cats = await res.json();
    return c.json(cats);
  } catch {
    return c.json({ error: "원격 서버에 연결할 수 없습니다." }, 502);
  }
});

// ============ 관리자용: 내가 구독 중인 카테고리 목록 ============
federationRoute.get("/subscriptions", authMiddleware, async (c) => {
  const subs = db
    .select({
      id: schema.categorySubscriptions.id,
      isActive: schema.categorySubscriptions.isActive,
      lastSyncedAt: schema.categorySubscriptions.lastSyncedAt,
      createdAt: schema.categorySubscriptions.createdAt,
      localCategoryId: schema.categorySubscriptions.localCategoryId,
      localCategoryName: schema.categories.name,
      localCategorySlug: schema.categories.slug,
      remoteCategoryId: schema.remoteCategories.id,
      remoteCategoryName: schema.remoteCategories.name,
      remoteCategoryRemoteId: schema.remoteCategories.remoteId,
      remoteBlogId: schema.remoteBlogs.id,
      remoteBlogSiteUrl: schema.remoteBlogs.siteUrl,
      remoteBlogTitle: schema.remoteBlogs.blogTitle,
      remoteBlogDisplayName: schema.remoteBlogs.displayName,
    })
    .from(schema.categorySubscriptions)
    .innerJoin(schema.categories, eq(schema.categorySubscriptions.localCategoryId, schema.categories.id))
    .innerJoin(schema.remoteCategories, eq(schema.categorySubscriptions.remoteCategoryId, schema.remoteCategories.id))
    .innerJoin(schema.remoteBlogs, eq(schema.remoteCategories.remoteBlogId, schema.remoteBlogs.id))
    .orderBy(desc(schema.categorySubscriptions.createdAt))
    .all();

  return c.json(subs);
});

// ============ 관리자용: 구독 카테고리 수동 싱크 ============
federationRoute.post("/subscriptions/:id/sync", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const sub = db.select().from(schema.categorySubscriptions).where(eq(schema.categorySubscriptions.id, id)).get();
  if (!sub) return c.json({ error: "구독 정보를 찾을 수 없습니다." }, 404);

  const remoteCat = db.select().from(schema.remoteCategories).where(eq(schema.remoteCategories.id, sub.remoteCategoryId)).get();
  if (!remoteCat) return c.json({ error: "원격 카테고리를 찾을 수 없습니다." }, 404);

  const remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, remoteCat.remoteBlogId)).get();
  if (!remoteBlog) return c.json({ error: "원격 블로그를 찾을 수 없습니다." }, 404);

  try {
    // 항상 전체 글을 가져와서 이미지 URL 등도 최신화
    const postsUrl = `${remoteBlog.siteUrl}/api/federation/categories/${remoteCat.remoteId}/posts`;
    const res = await fetch(postsUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return c.json({ error: `원격 서버 응답 오류: ${res.status}` }, 502);
    const posts = (await res.json()) as {
      id: string; title: string; slug: string; content: string;
      excerpt?: string; coverImage?: string; uri?: string;
      createdAt: string; updatedAt: string;
    }[];

    const now = new Date().toISOString();
    let synced = 0;

    for (const post of posts) {
      // uri의 도메인이 잘못되었을 수 있으므로 (예: http://localhost/posts/...) 실제 remoteBlog URL로 치환
      const rawUri = post.uri || `${remoteBlog.siteUrl}/posts/${post.id}`;
      const remoteUri = rawUri.replace(/^https?:\/\/[^/]+/, remoteBlog.siteUrl);
      const fixedContent = fixRemoteContentUrls(post.content, remoteBlog.siteUrl);
      const fixedCover = fixRemoteUrl(post.coverImage ?? null, remoteBlog.siteUrl);
      const existing = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.remoteUri, remoteUri)).get();
      if (existing) {
        db.update(schema.remotePosts).set({
          title: post.title, slug: post.slug, content: fixedContent,
          excerpt: post.excerpt ?? null, coverImage: fixedCover,
          remoteStatus: "published", remoteUpdatedAt: post.updatedAt, fetchedAt: now,
          localCategoryId: sub.localCategoryId,
        }).where(eq(schema.remotePosts.id, existing.id)).run();
      } else {
        db.insert(schema.remotePosts).values({
          id: generateId(), remoteUri, remoteBlogId: remoteBlog.id,
          remoteCategoryId: remoteCat.id, localCategoryId: sub.localCategoryId,
          title: post.title, slug: post.slug, content: fixedContent,
          excerpt: post.excerpt ?? null, coverImage: fixedCover,
          remoteStatus: "published", authorName: remoteBlog.displayName,
          remoteCreatedAt: post.createdAt, remoteUpdatedAt: post.updatedAt, fetchedAt: now,
        }).run();
      }
      synced++;
    }

    db.update(schema.categorySubscriptions).set({ lastSyncedAt: now }).where(eq(schema.categorySubscriptions.id, id)).run();

    return c.json({ message: `${synced}개의 글이 동기화되었습니다.`, syncedCount: synced, lastSyncedAt: now });
  } catch (err) {
    console.error("❌ 수동 싱크 실패:", err);
    return c.json({ error: "원격 서버에 연결할 수 없습니다." }, 502);
  }
});

// ============ 관리자용: 구독 활성/비활성 토글 ============
federationRoute.put("/subscriptions/:id/toggle", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const existing = db.select().from(schema.categorySubscriptions).where(eq(schema.categorySubscriptions.id, id)).get();
  if (!existing) return c.json({ error: "구독 정보를 찾을 수 없습니다." }, 404);
  const newActive = !existing.isActive;
  db.update(schema.categorySubscriptions).set({ isActive: newActive }).where(eq(schema.categorySubscriptions.id, id)).run();
  if (!newActive) {
    // 비활성화 시 remotePosts에서 localCategoryId를 null로 설정하여 목록에서 제거
    db.update(schema.remotePosts)
      .set({ localCategoryId: null })
      .where(
        and(
          eq(schema.remotePosts.remoteCategoryId, existing.remoteCategoryId),
          eq(schema.remotePosts.localCategoryId, existing.localCategoryId),
        ),
      )
      .run();
  } else {
    // 활성화 시 remotePosts에 localCategoryId 복원
    db.update(schema.remotePosts)
      .set({ localCategoryId: existing.localCategoryId })
      .where(
        and(
          eq(schema.remotePosts.remoteCategoryId, existing.remoteCategoryId),
          eq(schema.remotePosts.remoteStatus, "published"),
        ),
      )
      .run();
  }
  return c.json({ message: newActive ? "구독이 활성화되었습니다." : "구독이 비활성화되었습니다.", isActive: newActive });
});

// ============ 관리자용: 구독 삭제 ============
federationRoute.delete("/subscriptions/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const existing = db.select().from(schema.categorySubscriptions).where(eq(schema.categorySubscriptions.id, id)).get();
  if (!existing) return c.json({ error: "구독 정보를 찾을 수 없습니다." }, 404);
  // remotePosts에서 localCategoryId를 null로 설정
  db.update(schema.remotePosts)
    .set({ localCategoryId: null })
    .where(
      and(
        eq(schema.remotePosts.remoteCategoryId, existing.remoteCategoryId),
        eq(schema.remotePosts.localCategoryId, existing.localCategoryId),
      ),
    )
    .run();
  // 구독 레코드 완전 삭제
  db.delete(schema.categorySubscriptions).where(eq(schema.categorySubscriptions.id, id)).run();
  return c.json({ message: "구독이 삭제되었습니다." });
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
