import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { WebhookEvent } from "@zlog/shared";

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

  const ownerRecord = db.select().from(schema.owner).limit(1).get();
  const siteUrl = ownerRecord?.siteUrl ?? process.env.SITE_URL ?? "http://localhost:3000";

  const payload: WebhookEvent = {
    event,
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      coverImageWidth: post.coverImageWidth,
      coverImageHeight: post.coverImageHeight,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
    categoryId,
    siteUrl,
  };

  for (const sub of subs) {
    try {
      await fetch(sub.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`❌ Webhook delivery failed (${sub.callbackUrl}):`, err);
    }
  }
}
