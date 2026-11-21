import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { WebhookEvent } from "@zlog/shared";
import { fixRemoteContentUrls, fixRemoteUrl, safeOutboundFetch } from "../lib/remoteUrl.js";

export async function sendWebhookToSubscribers(
  event: WebhookEvent["event"],
  post: typeof schema.posts.$inferSelect,
  categoryId: string,
) {
  const subs = db
    .select()
    .from(schema.subscribers)
    .where(
      and(eq(schema.subscribers.categoryId, categoryId), eq(schema.subscribers.isActive, true)),
    )
    .all();

  if (subs.length === 0) return;

  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  const siteUrl = (ownerRecord?.siteUrl ?? process.env.SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

  // Resolve relative image URLs to absolute URLs before delivering to remote subscribers
  const payload: WebhookEvent = {
    event,
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: fixRemoteContentUrls(post.content, siteUrl),
      excerpt: post.excerpt,
      coverImage: fixRemoteUrl(post.coverImage, siteUrl),
      coverImageWidth: post.coverImageWidth,
      coverImageHeight: post.coverImageHeight,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
    categoryId,
    siteUrl,
  };

  // Deliver webhooks concurrently with SSRF validation so one slow subscriber cannot stall others
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await safeOutboundFetch(
          sub.callbackUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          },
          siteUrl,
        );
      } catch (err) {
        console.error(`❌ Webhook delivery failed (${sub.callbackUrl}):`, err);
      }
    }),
  );
}
