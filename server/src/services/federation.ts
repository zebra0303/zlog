import { db, analyticsDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import * as analyticsSchema from "../db/schema/analytics.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { fixRemoteUrl, fixRemoteContentUrls, validateRemoteUrl } from "../lib/remoteUrl.js";
import type { WebhookEvent } from "@zlog/shared";
import { getT } from "../lib/i18n/index.js";

const FEDERATION_POST_LIMIT = 200;

export class FederationService {
  resolveRelativeUrls(content: string, siteUrl: string): string {
    return content.replace(/(!\[.*?\]\()(\/\/(uploads|img)\/[^)]+\))/g, `$1${siteUrl}$2`);
  }

  resolveUrl(url: string | null, siteUrl: string): string | null {
    if (!url) return url;
    return url.startsWith("/") ? siteUrl + url : url;
  }

  getBlogInfo() {
    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    if (!ownerRecord) throw new Error("Blog information not found.");

    const siteUrl = ownerRecord.siteUrl;
    const avatarAbsoluteUrl = ownerRecord.avatarUrl?.startsWith("/")
      ? `${siteUrl}${ownerRecord.avatarUrl}`
      : ownerRecord.avatarUrl;

    return {
      siteUrl,
      displayName: ownerRecord.displayName,
      blogTitle: ownerRecord.blogTitle,
      blogDescription: ownerRecord.blogDescription,
      avatarUrl: avatarAbsoluteUrl,
      blogHandle: ownerRecord.blogHandle,
    };
  }

  getPublicCategories() {
    const cats = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.isPublic, true))
      .all();
    return cats.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
    }));
  }

  getCategoryPosts(
    categoryId: string,
    subscriberUrl?: string,
    since?: string,
    limitParam?: string,
  ) {
    const limit = Math.min(
      Math.max(1, parseInt(limitParam ?? "", 10) || FEDERATION_POST_LIMIT),
      FEDERATION_POST_LIMIT,
    );

    if (subscriberUrl) {
      const cleanSubscriberUrl = subscriberUrl.replace(/\/+$/, "");
      const isSubscribed = db
        .select()
        .from(schema.subscribers)
        .where(
          and(
            eq(schema.subscribers.categoryId, categoryId),
            eq(schema.subscribers.subscriberUrl, cleanSubscriberUrl),
            eq(schema.subscribers.isActive, true),
          ),
        )
        .get();

      if (!isSubscribed) {
        throw new Error("ERR_SUBSCRIPTION_REVOKED");
      }
    }

    const conditions = and(
      eq(schema.posts.categoryId, categoryId),
      eq(schema.posts.status, "published"),
    );

    const postsResult = since
      ? db
          .select()
          .from(schema.posts)
          .where(and(conditions, gt(schema.posts.updatedAt, since)))
          .orderBy(desc(schema.posts.createdAt))
          .limit(limit)
          .all()
      : db
          .select()
          .from(schema.posts)
          .where(conditions)
          .orderBy(desc(schema.posts.createdAt))
          .limit(limit)
          .all();

    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const siteUrl = ownerRecord?.siteUrl ?? "";

    return postsResult.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: this.resolveRelativeUrls(post.content, siteUrl),
      excerpt: post.excerpt,
      coverImage: this.resolveUrl(post.coverImage, siteUrl),
      coverImageWidth: post.coverImageWidth,
      coverImageHeight: post.coverImageHeight,
      uri: `${siteUrl}/posts/${post.id}`,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: ownerRecord?.displayName ?? "",
    }));
  }

  getPost(id: string) {
    const post = db
      .select()
      .from(schema.posts)
      .where(and(eq(schema.posts.id, id), eq(schema.posts.status, "published")))
      .get();

    if (!post) throw new Error("Post not found.");

    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const siteUrl = ownerRecord?.siteUrl ?? "";

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: this.resolveRelativeUrls(post.content, siteUrl),
      excerpt: post.excerpt,
      coverImage: this.resolveUrl(post.coverImage, siteUrl),
      coverImageWidth: post.coverImageWidth,
      coverImageHeight: post.coverImageHeight,
      uri: `${siteUrl}/posts/${post.id}`,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: ownerRecord?.displayName ?? "",
    };
  }

  recordPostView(postId: string, visitorId: string, subscriberUrl: string) {
    const cleanSubscriberUrl = subscriberUrl.replace(/\/+$/, "");

    const post = db.select().from(schema.posts).where(eq(schema.posts.id, postId)).get();
    if (post?.status !== "published" || !post.categoryId) {
      throw new Error("Post not found.");
    }

    const isSubscribed = db
      .select()
      .from(schema.subscribers)
      .where(
        and(
          eq(schema.subscribers.categoryId, post.categoryId),
          eq(schema.subscribers.subscriberUrl, cleanSubscriberUrl),
          eq(schema.subscribers.isActive, true),
        ),
      )
      .get();

    if (!isSubscribed) {
      throw new Error("Unauthorized subscriber.");
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const existingLog = analyticsDb
      .select()
      .from(analyticsSchema.postAccessLogs)
      .where(
        and(
          eq(analyticsSchema.postAccessLogs.postId, postId),
          eq(analyticsSchema.postAccessLogs.ip, "federation"),
          eq(analyticsSchema.postAccessLogs.referer, cleanSubscriberUrl),
          eq(analyticsSchema.postAccessLogs.userAgent, visitorId),
          gt(analyticsSchema.postAccessLogs.createdAt, dayAgo),
        ),
      )
      .get();

    if (!existingLog) {
      db.update(schema.posts)
        .set({ viewCount: post.viewCount + 1 })
        .where(eq(schema.posts.id, postId))
        .run();

      analyticsDb
        .insert(analyticsSchema.postAccessLogs)
        .values({
          id: generateId(),
          postId,
          ip: "federation",
          referer: cleanSubscriberUrl,
          userAgent: visitorId,
          createdAt: now.toISOString(),
        })
        .run();
    }
  }

  subscribe(categoryId: string, subscriberUrl: string, callbackUrl: string) {
    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const mySiteUrl = ownerRecord?.siteUrl ?? "";

    validateRemoteUrl(subscriberUrl, mySiteUrl);
    validateRemoteUrl(callbackUrl, mySiteUrl);

    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, categoryId))
      .get();
    if (!cat?.isPublic) throw new Error("Category not found.");

    const webhookUrl = db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, "notification_slack_webhook"))
      .get()?.value;

    const existing = db
      .select()
      .from(schema.subscribers)
      .where(
        and(
          eq(schema.subscribers.categoryId, categoryId),
          eq(schema.subscribers.subscriberUrl, subscriberUrl),
        ),
      )
      .get();

    if (existing) {
      db.update(schema.subscribers)
        .set({ isActive: true, callbackUrl })
        .where(eq(schema.subscribers.id, existing.id))
        .run();

      if (webhookUrl) {
        this.sendSlackNotification(webhookUrl, cat.name, subscriberUrl, "reactivated");
      }

      return { message: "Subscription has been reactivated.", id: existing.id };
    }

    const id = generateId();
    db.insert(schema.subscribers)
      .values({
        id,
        categoryId,
        subscriberUrl: subscriberUrl.replace(/\/+$/, ""),
        callbackUrl,
        createdAt: new Date().toISOString(),
      })
      .run();

    if (webhookUrl) {
      this.sendSlackNotification(webhookUrl, cat.name, subscriberUrl, "new");
    }

    return { message: "Subscription has been registered.", id };
  }

  unsubscribe(categoryId: string, subscriberUrl: string) {
    const existing = db
      .select()
      .from(schema.subscribers)
      .where(
        and(
          eq(schema.subscribers.categoryId, categoryId),
          eq(schema.subscribers.subscriberUrl, subscriberUrl),
        ),
      )
      .get();
    if (!existing) throw new Error("Subscription not found.");
    db.update(schema.subscribers)
      .set({ isActive: false })
      .where(eq(schema.subscribers.id, existing.id))
      .run();
  }

  private sendSlackNotification(
    webhookUrl: string,
    categoryName: string,
    subscriberUrl: string,
    type: "new" | "reactivated",
  ) {
    const lang =
      db
        .select()
        .from(schema.siteSettings)
        .where(eq(schema.siteSettings.key, "default_language"))
        .get()?.value ?? "ko";
    const t = getT(lang);

    const titleKey =
      type === "new" ? "slack_new_federation_subscriber" : "slack_federation_reactivated";
    const lines = [
      t(titleKey),
      t("slack_category", { categoryName }),
      t("slack_subscriber_url", { url: subscriberUrl }),
    ];

    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    }).catch(() => null);
  }

  async handleWebhook(body: Partial<WebhookEvent>) {
    if (!body.event || !body.post || !body.categoryId || !body.siteUrl) {
      throw new Error("Invalid webhook data.");
    }

    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const mySiteUrl = ownerRecord?.siteUrl ?? "";

    validateRemoteUrl(body.siteUrl, mySiteUrl);

    let remoteBlog = db
      .select()
      .from(schema.remoteBlogs)
      .where(eq(schema.remoteBlogs.siteUrl, body.siteUrl))
      .get();

    if (!remoteBlog) {
      try {
        const infoRes = await fetch(`${body.siteUrl}/api/federation/info`, {
          signal: AbortSignal.timeout(10000),
        });
        const info = (await infoRes.json()) as {
          displayName?: string;
          blogTitle?: string;
          avatarUrl?: string;
        };
        const id = generateId();
        db.insert(schema.remoteBlogs)
          .values({
            id,
            siteUrl: body.siteUrl,
            displayName: info.displayName ?? null,
            blogTitle: info.blogTitle ?? null,
            avatarUrl: fixRemoteUrl(info.avatarUrl ?? null, body.siteUrl),
            createdAt: new Date().toISOString(),
          })
          .run();
        remoteBlog = db
          .select()
          .from(schema.remoteBlogs)
          .where(eq(schema.remoteBlogs.id, id))
          .get() as {
          id: string;
          siteUrl: string;
          displayName: string | null;
          blogTitle: string | null;
          avatarUrl: string | null;
          lastFetchedAt: string | null;
          createdAt: string;
          remoteBlogId: string;
          remoteId: string;
          name: string;
          slug: string;
          description: string | null;
        };
      } catch {
        throw new Error("Failed to register remote blog.");
      }
    }

    let remoteCat = db
      .select()
      .from(schema.remoteCategories)
      .where(
        and(
          eq(schema.remoteCategories.remoteBlogId, remoteBlog.id),
          eq(schema.remoteCategories.remoteId, body.categoryId),
        ),
      )
      .get();

    if (!remoteCat) {
      try {
        const catsRes = await fetch(`${body.siteUrl}/api/federation/categories`, {
          signal: AbortSignal.timeout(10000),
        });
        const cats = (await catsRes.json()) as { id: string; name: string }[];
        const targetCat = cats.find((c) => c.id === body.categoryId);
        const name = targetCat?.name ?? "Unknown Category";

        const id = generateId();
        const slug =
          name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + generateId().substring(0, 4);
        db.insert(schema.remoteCategories)
          .values({
            id,
            remoteBlogId: remoteBlog.id,
            remoteId: body.categoryId,
            name,
            slug,
            createdAt: new Date().toISOString(),
          })
          .run();
        remoteCat = db
          .select()
          .from(schema.remoteCategories)
          .where(eq(schema.remoteCategories.id, id))
          .get() as {
          id: string;
          siteUrl: string;
          displayName: string | null;
          blogTitle: string | null;
          avatarUrl: string | null;
          lastFetchedAt: string | null;
          createdAt: string;
          remoteBlogId: string;
          remoteId: string;
          name: string;
          slug: string;
          description: string | null;
        };
      } catch {
        throw new Error("Failed to register remote category.");
      }
    }

    const { event, post } = body;
    const now = new Date().toISOString();
    const remoteUri = `${body.siteUrl}/posts/${post.id}`;

    if (event === "post.published" || event === "post.updated") {
      const existingPost = db
        .select()
        .from(schema.remotePosts)
        .where(eq(schema.remotePosts.remoteUri, remoteUri))
        .get();

      if (existingPost) {
        if (existingPost.remoteUpdatedAt === post.updatedAt && event === "post.published") {
          return { message: "Already processed" };
        }
        db.update(schema.remotePosts)
          .set({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? "",
            content: fixRemoteContentUrls(post.content, body.siteUrl),
            coverImage: fixRemoteUrl(post.coverImage ?? null, body.siteUrl),
            coverImageWidth: post.coverImageWidth,
            coverImageHeight: post.coverImageHeight,
            remoteUpdatedAt: post.updatedAt,
            fetchedAt: now,
          })
          .where(eq(schema.remotePosts.id, existingPost.id))
          .run();
      } else {
        const sub = db
          .select()
          .from(schema.categorySubscriptions)
          .where(eq(schema.categorySubscriptions.remoteCategoryId, remoteCat.id))
          .get();

        db.insert(schema.remotePosts)
          .values({
            id: generateId(),
            remoteBlogId: remoteBlog.id,
            remoteCategoryId: remoteCat.id,
            localCategoryId: sub?.localCategoryId ?? null,
            remoteUri,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? "",
            content: fixRemoteContentUrls(post.content, body.siteUrl),
            coverImage: fixRemoteUrl(post.coverImage ?? null, body.siteUrl),
            coverImageWidth: post.coverImageWidth,
            coverImageHeight: post.coverImageHeight,
            remoteCreatedAt: post.createdAt,
            remoteUpdatedAt: post.updatedAt,
            fetchedAt: now,
          })
          .run();
      }
    } else if (event === "post.deleted") {
      db.delete(schema.remotePosts).where(eq(schema.remotePosts.remoteUri, remoteUri)).run();
    }

    return { success: true };
  }

  async localSubscribe(targetUrl: string, localCategoryId: string) {
    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const mySiteUrl = ownerRecord?.siteUrl ?? "";

    if (!mySiteUrl) throw new Error("Local site URL not configured.");

    const cleanTargetUrl = targetUrl.replace(/\/+$/, "");
    validateRemoteUrl(cleanTargetUrl, mySiteUrl);

    let remoteBlog = db
      .select()
      .from(schema.remoteBlogs)
      .where(eq(schema.remoteBlogs.siteUrl, cleanTargetUrl))
      .get();

    if (!remoteBlog) {
      try {
        const infoRes = await fetch(`${cleanTargetUrl}/api/federation/info`, {
          signal: AbortSignal.timeout(10000),
        });
        const info = (await infoRes.json()) as {
          displayName?: string;
          blogTitle?: string;
          avatarUrl?: string;
        };

        const id = generateId();
        db.insert(schema.remoteBlogs)
          .values({
            id,
            siteUrl: cleanTargetUrl,
            displayName: info.displayName ?? null,
            blogTitle: info.blogTitle ?? null,
            avatarUrl: fixRemoteUrl(info.avatarUrl ?? null, cleanTargetUrl),
            createdAt: new Date().toISOString(),
          })
          .run();
        remoteBlog = db
          .select()
          .from(schema.remoteBlogs)
          .where(eq(schema.remoteBlogs.id, id))
          .get() as {
          id: string;
          siteUrl: string;
          displayName: string | null;
          blogTitle: string | null;
          avatarUrl: string | null;
          lastFetchedAt: string | null;
          createdAt: string;
          remoteBlogId: string;
          remoteId: string;
          name: string;
          slug: string;
          description: string | null;
        };
      } catch {
        throw new Error(`Failed to fetch info from remote blog. (${err})`);
      }
    }

    let remoteCat = db
      .select()
      .from(schema.remoteCategories)
      .where(
        and(
          eq(schema.remoteCategories.remoteBlogId, remoteBlog.id),
          eq(schema.remoteCategories.remoteId, localCategoryId),
        ),
      )
      .get();

    if (!remoteCat) {
      try {
        const catsRes = await fetch(`${cleanTargetUrl}/api/federation/categories`, {
          signal: AbortSignal.timeout(10000),
        });
        const cats = (await catsRes.json()) as { id: string; name: string }[];
        const targetCatInfo = cats.find((c) => c.id === localCategoryId);
        if (!targetCatInfo) {
          throw new Error("Category not found on remote blog.");
        }

        const id = generateId();
        const slug =
          targetCatInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
          "-" +
          generateId().substring(0, 4);
        db.insert(schema.remoteCategories)
          .values({
            id,
            remoteBlogId: remoteBlog.id,
            remoteId: localCategoryId,
            name: targetCatInfo.name,
            slug,
            createdAt: new Date().toISOString(),
          })
          .run();
        remoteCat = db
          .select()
          .from(schema.remoteCategories)
          .where(eq(schema.remoteCategories.id, id))
          .get() as {
          id: string;
          siteUrl: string;
          displayName: string | null;
          blogTitle: string | null;
          avatarUrl: string | null;
          lastFetchedAt: string | null;
          createdAt: string;
          remoteBlogId: string;
          remoteId: string;
          name: string;
          slug: string;
          description: string | null;
        };
      } catch {
        throw new Error(`Failed to fetch categories from remote blog. (${err})`);
      }
    }

    const sub = db
      .select()
      .from(schema.categorySubscriptions)
      .where(
        and(
          eq(schema.categorySubscriptions.remoteCategoryId, remoteCat.id),
          eq(schema.categorySubscriptions.localCategoryId, localCategoryId),
        ),
      )
      .get();

    if (sub) {
      if (sub.isActive) {
        throw new Error("Already subscribed to this category.");
      }
      db.update(schema.categorySubscriptions)
        .set({ isActive: true })
        .where(eq(schema.categorySubscriptions.id, sub.id))
        .run();
    } else {
      db.insert(schema.categorySubscriptions)
        .values({
          id: generateId(),
          remoteCategoryId: remoteCat.id,
          localCategoryId,
          isActive: true,
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    try {
      const webhookUrl = `${mySiteUrl}/api/federation/webhook`;
      const res = await fetch(`${cleanTargetUrl}/api/federation/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: localCategoryId,
          subscriberUrl: mySiteUrl,
          callbackUrl: webhookUrl,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`Remote subscribe failed: ${res.status} ${res.statusText}`);
      }
    } catch {
      throw new Error(`Failed to register webhook with remote blog. (${err})`);
    }
  }

  async localUnsubscribe(subscriptionId: string) {
    const ownerRecord = db.select().from(schema.owner).limit(1).get();
    const mySiteUrl = ownerRecord?.siteUrl ?? "";

    const sub = db
      .select({
        id: schema.categorySubscriptions.id,
        remoteCategoryId: schema.remoteCategories.remoteId,
        siteUrl: schema.remoteBlogs.siteUrl,
      })
      .from(schema.categorySubscriptions)
      .innerJoin(
        schema.remoteCategories,
        eq(schema.categorySubscriptions.remoteCategoryId, schema.remoteCategories.id),
      )
      .innerJoin(
        schema.remoteBlogs,
        eq(schema.remoteCategories.remoteBlogId, schema.remoteBlogs.id),
      )
      .where(eq(schema.categorySubscriptions.id, subscriptionId))
      .get();

    if (!sub) throw new Error("Subscription not found.");

    db.update(schema.categorySubscriptions)
      .set({ isActive: false })
      .where(eq(schema.categorySubscriptions.id, subscriptionId))
      .run();

    try {
      await fetch(`${sub.siteUrl}/api/federation/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: sub.remoteCategoryId,
          subscriberUrl: mySiteUrl,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      console.warn(`Failed to notify remote blog of unsubscription: ${err}`);
    }
  }
}

export const federationService = new FederationService();
