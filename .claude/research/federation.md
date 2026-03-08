# zlog Federation Subscription System — Complete Technical Reference

**Date:** 2026-03-08 (updated)
**Scope:** Exhaustive line-by-line analysis of all federation subscription logic across server and client

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema (5 Tables)](#2-database-schema)
3. [Shared Type Definitions](#3-shared-type-definitions)
4. [URL Security & Validation](#4-url-security--validation)
5. [Subscription Lifecycle — Step-by-Step](#5-subscription-lifecycle)
6. [Push Model — Webhook Delivery](#6-push-model--webhook-delivery)
7. [Pull Model — SyncService](#7-pull-model--syncservice)
8. [Combined Feed — How Posts Appear](#8-combined-feed--how-posts-appear)
9. [Remote Post Detail — Real-time Verification](#9-remote-post-detail--real-time-verification)
10. [Remote Comment Proxying](#10-remote-comment-proxying)
11. [Federated View Count Tracking](#11-federated-view-count-tracking)
12. [Subscription Toggle & Deletion](#12-subscription-toggle--deletion)
13. [Inbound Subscribers (Others Following You)](#13-inbound-subscribers)
14. [Client-Side UI Components](#14-client-side-ui-components)
15. [Error Handling & Edge Cases](#15-error-handling--edge-cases)
16. [Performance Optimizations](#16-performance-optimizations)
17. [Complete API Endpoint Reference](#17-complete-api-endpoint-reference)
18. [Sequence Diagrams](#18-sequence-diagrams)

---

## 1. System Overview

The zlog federation system enables peer-to-peer blog networking through a **Subscribe-and-Push** protocol. Each zlog instance operates as both a **publisher** (serving content to subscribers) and a **consumer** (subscribing to remote blogs).

**Architecture:** Hybrid Push + Pull

- **Push (Webhooks):** Real-time content delivery on publish/update/delete events
- **Pull (SyncService):** Periodic background sync + on-demand stale sync

**Key Design Principles:**

- No central server — fully decentralized
- Content cached locally (survives remote downtime)
- Image URLs automatically rewritten for correct rendering
- Comments proxied in real-time (never stored locally)
- SSRF prevention blocks internal network access

**Source Files:**
| File | Role |
|------|------|
| `server/src/routes/federation.ts` (1170 lines) | All federation API endpoints |
| `server/src/services/syncService.ts` (~280 lines) | Background pull-sync worker |
| `server/src/services/feedService.ts` (~50 lines) | Webhook push delivery |
| `server/src/db/schema/federation.ts` | 5 table definitions |
| `server/src/lib/remoteUrl.ts` | URL validation & rewriting |
| `shared/types/index.ts` | Shared TypeScript interfaces |
| `client/src/pages/admin/ui/SubscriptionManager.tsx` | Subscription management UI |
| `client/src/pages/admin/ui/SubscriberManager.tsx` | Inbound subscriber UI |
| `client/src/pages/remote-post-detail/ui/RemotePostDetailPage.tsx` | Remote post viewer |
| `client/src/pages/remote-post-detail/ui/RemoteCommentList.tsx` | Proxied comments UI |

---

## 2. Database Schema

### 2.1 `remote_blogs` — Remote Blog Profile Cache

```sql
CREATE TABLE remote_blogs (
  id           TEXT PRIMARY KEY,
  site_url     TEXT NOT NULL UNIQUE,  -- Canonical URL of remote blog
  display_name TEXT,                  -- Owner's display name
  blog_title   TEXT,                  -- Blog title
  avatar_url   TEXT,                  -- Avatar (absolute URL after fixRemoteUrl)
  last_fetched_at TEXT,               -- Last metadata refresh timestamp
  created_at   TEXT NOT NULL
);
```

**Purpose:** Caches identity information from remote blogs. Created during subscription or webhook receipt. Used to display attribution on remote posts.

**Population:**

- On `POST /local-subscribe` — fetches `GET /api/federation/info` from remote
- On `POST /webhook` — auto-creates if unknown `siteUrl` in webhook payload
- Avatar URL is converted to absolute via `fixRemoteUrl(info.avatarUrl, remoteSiteUrl)`

### 2.2 `remote_categories` — Remote Category Cache

```sql
CREATE TABLE remote_categories (
  id             TEXT PRIMARY KEY,
  remote_blog_id TEXT NOT NULL REFERENCES remote_blogs(id) ON DELETE CASCADE,
  remote_id      TEXT NOT NULL,       -- The category ID on the remote server
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  description    TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_remote_categories_blog ON remote_categories(remote_blog_id);
```

**Purpose:** Maps remote category IDs to local records. `remote_id` is the actual category primary key on the remote server.

**Population:**

- On `POST /local-subscribe` — uses name/slug from client request body
- On `POST /webhook` — auto-creates with name="Unknown", slug="unknown" if missing

### 2.3 `category_subscriptions` — Subscription Mapping

```sql
CREATE TABLE category_subscriptions (
  id                  TEXT PRIMARY KEY,
  local_category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  remote_category_id  TEXT NOT NULL REFERENCES remote_categories(id) ON DELETE CASCADE,
  is_active           INTEGER NOT NULL DEFAULT 1,  -- Boolean
  last_synced_at      TEXT,                         -- ISO timestamp of last successful pull sync
  created_at          TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_cat_sub_unique ON category_subscriptions(local_category_id, remote_category_id);
```

**Purpose:** The core subscription record. Links a local category to a remote category. `is_active` controls whether posts appear in the combined feed and whether sync runs.

**Key behaviors:**

- `last_synced_at` is used as `?since=` parameter for incremental pull sync
- When `is_active` is set to `false`, all linked `remote_posts.local_category_id` are set to `null` (hides from feed)
- When `is_active` is restored to `true`, published `remote_posts.local_category_id` is restored
- Unique constraint prevents duplicate subscriptions to the same remote category from the same local category

### 2.4 `remote_posts` — Federated Post Cache

```sql
CREATE TABLE remote_posts (
  id                  TEXT PRIMARY KEY,
  remote_uri          TEXT NOT NULL UNIQUE,  -- Canonical URL: "{siteUrl}/posts/{postId}"
  remote_blog_id      TEXT NOT NULL REFERENCES remote_blogs(id) ON DELETE CASCADE,
  remote_category_id  TEXT NOT NULL REFERENCES remote_categories(id) ON DELETE CASCADE,
  local_category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL,
  content             TEXT NOT NULL,         -- Full markdown with fixed image URLs
  excerpt             TEXT,
  cover_image         TEXT,                  -- Absolute URL after fixRemoteUrl
  cover_image_width   INTEGER,
  cover_image_height  INTEGER,
  remote_status       TEXT NOT NULL DEFAULT 'published',  -- published|draft|deleted|unreachable
  author_name         TEXT,                  -- From remote_blogs.display_name
  remote_created_at   TEXT NOT NULL,
  remote_updated_at   TEXT NOT NULL,
  fetched_at          TEXT NOT NULL           -- When this record was last updated locally
);
CREATE INDEX idx_remote_posts_feed ON remote_posts(remote_status, local_category_id, remote_created_at);
```

**Purpose:** Local cache of posts from subscribed blogs. The `local_category_id` determines whether a post appears in the combined feed (null = hidden).

**Status transitions:**

- `published` → Normal, visible in feed
- `deleted` → Remote owner deleted the post (via webhook or real-time check)
- `unreachable` → Subscription was revoked (403 from remote)
- `draft` → Not used in practice (remote only publishes published posts)

**Key fields:**

- `remote_uri` is always normalized to `{remoteBlog.siteUrl}/posts/{postId}` (domain part replaced to handle localhost/production mismatches)
- `content` has all image URLs rewritten via `fixRemoteContentUrls()`
- `cover_image` has URL rewritten via `fixRemoteUrl()`
- `cover_image_width/height` stored for CLS prevention

### 2.5 `subscribers` — Inbound Subscribers

```sql
CREATE TABLE subscribers (
  id             TEXT PRIMARY KEY,
  category_id    TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  subscriber_url TEXT NOT NULL,   -- The subscribing blog's base URL
  callback_url   TEXT NOT NULL,   -- Webhook endpoint to POST events to
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_subscribers_unique ON subscribers(category_id, subscriber_url);
```

**Purpose:** Tracks which external blogs are following your categories. Used by `sendWebhookToSubscribers()` to deliver push notifications and by `GET /categories/:id/posts` to verify pull sync requests.

---

## 3. Shared Type Definitions

From `shared/types/index.ts`:

```typescript
// Webhook event types
export interface WebhookEvent {
  event: "post.published" | "post.updated" | "post.deleted" | "post.unpublished";
  post: {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    coverImage: string | null;
    coverImageWidth: number | null;
    coverImageHeight: number | null;
    createdAt: string;
    updatedAt: string;
  };
  categoryId: string;
  siteUrl: string;
}

// Subscription request/response
export interface SubscribeRequest {
  categoryId: string;
  subscriberUrl: string;
  callbackUrl: string;
}

export interface UnsubscribeRequest {
  categoryId: string;
  subscriberUrl: string;
}

// Federation metadata
export interface FederationInfo {
  siteUrl: string;
  displayName: string;
  blogTitle: string | null;
  blogDescription: string | null;
  avatarUrl: string | null;
  blogHandle: string;
}
```

---

## 4. URL Security & Validation

### `validateRemoteUrl(url, mySiteUrl)` — `lib/remoteUrl.ts`

Called before every outgoing federation request and on every incoming subscription/webhook.

**Validation steps:**

1. **Parse URL** — throws `ERR_INVALID_URL_FORMAT` if malformed
2. **Protocol check** — only `http:` and `https:` allowed → `ERR_INVALID_PROTOCOL`
3. **Localhost block** (unless `ALLOW_LOCAL_FEDERATION=true`):
   - Blocks: `localhost`, `127.0.0.1`, `::1`, `[::1]` → `ERR_LOCALHOST_FORBIDDEN`
4. **Private IP block** (unless `ALLOW_LOCAL_FEDERATION=true`):
   - Blocks: `10.x.x.x`, `192.168.x.x`, `169.254.x.x`, `172.16-31.x.x` → `ERR_PRIVATE_IP_FORBIDDEN`
5. **Self-subscription prevention**:
   - Compares hostname + port against `mySiteUrl` → `ERR_SELF_SUBSCRIPTION_FORBIDDEN`

### `fixRemoteUrl(url, remoteSiteUrl)` — Single URL

```
"/uploads/img.png" → "https://remote.blog/uploads/img.png"
"http://localhost/uploads/img.png" → "https://remote.blog/uploads/img.png"
null → null
```

### `fixRemoteContentUrls(content, remoteSiteUrl)` — Full Content

Applies regex replacements to markdown and HTML:

1. **Markdown relative paths:** `![alt](/uploads/...)` → `![alt](https://remote.blog/uploads/...)`
2. **Markdown wrong domains:** `![alt](http://localhost/uploads/...)` → `![alt](https://remote.blog/uploads/...)`
3. **HTML relative paths:** `<img src="/uploads/...">` → `<img src="https://remote.blog/uploads/...">`
4. **HTML wrong domains:** `<img src="http://localhost/uploads/...">` → `<img src="https://remote.blog/uploads/...">`

Matches both `/uploads/` and `/img/` path prefixes.

### `resolveRelativeUrls(content, siteUrl)` — Provider Side

Used when serving content TO subscribers (the opposite direction). Converts relative image paths in the local blog's content to absolute URLs before sending.

```
"![alt](//uploads/img.png)" → "![alt](https://myblog.com//uploads/img.png)"
```

### `resolveUrl(url, siteUrl)` — Provider Single URL

```
"/uploads/cover.webp" → "https://myblog.com/uploads/cover.webp"
"https://cdn.example.com/img.png" → "https://cdn.example.com/img.png" (unchanged)
```

---

## 5. Subscription Lifecycle — Step-by-Step

### Phase 1: Discovery (Client-Side)

**User action:** Admin enters a remote blog URL in the SubscriptionManager form.

**Client flow (`SubscriptionManager.tsx`):**

```
1. User types URL → normalizeUrl() adds protocol if missing
   - "example.com" → "https://example.com"
   - "localhost:6060" → "http://localhost:6060"

2. Click "Fetch Categories" →
   GET /api/federation/remote-categories?url={encoded_url}
```

**Server (`GET /federation/remote-categories`):** (line 861)

```
1. Requires auth (admin only)
2. validateRemoteUrl(url, mySiteUrl) — SSRF check
3. fetch("{url}/api/federation/categories") with 10s timeout
4. Returns: [{ id, name, slug, description }]
```

**Remote server (`GET /federation/categories`):** (line 42)

```
1. No auth required (public endpoint)
2. Returns all categories WHERE isPublic = true
3. Only exposes: id, name, slug, description
```

### Phase 2: Category Selection (Client-Side)

User selects:

- **Remote category** — which remote category to follow
- **Local category** — which local category to merge remote posts into

### Phase 3: Local Subscription (`POST /federation/local-subscribe`)

**Server flow (line 506):**

```
Step 1: Validate input
  - Requires: remoteSiteUrl, remoteCategoryId, localCategorySlug
  - validateRemoteUrl(remoteSiteUrl, mySiteUrl)
  - Find local category by slug → 404 if not found

Step 2: Find or create remoteBlog
  - SELECT FROM remote_blogs WHERE site_url = ?
  - If not found:
    → fetch("{remoteSiteUrl}/api/federation/info")
    → INSERT into remote_blogs with displayName, blogTitle, avatarUrl
    → If info fetch fails, INSERT with just siteUrl (graceful degradation)

Step 3: Find or create remoteCategory
  - SELECT FROM remote_categories WHERE remote_blog_id = ? AND remote_id = ?
  - If not found:
    → INSERT with name, slug from request body (or "Unknown"/"unknown")

Step 4: Find or create categorySubscription
  - SELECT FROM category_subscriptions WHERE local_cat = ? AND remote_cat = ?
  - If EXISTS but inactive:
    → UPDATE isActive = true
    → Restore localCategoryId for all published remote_posts in this remote category
    → Return "Subscription has been reactivated."
  - If NOT EXISTS:
    → INSERT new subscription record

Step 5: Register as subscriber on remote blog
  - POST to {remoteSiteUrl}/api/federation/subscribe with:
    {
      categoryId: remoteCategoryId,       // The category ID on the remote server
      subscriberUrl: mySiteUrl,           // My blog URL
      callbackUrl: "{mySiteUrl}/api/federation/webhook"
    }
  - 10s timeout, try-catch (failure doesn't block local subscription)
  - On failure: console.warn but subscription persists locally

Return: { message, subscriptionId }  (201 Created)
```

### Phase 4: Remote Registration (`POST /federation/subscribe`)

**Remote server flow (line 233):**

```
Step 1: Validate input
  - Requires: categoryId, subscriberUrl, callbackUrl
  - validateRemoteUrl(subscriberUrl, mySiteUrl)
  - validateRemoteUrl(callbackUrl, mySiteUrl)

Step 2: Verify category
  - SELECT FROM categories WHERE id = ? AND isPublic = true
  - 404 if not found or not public

Step 3: Check for existing subscriber
  - SELECT FROM subscribers WHERE categoryId = ? AND subscriberUrl = ?
  - If EXISTS:
    → UPDATE isActive = true, callbackUrl = new value
    → Send Slack notification (reactivated)
    → Return "Subscription has been reactivated."

Step 4: Create new subscriber
  - INSERT into subscribers { id, categoryId, subscriberUrl (trailing slashes stripped), callbackUrl }
  - Send Slack notification (new subscriber)

Return: { message, id } (201 Created)
```

**Slack notification format (i18n-aware):**

```
🔔 New federation subscriber!
Category: {categoryName}
Subscriber: {subscriberUrl}
```

---

## 6. Push Model — Webhook Delivery

### Trigger Points

Webhooks are sent from `server/src/routes/posts/index.ts` at these exact points:

| Event              | Trigger Condition                                             | Line |
| ------------------ | ------------------------------------------------------------- | ---- |
| `post.published`   | New post created with `status: "published"` + `categoryId`    | 716  |
| `post.published`   | Existing post status changed to `"published"`                 | 810  |
| `post.updated`     | Published post's content/title/cover/excerpt/category changed | 825  |
| `post.deleted`     | Published post status changed to `"deleted"`                  | 812  |
| `post.unpublished` | Published post status changed to `"draft"`                    | 814  |
| `post.deleted`     | Published post hard-deleted via DELETE endpoint               | 849  |

**Content change detection (line 818-823):**

```typescript
const contentChanged =
  (body.title !== undefined && body.title !== existing.title) ||
  (body.content !== undefined && body.content !== existing.content) ||
  (body.coverImage !== undefined && body.coverImage !== existing.coverImage) ||
  (body.excerpt !== undefined && body.excerpt !== existing.excerpt) ||
  (body.categoryId !== undefined && body.categoryId !== existing.categoryId);
```

### `sendWebhookToSubscribers()` — `feedService.ts`

```
1. SELECT FROM subscribers WHERE categoryId = ? AND isActive = true
2. Build WebhookEvent payload:
   {
     event: "post.published" | "post.updated" | "post.deleted" | "post.unpublished",
     post: {
       id, title, slug, content, excerpt, coverImage,
       coverImageWidth, coverImageHeight, createdAt, updatedAt
     },
     categoryId: categoryId,
     siteUrl: owner.siteUrl
   }
3. For each subscriber:
   → POST payload to subscriber.callbackUrl
   → 10-second timeout (AbortSignal.timeout)
   → Fire-and-forget: errors logged but don't block caller
   → Sequential delivery (not parallel)
```

**Important:** The `void` keyword before `sendWebhookToSubscribers()` calls means the function runs asynchronously without blocking the HTTP response. The post creator gets an immediate response while webhooks deliver in the background.

### Webhook Reception (`POST /federation/webhook`)

**Receiver flow (line 360):**

```
Step 1: Validate payload
  - Must have: event, post, categoryId, siteUrl
  - validateRemoteUrl(siteUrl, mySiteUrl) — SSRF check

Step 2: Find or create remoteBlog
  - SELECT FROM remote_blogs WHERE site_url = body.siteUrl
  - If not found:
    → fetch("{siteUrl}/api/federation/info") with 10s timeout
    → INSERT remote_blogs with metadata
    → 502 if info fetch fails

Step 3: Find or create remoteCategory
  - SELECT FROM remote_categories WHERE remote_blog_id = ? AND remote_id = body.categoryId
  - If not found:
    → INSERT with name="Unknown", slug="unknown"

Step 4: Resolve local category mapping
  - SELECT FROM category_subscriptions WHERE remoteCategoryId = ? AND isActive = true
  - localCatId = subscription?.localCategoryId ?? null

Step 5: Process event
  - remoteUri = "{siteUrl}/posts/{post.id}"

  IF event == "post.published" OR "post.updated":
    - fixRemoteContentUrls(content, siteUrl)
    - fixRemoteUrl(coverImage, siteUrl)
    - SELECT existing FROM remote_posts WHERE remote_uri = remoteUri
    - IF exists:
      → UPDATE title, slug, content, excerpt, coverImage, remoteStatus="published",
        remoteUpdatedAt, fetchedAt
      → localCategoryId = localCatId ?? existing.localCategoryId (preserve if no active sub)
    - IF not exists:
      → INSERT new remote_posts record with all fields
      → authorName = remoteBlog.displayName

  ELSE (post.deleted / post.unpublished):
    → UPDATE remote_posts SET remoteStatus="deleted", fetchedAt=now
      WHERE remote_uri = remoteUri

Return: { message: "Webhook processed successfully." }
```

---

## 7. Pull Model — SyncService

### 7.1 Background Sync Worker

**`startSyncWorker()` — called from `server/src/index.ts` on startup:**

```
1. Read webhook_sync_interval from site_settings (default: 15 minutes, minimum: 1 minute)
2. Schedule first sync after 5 seconds (allows bootstrap to complete)
3. Set repeating interval at configured minutes
4. Log: "🔄 Background sync worker started (interval: Xmin)"
```

### 7.2 `syncAllSubscriptions()`

```
1. SELECT FROM category_subscriptions WHERE is_active = true
2. If none, return immediately
3. Log: "🔄 Starting sync for N subscription(s)..."
4. For each subscription (sequential):
   try {
     count = await syncSubscription(sub)
     totalSynced += count
   } catch (err) {
     // Log error with category name, continue to next
   }
5. Log: "✅ Sync complete: N post(s) synced"
6. If global.gc exists, trigger manual garbage collection
```

### 7.3 `syncSubscription(sub)` — Single Subscription Sync

```
Step 1: Resolve remote info
  - Load remoteCategory from DB
  - Load remoteBlog from DB
  - validateRemoteUrl(remoteBlog.siteUrl, mySiteUrl)
  - If URL unsafe, skip with warning

Step 2: Build request URL
  - Base: "{remoteBlog.siteUrl}/api/federation/categories/{remoteCategory.remoteId}/posts"
  - If sub.lastSyncedAt exists:
    → Append "?since={lastSyncedAt}" for incremental sync
  - Headers: { "X-Zlog-Subscriber-Url": mySiteUrl }
  - Timeout: 15 seconds

Step 3: Handle response
  - 403 → Subscription revoked by remote:
    → SET category_subscriptions.isActive = false
    → SET all remote_posts.remoteStatus = "unreachable" for this category
    → throw Error("ERR_SUBSCRIPTION_REVOKED")
  - Non-200 → return 0

Step 4: Process posts (inside db.transaction())
  - Pre-load existing remote_posts by URI (batch query via inArray)
    → Avoids N+1 queries
  - URI normalization: replace domain part with remoteBlog.siteUrl
    → Handles localhost/production domain mismatches

  For each post:
    - fixRemoteContentUrls(content, remoteBlog.siteUrl)
    - fixRemoteUrl(coverImage, remoteBlog.siteUrl)
    - If existing → UPDATE (title, slug, content, excerpt, coverImage, dimensions, status, dates)
    - If new → collect into inserts array

  - Batch INSERT new posts in chunks of 100 (SQLite binding limit safety)
  - UPDATE category_subscriptions.lastSyncedAt = now

Return: count of synced posts
```

### 7.4 `triggerStaleSync()` — On-Demand Sync

**Called from:** `GET /api/posts` route (line 441) when the combined feed includes remote posts.

```
1. SELECT all active category_subscriptions
2. Filter to "stale" subscriptions:
   - lastSyncedAt is null (never synced), OR
   - lastSyncedAt is older than 3 minutes
   - AND subscription ID not in recentlyTriggered Set
3. Add each subscription ID to recentlyTriggered Set (auto-removed after 30 seconds)
4. Run async (non-blocking):
   For each stale sub:
     try { await syncSubscription(sub) } catch { /* ignore */ }
```

**Deduplication mechanism:**

- `recentlyTriggered` is a module-level `Set<string>`
- Each triggered sub ID stays in the set for 30 seconds
- Prevents the same subscription from being synced on every page load

### 7.5 Provider-Side: Serving Posts to Subscribers

**`GET /federation/categories/:id/posts` (line 61):**

```
Step 1: Parse params
  - categoryId from URL
  - since (optional) — ISO timestamp for incremental sync
  - limit (optional, default 200, max 200)
  - X-Zlog-Subscriber-Url header (optional)

Step 2: Verify subscriber (if header present)
  - SELECT FROM subscribers WHERE categoryId = ? AND subscriberUrl = ? AND isActive = true
  - 403 "ERR_SUBSCRIPTION_REVOKED" if not found
  - NOTE: If no header, posts are served freely (allows initial sync before registration)

Step 3: Build query
  - WHERE categoryId = ? AND status = 'published'
  - If since: AND updatedAt > since (catches both new and updated posts)
  - ORDER BY createdAt DESC
  - LIMIT (capped at 200)

Step 4: Build response
  For each post:
  {
    id, title, slug,
    content: resolveRelativeUrls(content, siteUrl),  // Absolute image URLs
    excerpt,
    coverImage: resolveUrl(coverImage, siteUrl),      // Absolute cover URL
    coverImageWidth, coverImageHeight,
    uri: "{siteUrl}/posts/{id}",
    createdAt, updatedAt
  }
```

---

## 8. Combined Feed — How Posts Appear

When a user visits the blog homepage, local and remote posts are merged into a single chronological feed.

**`GET /api/posts` — Combined Feed Path (line 279-445 in posts/index.ts):**

```
Trigger: When no status filter or status=published (non-admin context)

Step 1: Build WHERE clauses
  Local:  "status = 'published'" [+ category filter] [+ search filter] [+ public category check]
  Remote: "remote_status = 'published' AND local_category_id IS NOT NULL"
          [+ same category filter] [+ same search filter] [+ same public check]

Step 2: Count total
  SQL: (SELECT COUNT(*) FROM posts WHERE {local}) + (SELECT COUNT(*) FROM remote_posts WHERE {remote})

Step 3: Paginated UNION query
  SELECT id, 'local' AS source, created_at, category_id FROM posts WHERE {local}
  UNION ALL
  SELECT id, 'remote' AS source, remote_created_at AS created_at, local_category_id FROM remote_posts WHERE {remote}
  ORDER BY created_at DESC
  LIMIT {perPage} OFFSET {offset}

Step 4: Batch-load full records
  - Local posts: SELECT FROM posts WHERE id IN ({localIds})
  - Remote posts: SELECT FROM remote_posts WHERE id IN ({remoteIds})
  - Categories: batch load for all category IDs
  - Tags: batch load for local posts only
  - Comment counts: batch load for local posts only
  - Like counts: batch load for local posts only
  - Remote blogs: batch load for remote post blog IDs

Step 5: Build unified response
  Each item has:
  - isRemote: boolean — distinguishes local vs remote
  - remoteUri: string | null — link to original post
  - remoteBlog: { siteUrl, displayName, blogTitle, avatarUrl } | null
  - Remote posts have: viewCount=0, commentCount=0, likeCount=0, tags=[]

Step 6: Trigger stale sync
  - If any remote posts exist in the result, call triggerStaleSync()
  - This ensures subscriptions stay fresh when users browse
```

---

## 9. Remote Post Detail — Real-time Verification

When a user clicks a remote post, the system verifies the source is still live.

**`GET /federation/remote-posts/:id` (line 722):**

```
Step 1: Load cached remote post + remote blog info
  - 404 if not found
  - Build remoteBlogInfo object with fixed avatar URL

Step 2: Real-time source check
  - Extract postId from remoteUri: "{siteUrl}/posts/{postId}"
  - GET {remoteBlog.siteUrl}/api/federation/posts/{postId} with 5s timeout

  IF response is 404:
    → UPDATE remote_posts SET remoteStatus = "deleted"
    → Return post with remoteStatus: "deleted"
    → Client shows alert and redirects to home

  IF response is 200:
    → Compare original.updatedAt with cached remoteUpdatedAt
    → If source is newer:
      → fixRemoteContentUrls() on content
      → fixRemoteUrl() on coverImage
      → UPDATE remote_posts with fresh data
      → Return refreshed post
    → If same/older: return cached version

  IF response is error (502, timeout, etc.):
    → Return cached version as-is (graceful degradation)

  IF network error:
    → Return cached version as-is

Step 3: Final check
  - If remoteStatus != "published" → 404
  - Return post with remoteBlog info attached
```

---

## 10. Remote Comment Proxying

Comments are **never stored locally**. They are fetched in real-time from the source blog.

**`GET /federation/remote-posts/:id/comments` (line 817):**

```
1. Load remote post → 404 if not found
2. Load remote blog → 404 if missing
3. Extract postId from remoteUri
4. Proxy request: GET {remoteBlog.siteUrl}/api/posts/{postId}/comments?page={page}
   → 5s timeout
5. Return response directly to client (transparent proxy)
6. On failure → 502 "Failed to fetch remote comments."
```

**Client UI (`RemoteCommentList.tsx`):**

- Renders comments as read-only (no reply/like/edit buttons)
- Shows "(읽기 전용)" / "(Read only)" label
- Handles both paginated response and array format (backward compatibility)
- Threaded display with nested replies
- Expandable content (300 char / 5 line threshold)

---

## 11. Federated View Count Tracking

When someone reads a remote post on your blog, the original blog's view count is incremented.

**Client-side (`RemotePostDetailPage.tsx`, line 74-86):**

```typescript
// After loading remote post, notify the original blog
if (data.remoteUri && data.remoteBlog) {
  const originalPostId = extractPostIdFromUri(data.remoteUri);
  fetch(`${data.remoteBlog.siteUrl}/api/federation/posts/${originalPostId}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitorId: getVisitorId(), // UUID from localStorage
      subscriberUrl: window.location.origin,
    }),
  }).catch(() => null); // Silently fail
}
```

**Server-side (`POST /federation/posts/:id/view`, line 160):**

```
1. Validate: requires visitorId AND subscriberUrl
2. Find post → 404 if not published
3. Verify subscriber (subscriberUrl must be registered + active for this category)
4. Dedup: Check postAccessLogs for same (postId, ip="federation", referer=subscriberUrl, userAgent=visitorId) within 24h
5. If no duplicate:
   → INCREMENT posts.viewCount by 1
   → INSERT postAccessLog with ip="federation"
6. Return { success: true }
```

---

## 12. Subscription Toggle & Deletion

### Toggle Active/Inactive (`PUT /federation/subscriptions/:id/toggle`, line 1075)

```
Deactivation (isActive → false):
  1. SET category_subscriptions.isActive = false
  2. SET remote_posts.local_category_id = null
     WHERE remote_category_id = sub.remoteCategoryId
     AND local_category_id = sub.localCategoryId
  → Posts disappear from combined feed but remain in DB

Activation (isActive → true):
  1. SET category_subscriptions.isActive = true
  2. SET remote_posts.local_category_id = sub.localCategoryId
     WHERE remote_category_id = sub.remoteCategoryId
     AND remote_status = 'published'
  → Published posts reappear in combined feed
```

### Delete Subscription (`DELETE /federation/subscriptions/:id`, line 1118)

```
1. SET remote_posts.local_category_id = null (hide from feed)
2. DELETE FROM category_subscriptions WHERE id = ?
3. NOTE: remote_posts records are NOT deleted (preserved for reference)
```

### Local Unsubscribe (`POST /federation/local-unsubscribe`, line 669)

```
1. Lookup: localCategory → remoteBlog → remoteCategory → subscription
2. SET category_subscriptions.isActive = false
3. Does NOT notify the remote blog or delete subscriber record
```

---

## 13. Inbound Subscribers (Others Following You)

### Subscribe (`POST /federation/subscribe`, line 233)

See [Phase 4 in Section 5](#phase-4-remote-registration-post-federationsubscribe).

### Unsubscribe (`POST /federation/unsubscribe`, line 340)

```
1. Find subscriber by categoryId + subscriberUrl
2. SET isActive = false (soft deactivation)
3. Subscriber record preserved
```

### Admin: List Subscribers (`GET /federation/subscribers`, line 1142)

```
SELECT subscribers.*, categories.name AS categoryName
FROM subscribers
LEFT JOIN categories ON subscribers.category_id = categories.id
ORDER BY created_at DESC
```

### Admin: Delete Subscriber (`DELETE /federation/subscribers/:id`, line 1162)

```
Hard DELETE from subscribers table (permanently removes)
```

### Admin: Manual Sync (`POST /federation/subscriptions/:id/sync`, line 923)

Same logic as `syncSubscription()` but without `?since=` parameter — fetches ALL posts for a full refresh. Also handles:

- 403 → marks subscription inactive + posts unreachable
- Uses batch N+1 optimization (pre-load existing by URI)
- Returns `{ syncedCount, lastSyncedAt }`

---

## 14. Client-Side UI Components

### SubscriptionManager (`client/src/pages/admin/ui/SubscriptionManager.tsx`)

**3-step subscription form:**

1. **URL Input** — Enter remote blog URL, click "Fetch Categories"
   - Auto-normalizes URL (adds protocol)
   - Supports Enter key to submit
   - Supports auto-open via `subscribeAction` prop (deep link from other UI)

2. **Category Selection** — Two dropdowns
   - Remote categories (fetched from remote blog)
   - Local categories (fetched from own API)

3. **Subscribe** — Calls `POST /federation/local-subscribe`

**Subscription list:**

- Shows each subscription: remote blog title → remote category badge → local category badge
- Last synced timestamp (localized format)
- **Sync button** — manual sync with spinner animation
- **Power toggle** — activate/deactivate (green = active)
- **Delete button** — with confirmation dialog

**Auto-scroll:** When `subscribeAction` prop is provided, automatically scrolls to the section and focuses the local category dropdown.

### SubscriberManager (`client/src/pages/admin/ui/SubscriberManager.tsx`)

**Simple list view:**

- Shows subscriber URL, category name, callback URL, date
- Active/inactive badge
- Delete button with confirmation

### RemotePostDetailPage (`client/src/pages/remote-post-detail/ui/RemotePostDetailPage.tsx`)

- Loads post via `GET /federation/remote-posts/:id`
- Handles `remoteStatus: "deleted"` → alert + redirect
- Cover image with aspect ratio from stored dimensions
- Original blog profile card (avatar, name, link)
- "View Original" link to source post
- Fires view count to original blog
- Renders full markdown content
- Shows proxied comments (read-only)
- Supports navigation state for back button

---

## 15. Error Handling & Edge Cases

### Subscription Revocation (403)

When a remote blog removes you as a subscriber:

- **During pull sync:** `syncSubscription()` catches 403, sets subscription inactive, marks posts unreachable
- **During manual sync:** Same behavior, returns `ERR_SUBSCRIPTION_REVOKED` error
- **Client handling:** `getFederationErrorMessage()` translates error codes to localized messages

### Remote Blog Offline

- **Webhook delivery fails:** Error logged, no retry mechanism. Pull sync catches up later.
- **Pull sync fails:** Individual subscription failure logged, continues to next subscription.
- **Post detail check fails:** Returns cached version (graceful degradation).
- **Comment proxy fails:** Returns 502 to client, UI shows "Failed to load comments."

### Domain Mismatch (localhost vs production)

- `remote_uri` domain part is always normalized via `rawUri.replace(/^https?:\/\/[^/]+/, remoteBlog.siteUrl)`
- Prevents duplicate posts when the same blog changes its domain

### Webhook Registration Failure

- If `POST /federation/subscribe` on the remote blog fails:
  - Local subscription is still created
  - Console warning logged
  - Pull sync will still work (posts are public)
  - Webhooks won't be received until re-registration succeeds

### Missing Image Dimensions

- `coverImageWidth` and `coverImageHeight` are optional (nullable)
- Client falls back to `16/9` aspect ratio when dimensions are missing
- Bootstrap service auto-repairs missing dimensions on existing posts

---

## 16. Performance Optimizations

| Optimization                 | Location                  | Mechanism                                                                |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| **Batch URI lookup**         | syncService + manual sync | Pre-load all existing remote_posts by URI via `inArray()` to avoid N+1   |
| **Chunked inserts**          | syncService               | Inserts in batches of 100 (SQLite binding limit)                         |
| **Transactional sync**       | syncService               | All updates/inserts wrapped in `db.transaction()`                        |
| **Manual GC**                | syncAllSubscriptions      | `globalThis.gc()` after large syncs (requires `--expose-gc`)             |
| **Stale sync dedup**         | triggerStaleSync          | `recentlyTriggered` Set with 30-second TTL per subscription              |
| **Stale threshold**          | triggerStaleSync          | Only syncs subscriptions not synced in 3+ minutes                        |
| **Incremental sync**         | syncSubscription          | `?since=lastSyncedAt` fetches only changed posts                         |
| **Fire-and-forget webhooks** | feedService               | `void sendWebhookToSubscribers()` doesn't block HTTP response            |
| **Webhook timeout**          | feedService               | 10-second `AbortSignal.timeout` per delivery                             |
| **Sync timeout**             | syncSubscription          | 15-second timeout for pull requests                                      |
| **Comment proxying**         | remote-posts/:id/comments | No local storage; 5-second timeout                                       |
| **Post limit**               | categories/:id/posts      | Max 200 posts per response                                               |
| **Feed index**               | remote_posts table        | Composite index on (remote_status, local_category_id, remote_created_at) |
| **UNION ALL**                | GET /api/posts            | Raw SQL for combined local+remote feed with pagination                   |
| **View dedup**               | POST /posts/:id/view      | 24-hour deduplication per visitorId+subscriberUrl                        |

---

## 17. Complete API Endpoint Reference

### Provider Endpoints (Serve Content to Subscribers)

| Method | Path                                   | Auth | Description                                                                   |
| ------ | -------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| GET    | `/api/federation/info`                 | No   | Blog metadata (siteUrl, displayName, blogTitle, avatarUrl)                    |
| GET    | `/api/federation/categories`           | No   | All public categories (id, name, slug, description)                           |
| GET    | `/api/federation/categories/:id/posts` | No\* | Posts for category. Params: `since`, `limit`. Header: `X-Zlog-Subscriber-Url` |
| GET    | `/api/federation/posts/:id`            | No   | Single published post with author name                                        |
| POST   | `/api/federation/posts/:id/view`       | No   | Record federated view count. Body: `{ visitorId, subscriberUrl }`             |
| POST   | `/api/federation/subscribe`            | No   | Register as subscriber. Body: `{ categoryId, subscriberUrl, callbackUrl }`    |
| POST   | `/api/federation/unsubscribe`          | No   | Deactivate subscription. Body: `{ categoryId, subscriberUrl }`                |

\*Subscriber URL verified against subscribers table if header present

### Consumer Endpoints (Subscribe to Remote Blogs)

| Method | Path                                        | Auth | Description                                  |
| ------ | ------------------------------------------- | ---- | -------------------------------------------- |
| POST   | `/api/federation/webhook`                   | No   | Receive WebhookEvent from remote blog        |
| POST   | `/api/federation/local-subscribe`           | No   | Subscribe to remote category                 |
| POST   | `/api/federation/local-unsubscribe`         | No   | Deactivate local subscription                |
| GET    | `/api/federation/remote-posts/:id`          | No   | View remote post with real-time source check |
| GET    | `/api/federation/remote-posts/:id/comments` | No   | Proxy comments from source blog              |

### Admin Endpoints

| Method | Path                                       | Auth | Description                                  |
| ------ | ------------------------------------------ | ---- | -------------------------------------------- |
| GET    | `/api/federation/remote-categories`        | Yes  | Proxy: fetch categories from remote blog URL |
| GET    | `/api/federation/subscriptions`            | Yes  | List all subscriptions with join details     |
| POST   | `/api/federation/subscriptions/:id/sync`   | Yes  | Manual full sync                             |
| PUT    | `/api/federation/subscriptions/:id/toggle` | Yes  | Toggle active/inactive                       |
| DELETE | `/api/federation/subscriptions/:id`        | Yes  | Permanently delete subscription              |
| GET    | `/api/federation/subscribers`              | Yes  | List all inbound subscribers                 |
| DELETE | `/api/federation/subscribers/:id`          | Yes  | Delete subscriber                            |

---

## 18. Sequence Diagrams

### Subscription Flow

```
User (Admin UI)          Your Server              Remote Server
     |                       |                         |
     |-- Enter URL --------->|                         |
     |                       |-- GET /federation/categories -->|
     |                       |<-- [categories] --------------|
     |<-- Show categories ---|                         |
     |                       |                         |
     |-- Select & Subscribe->|                         |
     |                       |-- GET /federation/info ------->|
     |                       |<-- {displayName, avatar} ------|
     |                       |                         |
     |                       | [Create remoteBlog]     |
     |                       | [Create remoteCategory] |
     |                       | [Create subscription]   |
     |                       |                         |
     |                       |-- POST /federation/subscribe -->|
     |                       |   {categoryId, subscriberUrl,  |
     |                       |    callbackUrl}                 |
     |                       |<-- {id} (201) -----------------|
     |                       |                [Create subscriber record]
     |<-- Success (201) -----|                         |
```

### Push Webhook Flow

```
Blog Owner          Publisher Server          Subscriber Server
    |                      |                         |
    |-- Publish Post ----->|                         |
    |                      | [Save post to DB]       |
    |                      | [sendWebhookToSubscribers()]
    |<-- 201 Response -----|                         |
    |                      |                         |
    |                      |-- POST /federation/webhook -->|
    |                      |   {event, post, categoryId,   |
    |                      |    siteUrl}                    |
    |                      |                         |
    |                      |         [Find/create remoteBlog]
    |                      |         [Find/create remoteCategory]
    |                      |         [Upsert remote_posts]
    |                      |         [fixRemoteContentUrls()]
    |                      |<-- 200 OK ------------------|
```

### Pull Sync Flow

```
Background Worker         Your Server              Remote Server
     |                       |                         |
     | [Timer fires]         |                         |
     |-- syncAllSubscriptions()                        |
     |                       |                         |
     | For each active subscription:                   |
     |                       |                         |
     |-- syncSubscription(sub)                         |
     |                       |-- GET /categories/:id/posts?since=... -->|
     |                       |   Header: X-Zlog-Subscriber-Url        |
     |                       |<-- [posts] (or 403) -------------------|
     |                       |                         |
     |   [Begin transaction] |                         |
     |   [Batch-load existing URIs]                    |
     |   For each post:                                |
     |     [fixRemoteContentUrls()]                    |
     |     [Update or collect for insert]              |
     |   [Chunk insert new posts (100)]                |
     |   [Update lastSyncedAt]                         |
     |   [Commit transaction]|                         |
     |                       |                         |
     |-- syncSubscription(next sub)                    |
     |   ...                 |                         |
     |                       |                         |
     | [Trigger GC]          |                         |
```

### Combined Feed Query Flow

```
User Browser           Your Server
     |                      |
     |-- GET /api/posts --->|
     |                      |
     |        [Build WHERE for local posts]
     |        [Build WHERE for remote posts]
     |        [COUNT local + remote (raw SQL)]
     |        [UNION ALL + ORDER BY + LIMIT (raw SQL)]
     |        [Batch-load local posts by ID]
     |        [Batch-load remote posts by ID]
     |        [Batch-load categories]
     |        [Batch-load tags (local only)]
     |        [Batch-load comment counts (local only)]
     |        [Batch-load like counts (local only)]
     |        [Batch-load remote blogs]
     |        [Map rows: local → full post, remote → normalized post]
     |        [triggerStaleSync() if remote posts present]
     |                      |
     |<-- { items, total, page, perPage, totalPages }
```

---

## 19. Recent Changes (since 2026-02-28)

| Date       | Commit    | Description                                                                                                             |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-03-07 | `1205097` | Fix: FederationService catch blocks had build errors — corrected error variable references                              |
| 2026-03-06 | `51d493b` | Refactor: modularized codebase — federation routes/services remain in same files but overall project structure improved |
| 2026-03-05 | `e3f36ac` | Feat: sliding session renewal for JWT — admin tokens auto-renew on activity (affects federation admin endpoints)        |
| 2026-03-04 | `092fa69` | Feat: show subscribe button for all users, block self-subscription in UI                                                |

### Key architectural notes after refactoring:

- `server/src/services/federation.ts` — FederationService class (unchanged structure)
- `server/src/services/syncService.ts` — Background sync worker (unchanged)
- `server/src/routes/federation.ts` — All federation API routes (unchanged)
- `server/src/services/federation/` directory exists but is empty (reserved for future modularization)

---

_This document covers every function, query, condition, and data flow in the zlog federation subscription system. All code references are from the actual source files. Last updated: 2026-03-08._
