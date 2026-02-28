# ZLOG — Comprehensive Architecture & Codebase Report

**Date:** 2026-02-28
**Scope:** Full-depth analysis of the entire zlog codebase

---

## 1. Project Overview

**zlog** is a decentralized, self-hosted personal blog system with federation capabilities. It enables blog-to-blog networking via a subscribe-and-push protocol, while maintaining full data ownership on personal hardware (Mac, Raspberry Pi, etc.).

- **Repository:** `/Users/larry/Git/zlog`
- **Version:** 1.0.0 (Private)
- **Architecture:** npm workspaces monorepo (3 workspaces: client, server, shared)
- **Tech Stack:** React 19 + Vite 7 + TypeScript (Frontend) | Hono 4 + SQLite + Drizzle ORM (Backend)

---

## 2. Monorepo Structure

```
zlog/
├── client/          # @zlog/client — React 19 + Vite 7 + Tailwind CSS v4
├── server/          # @zlog/server — Hono 4 + SQLite (WAL) + Drizzle ORM
├── shared/          # @zlog/shared — 336+ lines of shared TypeScript interfaces
├── Dockerfile       # Multi-stage build (client-build → server-build → production)
├── docker-compose.yml  # zlog + caddy + backup services
├── Caddyfile        # Reverse proxy with HTTPS/SSL, cache headers
├── CLAUDE.md        # AI development guidelines
└── .ai-vitals.md    # Current Core Web Vitals metrics
```

### Build Pipeline

```bash
npm run build       # shared → client → server (sequential)
npm run dev         # client (port 5173) + server (port 3000) concurrently
npm run lint        # ESLint across all workspaces
npm run test        # Vitest for both server and client
```

---

## 3. Shared Types (`shared/types/`)

The `@zlog/shared` workspace defines all domain interfaces consumed by both client and server:

| Type                             | Key Fields                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Owner` / `PublicOwner`          | id, email, blogHandle, siteUrl, displayName, bio, avatarUrl, blogTitle                                                  |
| `Category` / `CategoryWithStats` | id, name, slug, isPublic, postCount, followerCount                                                                      |
| `Post` / `PostWithCategory`      | id, slug, title, content, excerpt, coverImage, coverImageWidth/Height, status, viewCount, tags, commentCount, likeCount |
| `Comment` / `CommentWithReplies` | id, postId, commenterId, authorName, content, parentId, likeCount, replies[]                                            |
| `Commenter`                      | id, provider (github\|google), providerId, displayName, avatarUrl                                                       |
| `RemoteBlog`                     | id, siteUrl, displayName, blogTitle, avatarUrl, lastFetchedAt                                                           |
| `RemotePost`                     | id, remoteUri, remoteBlogId, localCategoryId, title, content, coverImage, remoteStatus                                  |
| `CategorySubscription`           | id, localCategoryId, remoteCategoryId, isActive, lastSyncedAt                                                           |
| `Subscriber`                     | id, categoryId, subscriberUrl, callbackUrl, isActive                                                                    |
| `PostStatus`                     | "draft" \| "published" \| "deleted"                                                                                     |
| `RemotePostStatus`               | "published" \| "draft" \| "deleted" \| "unreachable"                                                                    |
| `SocialPlatform`                 | Enum of supported social platforms with metadata                                                                        |

---

## 4. Server Architecture (`server/`)

### 4.1 Entry Point & Initialization

**`server/src/index.ts`:**

1. Loads `.env` via `dotenv`
2. Calls `bootstrap()` — creates tables, FTS5 indexes, triggers, admin account, default settings
3. Starts `syncWorker` — background federation sync (default 15 min interval)
4. Starts Hono server on port 3000

### 4.2 Application Setup (`lib/create-app.ts`)

**Framework:** Hono with `@hono/zod-openapi`

**Middleware Stack:**

- CORS (separate configs for federation vs general API)
- Static file serving (`/uploads`, `/assets`, `/img`, `/favicons`)
- PWA manifest (`/site.webmanifest`)
- Service worker (`/sw.js`)

**Static Routes:**

- `/robots.txt` — SEO configuration
- `/sitemap.xml` — XML sitemap generation
- `/rss.xml` — Full blog RSS feed
- `/category/:slug/rss.xml` — Category-specific RSS
- `/reference` — OpenAPI docs (dev only)

**SSR Fallback:** All unmatched routes serve SSR-rendered HTML from client dist

### 4.3 Database Architecture

**Primary DB:** `zlog.db` (SQLite with WAL mode)
**Analytics DB:** `analytics.db` (SQLite, separate for performance)

#### Core Tables (17+ tables total)

**Content Management:**
| Table | Purpose |
|-------|---------|
| `owner` | Single-record blog owner profile (email, password, displayName, bio, avatar, etc.) |
| `socialLinks` | Social media links (platform, url, sortOrder) |
| `categories` | Post categories (slug, name, isPublic, coverImage, sortOrder) |
| `posts` | Blog posts (slug, title, content, excerpt, coverImage, coverImageWidth/Height, status, viewCount) |
| `tags` / `postTags` | Tag system with junction table |
| `postLikes` | Post engagement (postId, visitorId) |
| `postTemplates` | Saved editor templates |

**Comments:**
| Table | Purpose |
|-------|---------|
| `commenters` | OAuth users (provider: github\|google, providerId, displayName, avatarUrl) |
| `comments` | Post comments (postId, commenterId, authorName, content, password, parentId, isEdited) |
| `commentLikes` | Comment engagement (commentId, visitorId) |

**Federation:**
| Table | Purpose |
|-------|---------|
| `remoteBlogs` | Cached profile info of followed blogs |
| `remoteCategories` | Metadata about remote categories |
| `categorySubscriptions` | Local-to-remote category mapping (isActive, lastSyncedAt) |
| `remotePosts` | Cached posts from subscribed blogs (remoteUri, remoteStatus, coverImageWidth/Height) |
| `subscribers` | External instances following your categories (callbackUrl) |

**Analytics & Security:**
| Table | Purpose |
|-------|---------|
| `failedLogins` | Brute-force protection (IP-based, 24hr window) |
| `postAccessLogs` | Per-post visitor logs (IP, country, browser, OS, referer) — 10 most recent kept |
| `visitorLogs` | Rolling 24hr window (probabilistic cleanup: 5% chance per visit) |
| `siteSettings` | Key-value store (posts_per_page, comment_mode, theme colors, webhook_sync_interval, etc.) |

**Full-Text Search:**

- FTS5 virtual table `posts_fts` on title + content
- Auto-synced via INSERT/UPDATE/DELETE triggers

#### Strategic Indexes

- Posts: status, categoryId, createdAt, composite (status+createdAt), composite (categoryId+status+createdAt)
- Comments: postId, parentId, composite (postId+parentId+createdAt)
- Remote posts: composite (remoteStatus+localCategoryId+remoteCreatedAt)

### 4.4 API Routes (30+ endpoints)

#### Authentication (`/api/auth`)

| Method | Path     | Auth | Description                                                                          |
| ------ | -------- | ---- | ------------------------------------------------------------------------------------ |
| POST   | `/login` | No   | Email + password with brute-force protection (escalating lockout: 5/10/20+ failures) |
| GET    | `/me`    | Yes  | Current owner profile                                                                |

#### Posts (`/api/posts`)

| Method | Path               | Auth     | Description                                                                           |
| ------ | ------------------ | -------- | ------------------------------------------------------------------------------------- |
| GET    | `/`                | Optional | Paginated list with category/tags/counts; merges local + federated posts; FTS5 search |
| GET    | `/:param`          | No       | By ID or slug; increments view count (excludes admin); logs IP/country/UA             |
| GET    | `/tags`            | No       | All tags in blog                                                                      |
| GET    | `/:id/access-logs` | Yes      | Last 10 access logs                                                                   |
| POST   | `/`                | Yes      | Create post; auto-slug; webhook to subscribers if published                           |
| PUT    | `/:id`             | Yes      | Update post; manages tags, cover image dimensions; webhook on status change           |
| DELETE | `/:id`             | Yes      | Soft delete; webhook to subscribers                                                   |
| POST   | `/:id/like`        | No       | Toggle like via visitorId (admin excluded)                                            |

#### Categories (`/api/categories`)

| Method | Path     | Auth     | Description                                                           |
| ------ | -------- | -------- | --------------------------------------------------------------------- |
| GET    | `/`      | Optional | List with post count + follower count; non-public hidden unless admin |
| GET    | `/:slug` | No       | Specific category with stats                                          |
| POST   | `/`      | Yes      | Create with auto-unique slug                                          |
| PUT    | `/:id`   | Yes      | Update name, description, sortOrder, visibility                       |
| DELETE | `/:id`   | Yes      | Soft delete (nullifies posts.categoryId first)                        |

#### Comments (`/api`)

| Method | Path                      | Auth     | Description                                                                              |
| ------ | ------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| GET    | `/posts/:postId/comments` | No       | Paginated tree (max 3 nesting levels via recursive CTE); batch-loaded likes              |
| POST   | `/posts/:postId/comments` | No       | Create; comment mode enforcement; anonymous password hashed (scrypt); Slack notification |
| PUT    | `/comments/:id`           | No       | Edit: commenterId match (SSO) or password verify (anon); marks isEdited                  |
| DELETE | `/comments/:id`           | Optional | Soft delete; admin can always delete; content cleared                                    |
| POST   | `/comments/:id/like`      | No       | Toggle like via visitorId                                                                |

#### Federation (`/api/federation`)

| Method | Path                         | Auth | Description                                                                        |
| ------ | ---------------------------- | ---- | ---------------------------------------------------------------------------------- |
| GET    | `/info`                      | No   | Blog metadata (siteUrl, displayName, blogTitle, avatarUrl)                         |
| GET    | `/categories`                | No   | Public categories list                                                             |
| GET    | `/categories/:id/posts`      | No   | Posts with `?since=` for incremental sync; X-Zlog-Subscriber-Url header            |
| POST   | `/posts/:id/view`            | No   | Record federated view                                                              |
| POST   | `/subscribe`                 | No   | Remote subscribes to local category; SSRF validation                               |
| POST   | `/unsubscribe`               | No   | Deactivate subscription                                                            |
| POST   | `/webhook`                   | No   | Receive WebhookEvent (post.published/updated/deleted); auto-creates remote records |
| POST   | `/local-subscribe`           | Yes  | Subscribe to remote blog category                                                  |
| POST   | `/local-unsubscribe`         | Yes  | Deactivate local subscription                                                      |
| GET    | `/subscriptions`             | Yes  | All active subscriptions                                                           |
| POST   | `/subscriptions/:id/sync`    | Yes  | Manual sync from remote                                                            |
| PUT    | `/subscriptions/:id/toggle`  | Yes  | Toggle active status                                                               |
| DELETE | `/subscriptions/:id`         | Yes  | Hard delete subscription                                                           |
| GET    | `/remote-posts/:id`          | No   | Fetch with real-time freshness check                                               |
| GET    | `/remote-posts/:id/comments` | No   | Proxy comments from remote                                                         |
| GET    | `/remote-categories`         | Yes  | Proxy: fetch categories from remote blog URL                                       |
| GET    | `/subscribers`               | Yes  | List inbound subscribers                                                           |
| DELETE | `/subscribers/:id`           | Yes  | Delete subscriber                                                                  |

#### OAuth (`/api/oauth`)

| Method | Path               | Description                                         |
| ------ | ------------------ | --------------------------------------------------- |
| GET    | `/github`          | Redirect to GitHub OAuth                            |
| GET    | `/github/callback` | Exchange code, upsert commenter, redirect with data |
| GET    | `/google`          | Redirect to Google OAuth                            |
| GET    | `/google/callback` | Exchange code, upsert commenter, redirect with data |
| GET    | `/commenter/:id`   | Get commenter info                                  |
| GET    | `/providers`       | Check enabled providers                             |

#### Analytics, Upload, Settings, Templates

| Method              | Path                       | Auth | Description                                                  |
| ------------------- | -------------------------- | ---- | ------------------------------------------------------------ |
| POST                | `/api/analytics/visit`     | No   | Record visitor (cookie dedup, admin excluded)                |
| GET                 | `/api/analytics/visitors`  | Yes  | Last 24h count + 20 recent logs                              |
| POST                | `/api/upload/image`        | Yes  | Image upload: Sharp → WebP, max 1920px, returns width/height |
| GET                 | `/api/settings`            | No   | All site settings                                            |
| PUT                 | `/api/settings`            | Yes  | Upsert settings                                              |
| POST                | `/api/settings/test-slack` | Yes  | Test Slack webhook                                           |
| GET/POST/PUT/DELETE | `/api/templates/*`         | Yes  | CRUD for post templates                                      |
| GET                 | `/api/profile`             | No   | Public profile + social links + stats                        |
| PUT                 | `/api/profile`             | Yes  | Update profile fields                                        |
| POST                | `/api/profile/avatar`      | Yes  | Upload avatar (4 sizes: original, 256, 192, 64 → WebP)       |

### 4.5 Middleware

**Auth (`middleware/auth.ts`):**

- JWT (HS256) via `jose` library, 7-day expiration
- `authMiddleware` — requires valid Bearer token
- `optionalAuthMiddleware` — sets context if token present

**Error Handler (`middleware/errorHandler.ts`):**

- Custom `AppError` class (statusCode + code)
- ZodError handling (validation)
- Structured JSON responses

### 4.6 Services

**Bootstrap (`services/bootstrap.ts`):**

1. Create all tables + indexes + triggers (raw SQLite)
2. Setup FTS5 with sync triggers
3. Run column migrations for existing DBs
4. Create admin account if none exists
5. Create default "General" category
6. Initialize default site settings
7. Auto-repair missing image dimensions

**Feed Service (`services/feedService.ts`):**

- `sendWebhookToSubscribers(event, post, categoryId)` — fire-and-forget, 10s timeout

**Sync Service (`services/syncService.ts`):**

- `syncSubscription(sub)` — incremental pull via `?since=`, batch upsert (100 chunks), transactional
- `syncAllSubscriptions()` — periodic sync with GC trigger after completion
- `startSyncWorker()` — first sync 5s after start, then every N minutes (default 15)
- `triggerStaleSync()` — on post list API query, syncs subscriptions older than 3 minutes (30s cooldown)

### 4.7 Utility Libraries

| Library              | Location                                                                       | Purpose |
| -------------------- | ------------------------------------------------------------------------------ | ------- |
| `password.ts`        | Scrypt hashing (N=16384, r=8, p=1) + legacy SHA-512 fallback                   |
| `markdown.ts`        | `stripMarkdown()` — removes all formatting for plain text excerpts             |
| `slug.ts`            | `createSlug()` / `createUniqueSlug()` — supports Korean Hangul                 |
| `uuid.ts`            | UUIDv7 (time-sortable) via `uuidv7` library                                    |
| `rss.ts`             | RSS 2.0 XML generation (blog-wide + per-category)                              |
| `ssr.ts`             | SSR meta injection (OG tags, JSON-LD schema, sitemap)                          |
| `remoteUrl.ts`       | SSRF prevention (blocks localhost, private IPs); URL rewriting for federation  |
| `userAgent.ts`       | OS/browser detection from User-Agent                                           |
| `image/processor.ts` | Sharp: resize (max 1920px), WebP (quality 80), thumbnail (400x400, quality 70) |
| `i18n/`              | Server-side translations (en, ko)                                              |
| `errors.ts`          | AppError, NotFoundError, UnauthorizedError, ForbiddenError, BadRequestError    |

### 4.8 Environment Variables

| Variable                  | Default               | Description                   |
| ------------------------- | --------------------- | ----------------------------- |
| `PORT`                    | 3000                  | Server port                   |
| `SITE_URL`                | —                     | Canonical blog URL            |
| `ADMIN_EMAIL`             | —                     | Initial admin email           |
| `ADMIN_PASSWORD`          | (generated)           | Initial admin password        |
| `JWT_SECRET`              | (generated)           | Token signing secret          |
| `DB_PATH`                 | `./data/zlog.db`      | Main database path            |
| `ANALYTICS_DB_PATH`       | `./data/analytics.db` | Analytics database path       |
| `GITHUB_CLIENT_ID/SECRET` | —                     | GitHub OAuth (optional)       |
| `GOOGLE_CLIENT_ID/SECRET` | —                     | Google OAuth (optional)       |
| `ALLOW_LOCAL_FEDERATION`  | false                 | Allow localhost in federation |
| `NODE_ENV`                | —                     | development \| production     |

---

## 5. Client Architecture (`client/`)

### 5.1 FSD (Feature-Sliced Design) Structure

```
client/src/
├── app/                    # Layer 1: Global configuration
│   ├── main.tsx           # ReactDOM entry + SW registration
│   ├── App.tsx            # Root: auth/theme/settings/i18n init
│   ├── ErrorBoundary.tsx  # Top-level error boundary
│   ├── providers/         # React Query + Helmet providers
│   ├── router/            # Route config + AppLayout
│   └── styles/global.css  # Tailwind directives + theme CSS vars
├── pages/                 # Layer 2: Route-level components (all lazy-loaded)
│   ├── home/              # Post list with filtering + combined feed
│   ├── post-detail/       # Single post + comments
│   ├── post-editor/       # Markdown editor with live preview
│   ├── category-detail/   # Category post list
│   ├── remote-post-detail/# Federated post viewer
│   ├── admin/             # Admin dashboard (4 tabs)
│   ├── login/             # Admin login
│   ├── settings-profile/  # Profile customization
│   ├── profile/           # Public profile
│   ├── oauth-callback/    # GitHub/Google OAuth callback
│   └── not-found/         # 404 page
├── widgets/               # Layer 3: Independent UI blocks
│   ├── header/            # Sticky header with nav
│   ├── sidebar/           # Profile + categories (desktop only)
│   └── footer/            # Footer with compact scroll detection
├── features/              # Layer 4: Business logic + interactions
│   ├── auth/              # JWT auth (Zustand store)
│   ├── comment/           # Comment form, thread, content display
│   ├── toggle-theme/      # Dark/light mode (Zustand store)
│   ├── site-settings/     # Global settings (Zustand store)
│   └── visitor-analytics/ # Visitor tracking
├── entities/              # Layer 5: Domain components
│   ├── post/              # PostCard (memoized)
│   └── category/          # CategoryBadge
├── shared/                # Layer 6: Reusable primitives
│   ├── ui/                # Button, Card, Input, Dialog (Radix UI + CVA)
│   ├── api/client.ts      # Fetch-based API client with token management
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities (markdown parser, slugs, etc.)
│   ├── config/            # App constants
│   └── i18n/              # English/Korean translations
└── types/                 # Local TypeScript declarations
```

### 5.2 Technology Stack

| Purpose           | Technology                                      |
| ----------------- | ----------------------------------------------- |
| Framework         | React 19, React Router 7                        |
| Bundler           | Vite 7                                          |
| Styling           | Tailwind CSS 4 + CVA (class-variance-authority) |
| UI Primitives     | Radix UI (Dialog, Dropdown, Tabs, etc.)         |
| State Management  | Zustand (Auth, Theme, Settings, I18n)           |
| Server State      | TanStack React Query 5 (5 min staleTime)        |
| Markdown          | unified + remark + rehype (sanitize, highlight) |
| Code Highlighting | highlight.js via rehype-highlight               |
| Icons             | lucide-react                                    |
| Color Picker      | react-colorful                                  |
| Emoji             | emoji-picker-react                              |
| SEO/Meta          | react-helmet-async                              |

### 5.3 Routing

| Route               | Component             | Auth | SSR |
| ------------------- | --------------------- | ---- | --- |
| `/`                 | HomePage              | No   | Yes |
| `/posts/:slug`      | PostDetailPage        | No   | Yes |
| `/remote-posts/:id` | RemotePostDetailPage  | No   | Yes |
| `/profile`          | ProfilePage           | No   | Yes |
| `/category/:slug`   | CategoryDetailPage    | No   | Yes |
| `/write`            | PostEditorPage        | Yes  | No  |
| `/write/:id`        | PostEditorPage (edit) | Yes  | No  |
| `/admin`            | AdminPage             | Yes  | No  |
| `/settings`         | SettingsPage          | Yes  | No  |
| `/login`            | LoginPage             | No   | No  |
| `/oauth-callback`   | OAuthCallbackPage     | No   | No  |
| `*`                 | NotFoundPage          | No   | Yes |

All pages are lazy-loaded via `React.lazy()` with Suspense + Skeleton loader.

### 5.4 State Management (Zustand Stores)

**`useAuthStore`** (`features/auth/model/store.ts`)

- `owner`, `isAuthenticated`, `isLoading`
- `login(email, password)`, `logout()`, `checkAuth()`

**`useThemeStore`** (`features/toggle-theme/model/store.ts`)

- `isDark`, `toggle()`, `setTheme()`, `initTheme()` (localStorage or system preference)

**`useSiteSettingsStore`** (`features/site-settings/model/store.ts`)

- `settings: Record<string, string>`, `isLoaded`
- `fetchSettings()`, `getHeaderStyle()`, `getFooterStyle()`, `getBodyStyle()`
- Theme color CSS variable management

**`useI18n`** (`shared/i18n/index.ts`)

- `locale: "en" | "ko"`, `t(key, params?)`, `setLocale()`, `initLocale()`

### 5.5 API Client (`shared/api/client.ts`)

- Pure `fetch` API (no Axios)
- Methods: `get<T>`, `post<T>`, `put<T>`, `delete<T>`, `upload<T>` (FormData)
- Token in localStorage as `zlog_token`, auto-injected in Authorization header
- Error extraction from response JSON with HTTP status fallback

### 5.6 Markdown Processing Pipeline (`shared/lib/markdown/parser.ts`)

1. **Extract** mermaid blocks → placeholders
2. **Convert** GitHub-style alerts → CSS callout boxes
3. **Embed** YouTube/CodePen/CodeSandbox URLs → iframes
4. **Format** code blocks with Prettier (JS, TS, JSON, YAML, HTML, CSS)
5. **Parse** with unified (remark-parse, remark-gfm)
6. **Sanitize** with rehype-sanitize (strict schema allowing iframes)
7. **Highlight** with rehype-highlight
8. **Post-process:** language labels, copy buttons, external link targets, mermaid div restoration

**Mermaid Rendering:**

- Dynamic import on first use
- MutationObserver for new diagrams
- Theme-aware (dark/light)
- Fullscreen modal on click
- Error fallback: raw code display

### 5.7 Comment System

**Components:** CommentSection → CommentForm + CommentThread → CommentContent

**Modes:** `sso_only`, `all`, `anonymous_only`, `disabled`

**Features:**

- OAuth (GitHub, Google) — auto-focus on comment form after login
- Anonymous with password for edit/delete
- Nested replies (max 3 levels)
- Like/unlike toggle
- Image upload via drag-drop/paste
- Expandable content (300 chars or 5 lines threshold)
- Admin can delete any comment

### 5.8 Admin Panel (4 Tabs)

1. **General** — SEO, language, comment mode, notifications (Slack webhook)
2. **Content** — Category/post/template management
3. **Theme** — Live preview for colors, fonts, header/footer customization
4. **Federation** — Subscribe to remotes, view subscribers, manual sync, interval config

### 5.9 Styling Architecture

**Tailwind CSS v4** with semantic CSS variables:

- `--color-primary`, `--color-text`, `--color-surface`, etc.
- Light/dark mode via `.dark` class on `<html>`
- Runtime color assignment in AppLayout via Zustand store
- Responsive breakpoints: sm, md, lg

**Global CSS Features:**

- Code block wrappers with language labels + copy buttons
- Mermaid diagram styling + fullscreen modal
- GitHub-style callout/alert boxes
- Table styling with horizontal scroll
- Print-optimized styles
- Focus-visible ring styling

### 5.10 Image Handling

**LazyImage Component (`shared/ui/LazyImage.tsx`):**

- IntersectionObserver for lazy loading
- `priority` prop to skip lazy loading (LCP optimization)
- Configurable `objectFit` (cover, contain, contain-mobile)
- Opacity transition on load
- Async decoding

**Cover Images:**

- CSS `aspectRatio` from stored width/height
- Fallback to 16:9 if dimensions unavailable

### 5.11 Accessibility (WCAG 2.1)

- Semantic HTML (`<article>`, `<header>`, `<nav>`, `<aside>`)
- `aria-label` on icon buttons
- `role="dialog"` + `aria-modal="true"` on modals
- Focus-visible ring styling
- Tab order management
- Escape key to close modals
- Skip-to-main-content link

### 5.12 Internationalization

- **Locales:** English (en), Korean (ko)
- Parameter substitution: `t("key", { var: "value" })`
- localStorage persistence
- Default language from server settings
- Hundreds of translation keys covering all UI surfaces

---

## 6. Federation Protocol

### 6.1 Core Concept

Subscribe-and-Push protocol for decentralized blog networking. Each zlog instance can both publish and subscribe to other instances' categories.

### 6.2 Subscription Handshake (3 Phases)

1. **Discovery** — URL validation + metadata fetch (`/api/federation/info`)
2. **Local Registration** — Create `remoteBlog`, `remoteCategories`, `categorySubscription` records
3. **Remote Registration** — POST to remote's `/api/federation/subscribe` with callback URL

### 6.3 Sync Models (Hybrid Push + Pull)

**Push Model (Webhooks):**

- Real-time delivery within seconds
- Events: `post.published`, `post.updated`, `post.deleted`
- `sendWebhookToSubscribers()` — fire-and-forget, 10s timeout per delivery
- Includes coverImageWidth/Height

**Pull Model (SyncService):**

- Periodic sync (default 15 min, configurable via `webhook_sync_interval`)
- Incremental updates via `?since=` timestamp
- Batch inserts (100-item chunks) in transactions
- First sync: 5 seconds after server start
- Stale sync: triggered on post list API query for subscriptions >3 min old (30s cooldown)

### 6.4 Content Handling

- **Image URL Rewriting:** `fixRemoteContentUrls()` converts relative paths and wrong domains to correct absolute URLs
- **Post Status Tracking:** published, deleted, unreachable
- **Comment Proxying:** Real-time fetch from remote (not stored locally)
- **Cover Image Dimensions:** Width/height stored for aspect ratio preservation

### 6.5 Security

- `X-Zlog-Subscriber-Url` header for identity verification
- SSRF prevention: blocks localhost, private IPs (unless `ALLOW_LOCAL_FEDERATION=true`)
- Loop prevention: blocks self-subscription
- 10-15 second webhook timeouts
- Public-only category discovery

---

## 7. Performance & Optimization

### 7.1 Current Web Vitals

| Metric            | Value | Target  | Status               |
| ----------------- | ----- | ------- | -------------------- |
| Performance Score | 74    | —       | —                    |
| LCP               | 4.1 s | <2.5 s  | ⚠️ Needs improvement |
| CLS               | 0.198 | <0.1    | ⚠️ Needs improvement |
| TBT               | 30 ms | <200 ms | ✅ Good              |
| FCP               | 2.5 s | <1.8 s  | ⚠️ Needs improvement |

### 7.2 Optimization Strategies

**Code Splitting:**

- All pages lazy-loaded with `React.lazy()` + Suspense
- Vite `manualChunks` for vendor/framework separation
- Dynamic Mermaid import (on-demand only)
- Markdown processing engine as separate chunk (~300kB)
- Bundle chunk limit: 500kB

**Image Optimization:**

- Server-side: Sharp → WebP conversion, max 1920px width
- Client-side: LazyImage with IntersectionObserver (200px margin)
- Priority loading for above-fold images (LCP)
- Aspect ratio preservation from stored dimensions

**Rendering:**

- Memoized PostCard (`React.memo`)
- Debounced search input (300ms)
- RAF-throttled scroll listener (header collapse)
- `useCallback` for stable function references

**Data:**

- React Query 5-minute staleTime
- Batch loading for related data (categories, tags, comments, likes in single queries)
- FTS5 for search performance
- View count dedup via cookies (24hr)
- SQLite WAL mode for concurrency

**Analytics:**

- Probabilistic cleanup (5% chance per visit) for visitor logs
- SQL `COUNT()` optimization for high-traffic
- Separate analytics DB to avoid main DB contention

---

## 8. Deployment

### 8.1 Docker Multi-Stage Build

```dockerfile
Stage 1: client-build (Node 22 Alpine) → npm run build (shared + client)
Stage 2: server-build (Node 22 Alpine) → npm run build:server (tsc)
Stage 3: production (Node 22 Alpine, ~150MB)
  - Copies: server dist, client dist, node_modules, uploads
  - Runs: node --expose-gc dist/index.js
```

### 8.2 Docker Compose Services

| Service  | Purpose                                          |
| -------- | ------------------------------------------------ |
| `zlog`   | Main app (port 3000, restart: unless-stopped)    |
| `caddy`  | Reverse proxy with auto-HTTPS/SSL, cache headers |
| `backup` | SQLite database backup (profile: backup)         |

### 8.3 Caddy Configuration

- Reverse proxy to `:3000`
- Cache headers for `/uploads/*` and `/assets/*`
- Zero-config SSL certificate management

---

## 9. Security Features

| Feature                | Implementation                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| Authentication         | JWT (HS256, 7-day expiry) via `jose`                               |
| Password Hashing       | Scrypt (N=16384, r=8, p=1) + legacy SHA-512 fallback               |
| Brute-force Protection | IP-based escalating lockout (5/10/20+ failures), 24hr window       |
| XSS Prevention         | rehype-sanitize (strict schema), HTML entity encoding for comments |
| SSRF Prevention        | URL validation blocking localhost + private IPs                    |
| CORS                   | Separate configs for federation vs general API                     |
| Admin Exclusion        | Analytics exclude admin via JWT validation                         |
| Soft Deletes           | Posts and comments marked deleted (audit trail preserved)          |
| OAuth                  | GitHub + Google with commenter upsert                              |
| Cookie Security        | HttpOnly, 24hr expiry for analytics cookies                        |

---

## 10. Testing

| Workspace | Framework                       | Environment | Setup                    |
| --------- | ------------------------------- | ----------- | ------------------------ |
| Client    | Vitest + @testing-library/react | jsdom       | `src/__tests__/setup.ts` |
| Server    | Vitest                          | node        | `src/__tests__/setup.ts` |

**Test Focus Areas:**

- Component unit tests (shared/ui components)
- API integration tests (server routes)
- Edge cases and error states prioritized per guidelines

---

## 11. Key Architectural Patterns

1. **Monorepo + Shared Types** — Single source of truth for domain interfaces
2. **FSD (Feature-Sliced Design)** — Strict layer hierarchy prevents circular imports
3. **Batch Loading** — Single queries for related data (no N+1 problems)
4. **Hybrid Federation** — Push (webhooks) + Pull (periodic sync) for reliability
5. **Dual Database** — Analytics separated from main DB for performance isolation
6. **SSR Meta Injection** — OG tags + JSON-LD schema for SEO without full SSR framework
7. **Fire-and-Forget Webhooks** — Non-blocking delivery with timeout
8. **Transactional Sync** — Federation syncs wrapped in SQLite transactions
9. **Probabilistic Cleanup** — Visitor logs cleaned with 5% chance per visit (amortized cost)
10. **Semantic CSS Tokens** — Runtime theme customization via CSS variables + Zustand

---

## 12. Notable Implementation Details

| Detail             | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| UUID v7            | Time-sortable UUIDs for all entity IDs                                               |
| View Count Dedup   | Cookie-based 24hr deduplication per post                                             |
| OAuth Flow         | Store return URL in localStorage → redirect → callback → auto-scroll to comment form |
| Visitor ID         | UUID in localStorage (`zlog_visitor_id`) for anonymous likes/comments                |
| Header Collapse    | RAF-throttled scroll listener with data attribute (not state) for smooth UX          |
| Footer Compacting  | IntersectionObserver on sentinel element with min-height transition                  |
| Stale Sync Trigger | Post list API query triggers background sync for subscriptions >3 min old            |
| GC After Sync      | `global.gc()` called after large federation syncs (requires `--expose-gc`)           |
| Image Dimensions   | Stored in DB for CLS prevention (aspect ratio preserved via CSS)                     |
| Slug Generation    | Supports Korean Hangul characters                                                    |

---

_Report generated from comprehensive codebase analysis. All files in client/, server/, and shared/ workspaces were read and analyzed._
