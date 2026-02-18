/**
 * Subscription sync service
 *
 * Syncs all active subscriptions via pull on server start (once) and periodically thereafter.
 * The interval is determined by the webhook_sync_interval setting (in minutes).
 */

import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { fixRemoteUrl, fixRemoteContentUrls } from "../lib/remoteUrl.js";

/**
 * Pull-sync posts for a single subscription
 */
export async function syncSubscription(
  sub: typeof schema.categorySubscriptions.$inferSelect,
): Promise<number> {
  const remoteCat = db
    .select()
    .from(schema.remoteCategories)
    .where(eq(schema.remoteCategories.id, sub.remoteCategoryId))
    .get();
  if (!remoteCat) return 0;

  const remoteBlog = db
    .select()
    .from(schema.remoteBlogs)
    .where(eq(schema.remoteBlogs.id, remoteCat.remoteBlogId))
    .get();
  if (!remoteBlog) return 0;

  // Only fetch posts after lastSyncedAt (if available)
  let postsUrl = `${remoteBlog.siteUrl}/api/federation/categories/${remoteCat.remoteId}/posts`;
  if (sub.lastSyncedAt) {
    postsUrl += `?since=${encodeURIComponent(sub.lastSyncedAt)}`;
  }

  const res = await fetch(postsUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return 0;

  const posts = (await res.json()) as {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    coverImage?: string;
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
    .where(eq(schema.categorySubscriptions.id, sub.id))
    .run();

  return synced;
}

/**
 * Sync all active subscriptions
 */
export async function syncAllSubscriptions(): Promise<void> {
  const subs = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.isActive, true))
    .all();

  if (subs.length === 0) return;

  console.log(`🔄 Starting sync for ${subs.length} subscription(s)...`);
  let totalSynced = 0;

  for (const sub of subs) {
    try {
      const count = await syncSubscription(sub);
      totalSynced += count;
    } catch (err) {
      // On individual subscription failure, continue with the rest
      const remoteCat = db
        .select()
        .from(schema.remoteCategories)
        .where(eq(schema.remoteCategories.id, sub.remoteCategoryId))
        .get();
      console.error(
        `⚠️ Subscription sync failed (${remoteCat?.name ?? sub.id}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`✅ Sync complete: ${totalSynced} post(s) synced`);

  // Trigger GC after sync (clean up temporary objects from fetch responses, JSON parsing, etc.)
  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

// Track recently triggered subscription IDs to prevent duplicate syncs
const recentlyTriggered = new Set<string>();

/**
 * Background-sync stale subscriptions when post lists are queried
 * - Only targets subscriptions where enough time has passed since last sync
 * - Prevents duplicate triggers for the same subscription (30-second cooldown)
 */
export function triggerStaleSync(): void {
  const subs = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.isActive, true))
    .all();

  if (subs.length === 0) return;

  const now = Date.now();
  // Stale threshold: more than 3 minutes since last sync
  const staleThresholdMs = 3 * 60 * 1000;

  const staleSubs = subs.filter((sub) => {
    if (recentlyTriggered.has(sub.id)) return false;
    if (!sub.lastSyncedAt) return true;
    return now - new Date(sub.lastSyncedAt).getTime() > staleThresholdMs;
  });

  if (staleSubs.length === 0) return;

  // Dedup: record triggered subscription IDs for 30 seconds
  for (const sub of staleSubs) {
    recentlyTriggered.add(sub.id);
    setTimeout(() => recentlyTriggered.delete(sub.id), 30000);
  }

  // Run asynchronously in the background (non-blocking)
  void (async () => {
    for (const sub of staleSubs) {
      try {
        await syncSubscription(sub);
      } catch {
        // Ignore individual failures
      }
    }
  })();
}

/**
 * Start background sync worker
 * - First sync 5 seconds after server start
 * - Then repeats at webhook_sync_interval (minutes) intervals
 */
export function startSyncWorker(): void {
  const intervalSetting = db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "webhook_sync_interval"))
    .get();
  const intervalMinutes = Math.max(1, Number(intervalSetting?.value) || 15);
  const intervalMs = intervalMinutes * 60 * 1000;

  // First sync 5 seconds after start (wait for bootstrap to complete)
  setTimeout(() => {
    void syncAllSubscriptions();
  }, 5000);

  // Periodic sync
  syncTimer = setInterval(() => {
    void syncAllSubscriptions();
  }, intervalMs);

  console.log(`🔄 Background sync worker started (interval: ${intervalMinutes}min)`);
}

/**
 * Clean up worker (used in tests, etc.)
 */
export function stopSyncWorker(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
