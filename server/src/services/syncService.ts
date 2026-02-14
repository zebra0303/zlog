/**
 * 구독 동기화 서비스
 *
 * 서버 시작 시 1회 + 이후 주기적으로 모든 활성 구독을 pull 방식으로 동기화합니다.
 * webhook_sync_interval 설정값(분 단위)에 따라 간격이 정해집니다.
 */

import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../lib/uuid.js";
import { fixRemoteUrl, fixRemoteContentUrls } from "../lib/remoteUrl.js";

/**
 * 단일 구독의 글을 pull 동기화
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

  // lastSyncedAt 이후 글만 가져오기 (있으면)
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

  for (const post of posts) {
    const rawUri = post.uri ?? `${remoteBlog.siteUrl}/posts/${post.id}`;
    const remoteUri = rawUri.replace(/^https?:\/\/[^/]+/, remoteBlog.siteUrl);
    const fixedContent = fixRemoteContentUrls(post.content, remoteBlog.siteUrl);
    const fixedCover = fixRemoteUrl(post.coverImage ?? null, remoteBlog.siteUrl);

    const existing = db
      .select()
      .from(schema.remotePosts)
      .where(eq(schema.remotePosts.remoteUri, remoteUri))
      .get();

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
 * 모든 활성 구독을 동기화
 */
export async function syncAllSubscriptions(): Promise<void> {
  const subs = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.isActive, true))
    .all();

  if (subs.length === 0) return;

  console.log(`🔄 ${subs.length}개 구독 동기화 시작...`);
  let totalSynced = 0;

  for (const sub of subs) {
    try {
      const count = await syncSubscription(sub);
      totalSynced += count;
    } catch (err) {
      // 개별 구독 실패 시 다른 구독은 계속 진행
      const remoteCat = db
        .select()
        .from(schema.remoteCategories)
        .where(eq(schema.remoteCategories.id, sub.remoteCategoryId))
        .get();
      console.error(
        `⚠️ 구독 동기화 실패 (${remoteCat?.name ?? sub.id}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`✅ 동기화 완료: ${totalSynced}개 글 동기화됨`);

  // 동기화 후 GC 트리거 (fetch 응답, JSON 파싱 등 임시 객체 정리)
  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

// 최근 트리거된 구독 ID를 추적하여 중복 동기화 방지
const recentlyTriggered = new Set<string>();

/**
 * 게시글 목록 조회 시 stale한 구독을 백그라운드에서 동기화
 * - 마지막 동기화 이후 충분한 시간이 경과한 구독만 대상
 * - 동일 구독에 대한 중복 트리거 방지 (30초 쿨다운)
 */
export function triggerStaleSync(): void {
  const subs = db
    .select()
    .from(schema.categorySubscriptions)
    .where(eq(schema.categorySubscriptions.isActive, true))
    .all();

  if (subs.length === 0) return;

  const now = Date.now();
  // stale 기준: 마지막 동기화 이후 3분 이상 경과
  const staleThresholdMs = 3 * 60 * 1000;

  const staleSubs = subs.filter((sub) => {
    if (recentlyTriggered.has(sub.id)) return false;
    if (!sub.lastSyncedAt) return true;
    return now - new Date(sub.lastSyncedAt).getTime() > staleThresholdMs;
  });

  if (staleSubs.length === 0) return;

  // 중복 방지: 트리거된 구독 ID를 30초간 기록
  for (const sub of staleSubs) {
    recentlyTriggered.add(sub.id);
    setTimeout(() => recentlyTriggered.delete(sub.id), 30000);
  }

  // 비동기로 백그라운드 실행 (응답을 블로킹하지 않음)
  void (async () => {
    for (const sub of staleSubs) {
      try {
        await syncSubscription(sub);
      } catch {
        // 개별 실패 무시
      }
    }
  })();
}

/**
 * 백그라운드 동기화 워커 시작
 * - 서버 시작 5초 후 첫 동기화
 * - 이후 webhook_sync_interval(분) 간격으로 반복
 */
export function startSyncWorker(): void {
  const intervalSetting = db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "webhook_sync_interval"))
    .get();
  const intervalMinutes = Math.max(1, Number(intervalSetting?.value) || 15);
  const intervalMs = intervalMinutes * 60 * 1000;

  // 서버 시작 5초 후 첫 동기화 (부트스트랩 완료 대기)
  setTimeout(() => {
    void syncAllSubscriptions();
  }, 5000);

  // 주기적 동기화
  syncTimer = setInterval(() => {
    void syncAllSubscriptions();
  }, intervalMs);

  console.log(`🔄 백그라운드 동기화 워커 시작 (간격: ${intervalMinutes}분)`);
}

/**
 * 워커 정리 (테스트 등에서 사용)
 */
export function stopSyncWorker(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
