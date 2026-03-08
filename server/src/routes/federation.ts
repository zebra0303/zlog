import { Hono } from "hono";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { authMiddleware } from "../middleware/auth.js";
import { fixRemoteUrl, fixRemoteContentUrls, validateRemoteUrl } from "../lib/remoteUrl.js";
import { federationService } from "../services/federation.js";
import type { WebhookEvent } from "@zlog/shared";

const federationRoute = new Hono();

federationRoute.get("/info", (c) => {
  try {
    const info = federationService.getBlogInfo();
    return c.json(info);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Error" }, 404);
  }
});

federationRoute.get("/categories", (c) => {
  const categories = federationService.getPublicCategories();
  return c.json(categories);
});

// Default max posts per federation sync to prevent unbounded responses
federationRoute.get("/categories/:id/posts", (c) => {
  const categoryId = c.req.param("id");
  const since = c.req.query("since");
  const limitParam = c.req.query("limit");
  const subscriberUrl = c.req.header("X-Zlog-Subscriber-Url");

  try {
    const posts = federationService.getCategoryPosts(categoryId, subscriberUrl, since, limitParam);
    return c.json(posts);
  } catch (err) {
    if (err instanceof Error && err.message === "ERR_SUBSCRIPTION_REVOKED") {
      return c.json({ error: err instanceof Error ? err.message : "Error" }, 403);
    }
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

federationRoute.get("/posts/:id", (c) => {
  const id = c.req.param("id");
  try {
    const post = federationService.getPost(id);
    return c.json(post);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Error" }, 404);
  }
});

federationRoute.post("/posts/:id/view", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json<{ visitorId?: string; subscriberUrl?: string }>().catch(() => null);

  if (!body?.visitorId || !body.subscriberUrl) {
    return c.json({ error: "Missing required fields." }, 400);
  }

  try {
    federationService.recordPostView(postId, body.visitorId, body.subscriberUrl);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized subscriber.") {
      return c.json({ error: err instanceof Error ? err.message : "Error" }, 403);
    }
    return c.json({ error: err instanceof Error ? err.message : "Error" }, 404);
  }
});

federationRoute.post("/subscribe", async (c) => {
  const body = await c.req.json<{
    categoryId: string;
    subscriberUrl: string;
    callbackUrl: string;
  }>();
  if (!body.categoryId || !body.subscriberUrl || !body.callbackUrl) {
    return c.json({ error: "Required fields are missing." }, 400);
  }

  try {
    const result = federationService.subscribe(
      body.categoryId,
      body.subscriberUrl,
      body.callbackUrl,
    );
    return c.json(result, result.message.includes("registered") ? 201 : 200);
  } catch (err) {
    if (err instanceof Error && err.message === "Category not found.")
      return c.json({ error: err instanceof Error ? err.message : "Error" }, 404);
    return c.json({ error: err instanceof Error ? err.message : "Error" }, 400);
  }
});

federationRoute.post("/unsubscribe", async (c) => {
  const body = await c.req.json<{ categoryId: string; subscriberUrl: string }>();
  try {
    federationService.unsubscribe(body.categoryId, body.subscriberUrl);
    return c.json({ message: "Subscription has been cancelled." });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Error" }, 404);
  }
});

federationRoute.post("/webhook", async (c) => {
  const body = await c.req.json<Partial<WebhookEvent>>();
  try {
    const result = await federationService.handleWebhook(body);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Error" }, 400);
  }
});

federationRoute.post("/local-subscribe", async (c) => {
  const body = await c.req.json<{
    remoteSiteUrl: string;
    remoteCategoryId: string;
    remoteCategoryName?: string;
    remoteCategorySlug?: string;
    localCategorySlug: string;
  }>();

  if (!body.remoteSiteUrl || !body.remoteCategoryId || !body.localCategorySlug) {
    return c.json({ error: "Required fields are missing." }, 400);
  }

  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  const mySiteUrl = (
    ownerRecord?.siteUrl ??
    process.env.SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  try {
    validateRemoteUrl(body.remoteSiteUrl, mySiteUrl);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid URL." }, 400);
  }

  // Find local category
  const localCat = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, body.localCategorySlug))
    .get();
  if (!localCat) return c.json({ error: "Local category not found." }, 404);

  // Find or create remoteBlog
  let remoteBlog = db
    .select()
    .from(schema.remoteBlogs)
    .where(eq(schema.remoteBlogs.siteUrl, body.remoteSiteUrl))
    .get();
  if (!remoteBlog) {
    const id = generateId();
    try {
      const infoRes = await fetch(`${body.remoteSiteUrl}/api/federation/info`);
      const info = (await infoRes.json()) as {
        displayName?: string;
        blogTitle?: string;
        avatarUrl?: string;
      };
      db.insert(schema.remoteBlogs)
        .values({
          id,
          siteUrl: body.remoteSiteUrl,
          displayName: info.displayName ?? null,
          blogTitle: info.blogTitle ?? null,
          avatarUrl: fixRemoteUrl(info.avatarUrl ?? null, body.remoteSiteUrl),
          createdAt: new Date().toISOString(),
        })
        .run();
    } catch {
      db.insert(schema.remoteBlogs)
        .values({ id, siteUrl: body.remoteSiteUrl, createdAt: new Date().toISOString() })
        .run();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    remoteBlog = db.select().from(schema.remoteBlogs).where(eq(schema.remoteBlogs.id, id)).get()!;
  }

  // Find or create remoteCategory
  let remoteCat = db
    .select()
    .from(schema.remoteCategories)
    .where(
      and(
        eq(schema.remoteCategories.remoteBlogId, remoteBlog.id),
        eq(schema.remoteCategories.remoteId, body.remoteCategoryId),
      ),
    )
    .get();
  if (!remoteCat) {
    const id = generateId();
    db.insert(schema.remoteCategories)
      .values({
        id,
        remoteBlogId: remoteBlog.id,
        remoteId: body.remoteCategoryId,
        name: body.remoteCategoryName ?? "Unknown",
        slug: body.remoteCategorySlug ?? "unknown",
        createdAt: new Date().toISOString(),
      })
      .run();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    remoteCat = db
      .select()
      .from(schema.remoteCategories)
      .where(eq(schema.remoteCategories.id, id))
      .get()!;
  }

  // Find or create categorySubscription
  const existingSub = db
    .select()
    .from(schema.categorySubscriptions)
    .where(
      and(
        eq(schema.categorySubscriptions.localCategoryId, localCat.id),
        eq(schema.categorySubscriptions.remoteCategoryId, remoteCat.id),
      ),
    )
    .get();
  if (existingSub) {
    db.update(schema.categorySubscriptions)
      .set({ isActive: true })
      .where(eq(schema.categorySubscriptions.id, existingSub.id))
      .run();
    // Restore localCategoryId for existing remotePosts
    db.update(schema.remotePosts)
      .set({ localCategoryId: localCat.id })
      .where(
        and(
          eq(schema.remotePosts.remoteCategoryId, remoteCat.id),
          eq(schema.remotePosts.remoteStatus, "published"),
        ),
      )
      .run();
    return c.json({
      message: "Subscription has been reactivated.",
      subscriptionId: existingSub.id,
    });
  }

  const subId = generateId();
  db.insert(schema.categorySubscriptions)
    .values({
      id: subId,
      localCategoryId: localCat.id,
      remoteCategoryId: remoteCat.id,
      createdAt: new Date().toISOString(),
    })
    .run();

  // Register as subscriber on remote blog (for webhook delivery — local subscription persists on failure)
  try {
    await fetch(`${body.remoteSiteUrl}/api/federation/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: body.remoteCategoryId,
        subscriberUrl: mySiteUrl,
        callbackUrl: `${mySiteUrl}/api/federation/webhook`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    console.warn(
      "⚠️ Failed to register as subscriber on remote blog (local subscription persisted)",
    );
  }

  return c.json({ message: "Local subscription registered.", subscriptionId: subId }, 201);
});

// ============ Local unsubscribe ============
federationRoute.post("/local-unsubscribe", async (c) => {
  const body = await c.req.json<{
    remoteSiteUrl: string;
    remoteCategoryId: string;
    localCategorySlug: string;
  }>();

  const localCat = db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, body.localCategorySlug))
    .get();
  if (!localCat) return c.json({ error: "Local category not found." }, 404);

  const remoteBlog = db
    .select()
    .from(schema.remoteBlogs)
    .where(eq(schema.remoteBlogs.siteUrl, body.remoteSiteUrl))
    .get();
  if (!remoteBlog) return c.json({ error: "Remote blog not found." }, 404);

  const remoteCat = db
    .select()
    .from(schema.remoteCategories)
    .where(
      and(
        eq(schema.remoteCategories.remoteBlogId, remoteBlog.id),
        eq(schema.remoteCategories.remoteId, body.remoteCategoryId),
      ),
    )
    .get();
  if (!remoteCat) return c.json({ error: "Remote category not found." }, 404);

  const sub = db
    .select()
    .from(schema.categorySubscriptions)
    .where(
      and(
        eq(schema.categorySubscriptions.localCategoryId, localCat.id),
        eq(schema.categorySubscriptions.remoteCategoryId, remoteCat.id),
      ),
    )
    .get();
  if (!sub) return c.json({ error: "Subscription not found." }, 404);

  db.update(schema.categorySubscriptions)
    .set({ isActive: false })
    .where(eq(schema.categorySubscriptions.id, sub.id))
    .run();
  return c.json({ message: "Local subscription cancelled." });
});

// ============ Remote post detail (real-time source status check) ============
federationRoute.get("/remote-posts/:id", async (c) => {
  const id = c.req.param("id");
  const rp = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.id, id)).get();
  if (!rp) return c.json({ error: "Post not found." }, 404);

  const remoteBlog = db
    .select()
    .from(schema.remoteBlogs)
    .where(eq(schema.remoteBlogs.id, rp.remoteBlogId))
    .get();

  const remoteBlogInfo = remoteBlog
    ? {
        siteUrl: remoteBlog.siteUrl,
        displayName: remoteBlog.displayName,
        blogTitle: remoteBlog.blogTitle,
        avatarUrl: fixRemoteUrl(remoteBlog.avatarUrl, remoteBlog.siteUrl),
      }
    : null;

  // Check latest status from source blog (background verification)
  if (remoteBlog && rp.remoteUri) {
    // remoteUri format: "https://blog.example.com/posts/{postId}"
    const uriParts = rp.remoteUri.split("/posts/");
    const remotePostId = uriParts.length > 1 ? uriParts[uriParts.length - 1] : null;
    if (remotePostId) {
      try {
        const res = await fetch(`${remoteBlog.siteUrl}/api/federation/posts/${remotePostId}`, {
          signal: AbortSignal.timeout(5000),
        });
        const now = new Date().toISOString();
        if (res.status === 404) {
          // Source deleted → update local status
          db.update(schema.remotePosts)
            .set({ remoteStatus: "deleted", fetchedAt: now })
            .where(eq(schema.remotePosts.id, id))
            .run();
          return c.json({
            ...rp,
            remoteStatus: "deleted",
            remoteBlog: remoteBlogInfo,
          });
        } else if (res.ok) {
          const original = (await res.json()) as {
            title: string;
            slug: string;
            content: string;
            excerpt?: string | null;
            coverImage?: string | null;
            updatedAt: string;
          };
          // If source was updated, refresh local cache
          if (original.updatedAt > rp.remoteUpdatedAt) {
            const fixedContent = fixRemoteContentUrls(original.content, remoteBlog.siteUrl);
            const fixedCover = fixRemoteUrl(original.coverImage ?? null, remoteBlog.siteUrl);
            db.update(schema.remotePosts)
              .set({
                title: original.title,
                slug: original.slug,
                content: fixedContent,
                excerpt: original.excerpt ?? null,
                coverImage: fixedCover,
                remoteUpdatedAt: original.updatedAt,
                fetchedAt: now,
              })
              .where(eq(schema.remotePosts.id, id))
              .run();
            // Respond with refreshed data
            const updated = db
              .select()
              .from(schema.remotePosts)
              .where(eq(schema.remotePosts.id, id))
              .get();
            return c.json({
              ...updated,
              remoteBlog: remoteBlogInfo,
            });
          }
        }
        // For other statuses (502, timeout, etc.), return existing cache as-is
      } catch {
        // Return existing cache on network error
      }
    }
  }

  if (rp.remoteStatus !== "published") return c.json({ error: "Post not found." }, 404);

  return c.json({
    ...rp,
    remoteBlog: remoteBlogInfo,
  });
});

// ============ Proxy: fetch remote comments ============
federationRoute.get("/remote-posts/:id/comments", async (c) => {
  const id = c.req.param("id");
  const pageStr = c.req.query("page");
  const rp = db.select().from(schema.remotePosts).where(eq(schema.remotePosts.id, id)).get();
  if (!rp) return c.json({ error: "Post not found." }, 404);

  const remoteBlog = db
    .select()
    .from(schema.remoteBlogs)
    .where(eq(schema.remoteBlogs.id, rp.remoteBlogId))
    .get();

  if (!remoteBlog || !rp.remoteUri) {
    return c.json({ error: "Remote blog information missing." }, 404);
  }

  // remoteUri format: "https://blog.example.com/posts/{postId}"
  const uriParts = rp.remoteUri.split("/posts/");
  const remotePostId = uriParts.length > 1 ? uriParts[uriParts.length - 1] : null;

  if (!remotePostId) {
    return c.json({ error: "Invalid remote URI." }, 400);
  }

  try {
    const url = new URL(`${remoteBlog.siteUrl}/api/posts/${remotePostId}/comments`);
    if (pageStr) url.searchParams.set("page", pageStr);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return c.json({ error: `Remote server returned ${res.status}` }, 502);
    }

    const comments = await res.json();
    return c.json(comments);
  } catch {
    return c.json({ error: "Failed to fetch remote comments." }, 502);
  }
});

// ============ Admin: proxy fetch remote blog categories ============
federationRoute.get("/remote-categories", authMiddleware, async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "url parameter is required." }, 400);

  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  const mySiteUrl = ownerRecord?.siteUrl ?? "";

  try {
    validateRemoteUrl(url, mySiteUrl);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid URL." }, 400);
  }

  const normalized = url.replace(/\/+$/, "");
  try {
    const res = await fetch(`${normalized}/api/federation/categories`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return c.json({ error: `Remote server error: ${res.status}` }, 502);
    const cats = await res.json();
    return c.json(cats);
  } catch {
    return c.json({ error: "Failed to connect to remote server." }, 502);
  }
});

// ============ Admin: list my subscribed categories ============
federationRoute.get("/subscriptions", authMiddleware, (c) => {
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
    .innerJoin(
      schema.categories,
      eq(schema.categorySubscriptions.localCategoryId, schema.categories.id),
    )
    .innerJoin(
      schema.remoteCategories,
      eq(schema.categorySubscriptions.remoteCategoryId, schema.remoteCategories.id),
    )
    .innerJoin(schema.remoteBlogs, eq(schema.remoteCategories.remoteBlogId, schema.remoteBlogs.id))
    .orderBy(desc(schema.categorySubscriptions.createdAt))
    .all();

  return c.json(subs);
});

// ============ Admin: manual sync subscription category ============
federationRoute.post("/subscriptions/:id/sync", authMiddleware, async (c) => {
  const id = c.req.param("id") ?? "";
  const sub = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.id, id))
    .get();
  if (!sub) return c.json({ error: "Subscription not found." }, 404);

  const remoteCat = db
    .select()
    .from(schema.remoteCategories)
    .where(eq(schema.remoteCategories.id, sub.remoteCategoryId))
    .get();
  if (!remoteCat) return c.json({ error: "Remote category not found." }, 404);

  const remoteBlog = db
    .select()
    .from(schema.remoteBlogs)
    .where(eq(schema.remoteBlogs.id, remoteCat.remoteBlogId))
    .get();
  if (!remoteBlog) return c.json({ error: "Remote blog not found." }, 404);

  try {
    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const mySiteUrl = (ownerRecord?.siteUrl ?? "").replace(/\/+$/, "");

    // Always fetch all posts to refresh image URLs etc.
    const postsUrl = `${remoteBlog.siteUrl}/api/federation/categories/${remoteCat.remoteId}/posts`;
    const res = await fetch(postsUrl, {
      headers: {
        "X-Zlog-Subscriber-Url": mySiteUrl,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 403) {
      // Subscription revoked by remote blog
      db.update(schema.categorySubscriptions)
        .set({ isActive: false })
        .where(eq(schema.categorySubscriptions.id, id))
        .run();

      // Mark all synced posts as unreachable
      db.update(schema.remotePosts)
        .set({ remoteStatus: "unreachable", fetchedAt: new Date().toISOString() })
        .where(eq(schema.remotePosts.remoteCategoryId, sub.remoteCategoryId))
        .run();

      return c.json({ error: "ERR_SUBSCRIPTION_REVOKED" }, 403);
    }

    if (!res.ok) return c.json({ error: `Remote server error: ${res.status}` }, 502);
    const posts = (await res.json()) as {
      id: string;
      title: string;
      slug: string;
      content: string;
      excerpt?: string;
      coverImage?: string;
      coverImageWidth?: number;
      coverImageHeight?: number;
      uri?: string;
      createdAt: string;
      updatedAt: string;
    }[];

    const now = new Date().toISOString();
    let synced = 0;

    // Batch-load existing remote posts by URI to avoid N+1 queries
    const remoteUris = posts.map((p) => {
      const rawUri = p.uri ?? `${remoteBlog.siteUrl}/posts/${p.id}`;
      return rawUri.replace(/^https?:\/\/[^/]+/, remoteBlog.siteUrl);
    });
    const existingMap = new Map<string, typeof schema.remotePosts.$inferSelect>();
    if (remoteUris.length > 0) {
      const rows = db
        .select()
        .from(schema.remotePosts)
        .where(inArray(schema.remotePosts.remoteUri, remoteUris))
        .all();
      for (const r of rows) existingMap.set(r.remoteUri, r);
    }

    for (const post of posts) {
      // URI domain may be wrong (e.g., http://localhost/posts/...) — replace with actual remoteBlog URL
      const rawUri = post.uri ?? `${remoteBlog.siteUrl}/posts/${post.id}`;
      const remoteUri = rawUri.replace(/^https?:\/\/[^/]+/, remoteBlog.siteUrl);
      const fixedContent = fixRemoteContentUrls(post.content, remoteBlog.siteUrl);
      const fixedCover = fixRemoteUrl(post.coverImage ?? null, remoteBlog.siteUrl);
      const existing = existingMap.get(remoteUri);
      if (existing) {
        db.update(schema.remotePosts)
          .set({
            title: post.title,
            slug: post.slug,
            content: fixedContent,
            excerpt: post.excerpt ?? null,
            coverImage: fixedCover,
            coverImageWidth: post.coverImageWidth ?? null,
            coverImageHeight: post.coverImageHeight ?? null,
            remoteStatus: "published",
            remoteUpdatedAt: post.updatedAt,
            fetchedAt: now,
            localCategoryId: sub.localCategoryId,
          })
          .where(eq(schema.remotePosts.id, existing.id))
          .run();
      } else {
        db.insert(schema.remotePosts)
          .values({
            id: generateId(),
            remoteUri,
            remoteBlogId: remoteBlog.id,
            remoteCategoryId: remoteCat.id,
            localCategoryId: sub.localCategoryId,
            title: post.title,
            slug: post.slug,
            content: fixedContent,
            excerpt: post.excerpt ?? null,
            coverImage: fixedCover,
            coverImageWidth: post.coverImageWidth ?? null,
            coverImageHeight: post.coverImageHeight ?? null,
            remoteStatus: "published",
            authorName: remoteBlog.displayName,
            remoteCreatedAt: post.createdAt,
            remoteUpdatedAt: post.updatedAt,
            fetchedAt: now,
          })
          .run();
      }
      synced++;
    }

    db.update(schema.categorySubscriptions)
      .set({ lastSyncedAt: now })
      .where(eq(schema.categorySubscriptions.id, id))
      .run();

    return c.json({
      message: `${synced} post(s) synced.`,
      syncedCount: synced,
      lastSyncedAt: now,
    });
  } catch (err) {
    console.error("❌ Manual sync failed:", err);
    return c.json({ error: "Failed to connect to remote server." }, 502);
  }
});

// ============ Admin: toggle subscription active/inactive ============
federationRoute.put("/subscriptions/:id/toggle", authMiddleware, (c) => {
  const id = c.req.param("id") ?? "";
  const existing = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.id, id))
    .get();
  if (!existing) return c.json({ error: "Subscription not found." }, 404);
  const newActive = !existing.isActive;
  db.update(schema.categorySubscriptions)
    .set({ isActive: newActive })
    .where(eq(schema.categorySubscriptions.id, id))
    .run();
  if (!newActive) {
    // On deactivation, set localCategoryId to null in remotePosts to remove from listing
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
    // On activation, restore localCategoryId in remotePosts
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
  return c.json({
    message: newActive ? "Subscription activated." : "Subscription deactivated.",
    isActive: newActive,
  });
});

// ============ Admin: delete subscription ============
federationRoute.delete("/subscriptions/:id", authMiddleware, (c) => {
  const id = c.req.param("id") ?? "";
  const existing = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.id, id))
    .get();
  if (!existing) return c.json({ error: "Subscription not found." }, 404);
  // Set localCategoryId to null in remotePosts
  db.update(schema.remotePosts)
    .set({ localCategoryId: null })
    .where(
      and(
        eq(schema.remotePosts.remoteCategoryId, existing.remoteCategoryId),
        eq(schema.remotePosts.localCategoryId, existing.localCategoryId),
      ),
    )
    .run();
  // Permanently delete subscription record
  db.delete(schema.categorySubscriptions).where(eq(schema.categorySubscriptions.id, id)).run();
  return c.json({ message: "Subscription deleted." });
});

// ============ Admin: list subscribers ============
federationRoute.get("/subscribers", authMiddleware, (c) => {
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

// ============ Admin: delete subscriber ============
federationRoute.delete("/subscribers/:id", authMiddleware, (c) => {
  const id = c.req.param("id") ?? "";
  const existing = db.select().from(schema.subscribers).where(eq(schema.subscribers.id, id)).get();
  if (!existing) return c.json({ error: "Subscription not found." }, 404);
  db.delete(schema.subscribers).where(eq(schema.subscribers.id, id)).run();
  return c.json({ message: "Subscriber deleted." });
});

export default federationRoute;
