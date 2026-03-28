# ZLOG — Comprehensive Architecture & Codebase Report

**Date:** 2026-03-22
**Scope:** Full-depth analysis of the entire zlog codebase

> **2026-03-25 Architecture Update:** Core UI components, foundational utilities (error parsing, masking, text manipulation), and shared types have been extracted into the ( repo) library to standardize the ecosystem. These are now integrated via .

---

## 1. Project Overview

**zlog** is a decentralized, self-hosted personal blog system with federation capabilities. It enables blog-to-blog networking via a subscribe-and-push protocol, while maintaining full data ownership on personal hardware (Mac, Raspberry Pi, etc.).

- **Repository:** `/Users/larry/Git/zlog`
- **Version:** 1.0.0 (Private)
- **Architecture:** npm workspaces monorepo (3 workspaces: client, server, shared)
- **Tech Stack:** React 19 + Vite 7 + TypeScript 5.9 (Frontend) | Hono 4 + SQLite + Drizzle ORM (Backend)
- **Source Files:** 95 client (.ts/.tsx) + 66 server (.ts) + shared types (353 lines)

---

## 2. Monorepo Structure

```
zlog/
├── client/          # @zlog/client — React 19 + Vite 7 + Tailwind CSS v4
├── server/          # @zlog/server — Hono 4 + SQLite (WAL) + Drizzle ORM
├── shared/          # @zlog/shared — 353 lines of shared TypeScript interfaces
├── Dockerfile       # Multi-stage build (client-build -> server-build -> production)
├── docker-compose.yml  # zlog + caddy + backup services
├── Caddyfile        # Reverse proxy with HTTPS/SSL, cache headers
├── CLAUDE.md        # AI development guidelines
└── .ai-vitals.md    # Current Core Web Vitals metrics
```

### Root Scripts

| Command          | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `npm run dev`    | Runs client (5173) + server (3000) concurrently              |
| `npm run build`  | Sequential: shared -> client (tsc -b + vite) -> server (tsc) |
| `npm run lint`   | ESLint across all workspaces                                 |
| `npm run test`   | Vitest (server + client)                                     |
| `npm run format` | Prettier formatting                                          |

### TypeScript Base Config (`tsconfig.base.json`)

- Target: ES2022 modules, bundler resolution
- Strict mode enabled (noUncheckedIndexedAccess, noImplicitOverride)
- Declaration maps + source maps

### Linting & Formatting

- **ESLint:** TypeScript ESLint strict + stylistic, prettier integration
- **Prettier:** `{ semi: true, singleQuote: false, tabWidth: 2, printWidth: 100, tailwindcss plugin }`
- **Husky:** Pre-commit (lint-staged: prettier + eslint), Pre-push (coverage report + Lighthouse vitals measurement)

---

## 3. Shared Module (`@zlog/shared`)

**Path:** `shared/types/index.ts` (336 lines) + `socialPlatform.ts` (17 lines)

### Domain Types

| Type                             | Key Fields                                                                  |
| -------------------------------- | --------------------------------------------------------------------------- |
| `Owner` / `PublicOwner`          | id, email, blogHandle, siteUrl, displayName, bio, avatarUrl                 |
| `SocialLink`                     | id, platform, url, label, sortOrder                                         |
| `Category` / `CategoryWithStats` | id, name, slug, isPublic, coverImage, postCount, followerCount              |
| `Post` / `PostWithCategory`      | id, slug, title, content, excerpt, coverImage, status, tags[], commentCount |
| `Tag`                            | id, name, slug                                                              |
| `Comment` / `CommentWithReplies` | id, postId, commenterId, authorName, content, parentId, replies[]           |
| `RemoteBlog`                     | id, siteUrl, displayName, blogTitle, avatarUrl                              |
| `RemotePost`                     | id, remoteUri, remoteBlogId, localCategoryId, content, remoteStatus         |
| `CategorySubscription`           | id, localCategoryId, remoteCategoryId, isActive, lastSyncedAt               |
| `Subscriber`                     | id, categoryId, subscriberUrl, callbackUrl, isActive                        |
| `PostTemplate`                   | id, name, content                                                           |

### Enums

- `PostStatus` = "draft" | "published" | "deleted"
- `RemotePostStatus` = "published" | "draft" | "deleted" | "unreachable"

### Social Platforms

github, twitter, instagram, linkedin, youtube, facebook, threads, mastodon, bluesky, website, email, rss, custom

---

## 4. Server Architecture

### Entry Point & Boot Sequence (`server/src/index.ts`)

1. Load environment variables (via tsx --env-file)
2. Create Hono app via `createApp()`
3. Run bootstrap (DB schema, default admin, default category, settings)
4. Start sync worker (federation background sync)
5. Serve on PORT (default 3000)

### App Creation (`server/src/lib/create-app.ts`)

**Middleware Stack (in order):**

1. Security headers (X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP, X-Frame-Options, HSTS)
2. CORS: Federation (`/api/federation/*`) = `origin: *`; Others = `origin: SITE_URL`
3. Static assets: `/uploads/*`, `/assets/*`, `/favicons/*`, `/images/*`
4. Rate limiting (per-endpoint, IP-based, in-memory Map)
5. Route mounting
6. Dynamic endpoints: PWA manifest, robots.txt, sitemap.xml, RSS feeds
7. OpenAPI docs (dev only via @scalar/hono-api-reference)
8. SSR fallback (catch-all GET \*)
9. Error handler + 404 handler

### Database Architecture

**Two SQLite databases (WAL mode):**

- `zlog.db` — Content, auth, federation (17+ tables)
- `analytics.db` — Visitor logs, access logs, failed logins

**Schema Files:** `server/src/db/schema/`

| File            | Tables                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| `auth.ts`       | owner, socialLinks                                                             |
| `posts.ts`      | categories, posts, tags, postTags, postLikes, postTemplates, posts_fts (FTS5)  |
| `comments.ts`   | commenters, comments, commentLikes                                             |
| `federation.ts` | remoteBlogs, remoteCategories, categorySubscriptions, remotePosts, subscribers |
| `settings.ts`   | siteSettings                                                                   |
| `analytics.ts`  | postAccessLogs, visitorLogs, failedLogins                                      |

**Key Indexes:**

- Posts: status, categoryId, createdAt, (status+createdAt), (categoryId+status+createdAt)
- Comments: postId, parentId, (postId+parentId+createdAt)
- Remote posts: (remoteStatus+localCategoryId+remoteCreatedAt)
- FTS5 virtual table on posts (title + content) with auto-sync triggers

**Bootstrap Process** (`server/src/services/bootstrap.ts`):

- Creates all tables via raw SQL + ALTER TABLE for migrations
- Default admin account (ADMIN_EMAIL/ADMIN_PASSWORD env)
- Default "General" category
- Default site settings
- Auto-repairs post cover image dimensions (sharp)

### API Routes

#### Authentication (`/api/auth`) — 2 endpoints

| Method | Path   | Auth | Description                                                                |
| ------ | ------ | ---- | -------------------------------------------------------------------------- |
| POST   | /login | No   | Email+password login, brute force protection (IP-based escalating lockout) |
| GET    | /me    | Yes  | Current owner info                                                         |

#### Posts (`/api/posts`) — 8 endpoints

| Method | Path             | Auth     | Description                                                                           |
| ------ | ---------------- | -------- | ------------------------------------------------------------------------------------- |
| GET    | /                | Optional | List with pagination, FTS5 search, category/tag/status filters, includes remote posts |
| GET    | /tags            | No       | All tag names                                                                         |
| GET    | /:param          | Optional | Single post (by ID or slug), view counting with 24h cookie dedup                      |
| GET    | /:id/access-logs | Yes      | Per-post access analytics                                                             |
| POST   | /                | Yes      | Create post, auto-slug, auto-excerpt, webhook to subscribers                          |
| PUT    | /:id             | Yes      | Update post, webhook on status change                                                 |
| DELETE | /:id             | Yes      | Soft delete, webhook post.deleted event                                               |
| POST   | /:id/like        | No       | Toggle like (visitorId-based)                                                         |

#### Categories (`/api/categories`) — 5 endpoints

| Method | Path   | Auth     | Description                                                       |
| ------ | ------ | -------- | ----------------------------------------------------------------- |
| GET    | /      | Optional | List with postCount + followerCount (batch queries)               |
| GET    | /:slug | Optional | Single category with stats                                        |
| POST   | /      | Yes      | Create with auto-slug                                             |
| PUT    | /:id   | Yes      | Update, re-slug on name change                                    |
| DELETE | /:id   | Yes      | Delete with post migration (targetCategoryId), cannot delete last |

#### Comments (`/api/comments`) — 5 endpoints

| Method | Path                    | Auth  | Description                                                       |
| ------ | ----------------------- | ----- | ----------------------------------------------------------------- |
| GET    | /posts/:postId/comments | No    | Paginated tree (max 3 depth), batch likes                         |
| POST   | /posts/:postId/comments | No    | Create (sso_only / anonymous / disabled mode), Slack notification |
| PUT    | /comments/:id           | Mixed | Edit (verify by commenterId or password)                          |
| DELETE | /comments/:id           | Mixed | Soft delete (admin or owner)                                      |
| POST   | /comments/:id/like      | No    | Toggle like                                                       |

#### Federation (`/api/federation`) — 15+ endpoints

**Public Endpoints (other blogs call these):**
| Method | Path | Description |
|--------|------|-------------|
| GET | /info | Blog metadata (siteUrl, displayName, blogTitle, avatarUrl) |
| GET | /categories | Public categories for remote discovery |
| GET | /categories/:id/posts | Posts feed with `since` param for delta sync |
| GET | /posts/:id | Single post with absolute URLs |
| POST | /posts/:id/view | Record federated view |
| POST | /subscribe | Remote blog subscribes to our category |
| POST | /unsubscribe | Remote blog unsubscribes |
| POST | /webhook | Receive push events (post.published/updated/deleted) |

**Admin Endpoints (local blog owner):**
| Method | Path | Description |
|--------|------|-------------|
| POST | /local-subscribe | Subscribe to remote blog category |
| POST | /local-unsubscribe | Unsubscribe from remote |
| GET | /subscriptions | List all subscriptions with stats |
| POST | /subscriptions/:id/sync | Manual pull-sync |
| PUT | /subscriptions/:id/toggle | Toggle active/inactive |
| DELETE | /subscriptions/:id | Delete subscription |
| GET | /remote-categories?url= | Discover remote blog categories |
| GET | /remote-posts/:id | Federated post detail with live verification |
| GET | /remote-posts/:id/comments | Proxy comments from remote blog |
| GET | /subscribers | Inbound subscriber list |
| DELETE | /subscribers/:id | Remove subscriber |

#### OAuth (`/api/oauth`) — 6 endpoints

| Method | Path             | Description                           |
| ------ | ---------------- | ------------------------------------- |
| GET    | /github          | GitHub OAuth redirect                 |
| GET    | /github/callback | GitHub callback (upsert commenter)    |
| GET    | /google          | Google OAuth redirect                 |
| GET    | /google/callback | Google callback                       |
| GET    | /commenter/:id   | Commenter info                        |
| GET    | /providers       | Enabled providers (based on env vars) |

#### Settings & Profile — 9 endpoints

| Method | Path                  | Auth | Description                                            |
| ------ | --------------------- | ---- | ------------------------------------------------------ |
| GET    | /profile              | No   | Owner + social links + stats                           |
| PUT    | /profile              | Yes  | Update profile fields                                  |
| POST   | /profile/avatar       | Yes  | Upload avatar (JPEG/PNG/WebP/GIF, max 5MB, multi-size) |
| DELETE | /profile/avatar       | Yes  | Remove avatar                                          |
| GET    | /profile/social-links | No   | Social links                                           |
| PUT    | /profile/social-links | Yes  | Replace all social links                               |
| PUT    | /profile/account      | Yes  | Change email/password                                  |
| GET    | /settings             | No   | All site settings                                      |
| PUT    | /settings             | Yes  | Update settings (whitelist enforced)                   |
| POST   | /settings/test-slack  | Yes  | Test Slack webhook                                     |

#### Analytics (`/api/analytics`) — 2 endpoints

| Method | Path      | Auth | Description                                                        |
| ------ | --------- | ---- | ------------------------------------------------------------------ |
| POST   | /visit    | No   | Record visitor (24h cookie dedup, geoip, 5% probabilistic cleanup) |
| GET    | /visitors | Yes  | 24h visitor count + recent 20 logs                                 |

#### Templates (`/api/templates`) — 4 endpoints (all require auth)

CRUD for markdown post templates.

#### Upload (`/api/upload`) — 1 endpoint

| Method | Path   | Auth | Description                                                       |
| ------ | ------ | ---- | ----------------------------------------------------------------- |
| POST   | /image | Yes  | Image upload (max 10MB, sharp processing, returns url+dimensions) |

#### Static/Meta Routes

- `GET /robots.txt` — Dynamic from settings
- `GET /sitemap.xml` — All public posts + categories
- `GET /rss.xml` — Full blog RSS 2.0 feed (20 recent posts)
- `GET /category/:slug/rss.xml` — Category RSS feed
- `GET /site.webmanifest` — Dynamic PWA manifest
- `GET /sw.js` — Service worker
- `GET /api/health` — Health check
- `GET /reference` — OpenAPI docs (dev only)

### Rate Limiting

| Endpoint Pattern            | Limit    |
| --------------------------- | -------- |
| /api/auth/login             | 5 / 60s  |
| /api/posts/:postId/comments | 10 / 60s |
| /api/comments/:id/like      | 30 / 60s |
| /api/posts/:id/like         | 30 / 60s |
| /api/federation/webhook     | 60 / 60s |
| /api/federation/subscribe   | 10 / 60s |
| /api/upload/\*              | 20 / 60s |

### Middleware

**Auth** (`server/src/middleware/auth.ts`):

- `authMiddleware` — Required JWT (HS256, 7d expiry), sets owner/ownerId context
- `optionalAuthMiddleware` — Same but doesn't fail on missing token
- JWT_SECRET from env or random 32-byte hex (warns if not set)

**Error Handler** (`server/src/middleware/errorHandler.ts`):

- Handles AppError, ZodError, generic Error
- Response: `{ success: false, error: { code, message, details? } }`

**Rate Limit** (`server/src/middleware/rateLimit.ts`):

- In-memory Map per endpoint, IP-based, periodic cleanup every 60s
- Returns 429 with Retry-After header, skipped in test environment

### SSR & SEO (`server/src/lib/ssr.ts`)

Server-side metadata injection for:

- **Home page:** WebSite schema.org, canonical URL
- **Post page:** BlogPosting schema.org (title, description, image, author, dates, JSON-LD)
- **Category page:** CollectionPage schema.org
- **Font preload:** Injects `<link rel="preload">` + `<link rel="stylesheet">` for configured font

### Federation Sync System

**Pull-Based (we pull from remote blogs):**

1. Admin calls `POST /api/federation/local-subscribe`
2. Creates remoteBlogs, remoteCategories, categorySubscriptions
3. Background sync worker pulls new posts periodically
4. Delta sync via `since=lastSyncedAt` parameter
5. Stale sync trigger when remote posts appear in feed (30s cooldown)

**Push-Based (remote blogs subscribe to us):**

1. Remote blog calls `POST /api/federation/subscribe`
2. When we publish/update/delete, webhook sent to callbackUrl
3. Payload: `{ event, post, categoryId, siteUrl }`

**Sync Worker** (`server/src/services/syncService.ts`):

- First sync 5s after boot, then every `webhook_sync_interval` minutes (default 15)
- Uses transactions for batch updates, handles 403 (revoked) gracefully
- `triggerStaleSync()`: Non-blocking background sync for >3min stale subscriptions

### Server Utilities

| Utility    | File                     | Purpose                                  |
| ---------- | ------------------------ | ---------------------------------------- |
| UUID v7    | `lib/uuid.ts`            | Time-sortable IDs                        |
| Password   | `lib/password.ts`        | Scrypt (N=16384, r=8, p=1) hashing       |
| Slug       | `lib/slug.ts`            | Kebab-case with Korean Hangul support    |
| Markdown   | `lib/markdown.ts`        | Strip markdown for excerpts              |
| User Agent | `lib/userAgent.ts`       | OS/browser detection                     |
| Remote URL | `lib/remoteUrl.ts`       | SSRF validation + URL rewriting          |
| Image      | `lib/image/processor.ts` | Sharp processing (WebP, multi-size)      |
| i18n       | `lib/i18n/`              | en/ko translations (Slack messages)      |
| Errors     | `lib/errors.ts`          | AppError class                           |
| RSS        | `lib/rss.ts`             | RSS 2.0 generation (full + per-category) |

---

## 5. Client Architecture

### Entry Point & Initialization

**`client/src/app/main.tsx`** — React 19 mounted to DOM root in StrictMode

**`client/src/app/App.tsx`** — Root component initializes on mount:

1. Theme (light/dark from localStorage or system preference)
2. Locale (i18n language)
3. Auth check (verify JWT, load user)
4. Site settings (customization from backend)
5. Visitor analytics recording

Wrapped in: QueryClientProvider + HelmetProvider + ErrorBoundary

### FSD Architecture

```
client/src/
├── app/           # Global setup, router, providers, styles
├── pages/         # 11 lazy-loaded route components
├── widgets/       # Header, Sidebar, Footer
├── features/      # Auth, comments, theme, settings, markdown, analytics
├── entities/      # Post (PostCard), Category (CategoryBadge)
└── shared/        # UI components, API client, hooks, utilities, i18n, config
```

### Routing (`client/src/app/router/index.tsx`)

| Route                  | Component            | Auth | SSR |
| ---------------------- | -------------------- | ---- | --- |
| `/`                    | HomePage             | No   | Yes |
| `/posts/:slug`         | PostDetailPage       | No   | Yes |
| `/remote-posts/:id`    | RemotePostDetailPage | No   | Yes |
| `/profile`             | ProfilePage          | No   | Yes |
| `/category/:slug`      | CategoryDetailPage   | No   | Yes |
| `/write`, `/write/:id` | PostEditorPage       | Yes  | No  |
| `/admin`               | AdminPage            | Yes  | No  |
| `/settings`            | SettingsPage         | Yes  | No  |
| `/login`               | LoginPage            | No   | No  |
| `/oauth-callback`      | OAuthCallbackPage    | No   | No  |
| `*`                    | NotFoundPage         | No   | Yes |

All pages use React.lazy() + Suspense with PageLoader skeleton.

### AppLayout (`client/src/app/router/AppLayout.tsx`)

Wraps all routes with:

- Header widget (sticky, responsive mobile menu)
- Main content outlet
- Sidebar widget (hidden on editor/post detail)
- Footer widget
- Toast container + Confirm modal + Scroll-to-top
- **Mermaid rendering:** Lazy-loads mermaid, MutationObserver for SPA, fullscreen modal, theme-aware
- **Code block copy:** Global event delegation, clipboard API, 2s feedback
- **Custom styling:** CSS custom properties from site settings (colors, backgrounds, fonts)
- **Skip-to-main-content** link (accessibility)

### State Management (Zustand)

**Auth Store** (`features/auth/model/store.ts`):

- State: `owner`, `isAuthenticated`, `isLoading`
- Methods: `login()`, `logout()`, `checkAuth()`
- Global 401 interceptor via `zlog_unauthorized` event

**Theme Store** (`features/toggle-theme/model/store.ts`):

- State: `isDark`
- Methods: `toggle()`, `setTheme()`, `initTheme()`
- Persisted to localStorage, applies `.dark` class on `<html>`

**Site Settings Store** (`features/site-settings/model/store.ts`):

- State: `settings` (Record<string, string>), `isLoaded`
- Methods: `fetchSettings()`, `getHeaderStyle()`, `getFooterStyle()`, `getBodyStyle()`, `getCurrentFont()`
- Computes dynamic CSS styles from backend settings

**I18n Store** (`shared/i18n/index.ts`):

- State: `locale` ("en" | "ko")
- Methods: `t(key, params?)`, `setLocale()`, `initLocale()`
- 100+ translation keys, persisted to localStorage

### API Client (`shared/api/client.ts`)

Custom fetch-based ApiClient:

- No external HTTP library (native fetch)
- Token management (localStorage)
- Auto 401 handling (clears token, dispatches event)
- Methods: `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()`, `upload<T>()`

**React Query** (`shared/api/queries.ts`):

- QueryClient: 1 retry, 5min stale time, no refetch on focus
- Shared hooks: `useCategories()`, `useProfile()` (deduplicates across Header + Sidebar)
- Query keys factory: `shared/api/queryKeys.ts`

### Pages Overview

| Page                     | Key Features                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **HomePage**             | Post list with pagination, category/tag filtering, FTS search, subscribe dialog, RSS            |
| **PostDetailPage**       | Markdown rendering, TOC (h2/h3), reading progress bar, like, comments, prev/next nav, share     |
| **PostEditorPage**       | Rich markdown editor with toolbar, cover image upload, category/tag selection, auto-save        |
| **CategoryDetailPage**   | Category posts, search, empty state with mascot, subscribe button                               |
| **RemotePostDetailPage** | Federated post with original blog attribution, proxied comments                                 |
| **AdminPage**            | Tab-based dashboard: posts, categories, templates, theme customizer, subscriptions, subscribers |
| **SettingsPage**         | Profile, notifications, language/theme, social links, account                                   |
| **ProfilePage**          | Public profile display, stats, post list                                                        |
| **LoginPage**            | Email/password + OAuth buttons                                                                  |

### Widgets

**Header:**

- Logo + blog title, navigation, theme toggle, auth-aware items
- Mobile hamburger drawer
- Custom background (color + image with alignment)
- Scroll-detection collapsing (RAF throttled)

**Sidebar:**

- Profile card (avatar, name, bio, stats)
- Visitor stats (weekly chart)
- Category list with post count badges

**Footer:**

- zlog logo + GitHub link
- Custom background support
- IntersectionObserver-based expansion (sentinel element)

### Markdown Parser (`shared/lib/markdown/parser.ts`)

Unified.js pipeline (lazy-loaded):

1. Mermaid diagram extraction + placeholder
2. Custom image syntax (`?width=W&height=H&align=`)
3. GitHub-style alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
4. YouTube embeds (`@[youtube](url)` + auto-detect standalone URLs)
5. CodePen / CodeSandbox embeds
6. remark-gfm (GitHub Flavored Markdown)
7. rehype-highlight (syntax highlighting)
8. rehype-raw + rehype-sanitize (XSS safe)
9. Code block enhancement (language label + copy button)
10. Link processing (target=\_blank, rel=noopener)
11. Heading anchors (slugified h2/h3 for TOC)
12. Mermaid placeholder restoration

### Styling (`client/src/app/styles/global.css`)

**Tailwind CSS v4** with `@theme` / `@custom-variant` syntax.

**CSS Custom Properties (Light/Dark):**

- `--color-primary`: #6c5ce7 (purple)
- `--color-accent`: #ff6b6b (red)
- Background, surface, text, border, destructive, success colors
- Dark theme via `.dark` class override

**Features:**

- Responsive typography (clamp())
- CJK word-break: keep-all
- highlight.js code blocks with dark theme overrides
- Callout/alert styling (note, tip, important, warning, caution)
- Horizontal scrollable tables on mobile
- Print styles (force light, hide nav/sidebar/footer)

### Vite Build Config (`client/vite.config.ts`)

**Chunk Splitting:**

```
react-vendor: react, react-dom, react-router (~99KB)
ui-vendor: lucide-react, @radix-ui/* (~18KB)
markdown-vendor: remark-*, rehype-* (~284KB)
emoji-picker-react: dynamic import only (~309KB, NOT modulepreloaded)
mermaid: external (CDN via importmap)
```

**Dev Server Proxy:**

- `/api` -> `http://localhost:3000`
- `/uploads`, `/rss.xml`, `/site.webmanifest`, `/category` -> backend

### Shared UI Components

**Integrated from @zebra/core:** Button, Input, Textarea, Card, Badge, Modal, ConfirmModal, ToastContainer, Pagination, Skeleton, Checkbox, Select, ToggleSwitch, LazyImage

**Custom local / Radix UI:** Dialog, Dropdown Menu, Tabs, Tooltip, Label, Separator, SEOHead, DefaultAvatar, ZlogLogo, OfflineFallback, NotFoundFallback, MarkdownToolbar, StickerPicker, ColorPicker, ScrollToTop

### Shared Hooks

- `useClickOutside()` — Detect clicks outside element
- `useUndoRedo()` — Undo/redo state management (editor)
- `useToast()` — Toast notifications (success, error, info)
- `useConfirm()` — Confirmation modal

### Config Constants (`shared/config/index.ts`)

- MAX_COMMENT_DEPTH: 3
- MAX_COMMENT_LENGTH: 2000
- MAX_AVATAR_SIZE: 5MB
- DEBOUNCE_MS: 150
- DEFAULT_PER_PAGE: 10
- LAZY_LOAD_MARGIN: "200px"

### Testing

- **Framework:** Vitest with jsdom environment
- **Libraries:** @testing-library/react, @testing-library/user-event, jest-dom
- **Coverage:** Button, Badge, ConfirmModal, parser, useUndoRedo, editor shortcuts, API client

---

## 6. Environment Variables

### Server Configuration

| Variable             | Default               | Description                           |
| -------------------- | --------------------- | ------------------------------------- |
| `PORT`               | 3000                  | Server port                           |
| `SITE_URL`           | http://localhost:3000 | Canonical blog URL (CORS + meta tags) |
| `ADMIN_EMAIL`        | admin@example.com     | Initial admin email                   |
| `ADMIN_PASSWORD`     | changeme              | Initial admin password                |
| `ADMIN_DISPLAY_NAME` | Blog Owner            | Display name                          |
| `JWT_SECRET`         | random                | JWT signing secret                    |
| `NODE_ENV`           | development           | development / production              |
| `DB_PATH`            | ./data/zlog.db        | Main database path                    |
| `ANALYTICS_DB_PATH`  | ./data/analytics.db   | Analytics database path               |

### Federation

| Variable                 | Default | Description                      |
| ------------------------ | ------- | -------------------------------- |
| `WEBHOOK_SYNC_INTERVAL`  | 15      | Minutes between background syncs |
| `ALLOW_LOCAL_FEDERATION` | false   | Allow localhost/private IPs      |

### OAuth (Optional)

| Variable                                    | Description  |
| ------------------------------------------- | ------------ |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |

### Client (Optional)

| Variable             | Description          |
| -------------------- | -------------------- |
| `VITE_GIPHY_API_KEY` | GIPHY sticker picker |

---

## 7. Docker Deployment

### Dockerfile (Multi-stage)

1. **client-build** (Node 22 Alpine): Install + build client
2. **server-build** (Node 22 Alpine): Install + build server (tsc)
3. **production** (~150MB): Production deps + dist copies + upload dirs

### docker-compose.yml

| Service  | Image          | Purpose                                             |
| -------- | -------------- | --------------------------------------------------- |
| `zlog`   | Dockerfile     | Main app (port 3000, restart: unless-stopped)       |
| `caddy`  | caddy:2-alpine | Reverse proxy with auto-HTTPS (profile: production) |
| `backup` | alpine:3       | SQLite backup automation (profile: backup)          |

### Caddyfile

- Reverse proxy to zlog:3000
- gzip encoding
- Security headers (nosniff, DENY, HSTS preload)
- Immutable cache for /uploads/_ and /assets/_ (1 year)

### Volumes

- `./docker-data/db:/app/data` — Database persistence
- `./docker-data/uploads:/app/uploads` — User uploads
- `caddy-data`, `caddy-config` — SSL certificates

### Health Check

- `wget --spider http://localhost:3000/api/health` every 30s

---

## 8. Security Features

| Feature                | Implementation                                                      |
| ---------------------- | ------------------------------------------------------------------- |
| Authentication         | JWT HS256 (7-day expiry) via jose                                   |
| Password Hashing       | Scrypt (N=16384, r=8, p=1)                                          |
| Brute-force Protection | IP-based escalating lockout (30s/5min/15min at 5/10/20+ fails)      |
| XSS Prevention         | rehype-sanitize (client) + HTML entity encoding (server comments)   |
| SSRF Prevention        | URL validation (blocks localhost + private IPs)                     |
| CORS                   | Separate configs (federation: `origin: *`, others: SITE_URL)        |
| Security Headers       | X-Content-Type-Options, X-Frame-Options, CSP, HSTS, Referrer-Policy |
| Rate Limiting          | Per-endpoint IP-based in-memory store                               |
| Soft Deletes           | Posts/comments marked deleted (audit trail)                         |
| OAuth                  | GitHub + Google (commenter upsert, CSRF state token)                |
| Comment Password       | bcrypt hashing for anonymous comment edit/delete                    |

---

## 9. Performance & Optimization

### Current Core Web Vitals (2026-03-07)

| Metric            | Value | Target |
| ----------------- | ----- | ------ |
| Performance Score | 80    | 95+    |
| LCP               | 3.5s  | <2.5s  |
| CLS               | 0.199 | <0.1   |
| TBT               | 10ms  | <200ms |
| FCP               | 2.0s  | <1.8s  |

### Optimization Strategies

- **Code splitting:** Pages lazy-loaded, vendor chunks (react/ui/markdown), mermaid CDN
- **Image optimization:** Sharp (WebP, multi-size), LazyImage component
- **Caching:** React Query (5min stale), immutable cache headers for assets
- **Rendering:** Memoized PostCard, RAF-throttled scroll, debounced search (150ms)
- **SSR:** Font preload + stylesheet injection, OG/JSON-LD meta injection
- **Database:** WAL mode, FTS5 full-text search, batch loading (N+1 prevention), strategic indexes
- **Bundle:** emoji-picker-react as dynamic-only chunk (not modulepreloaded), chunk limit 500KB

### Key Architectural Patterns

1. **Batch Loading** — Comments/posts batch-load related data to avoid N+1
2. **Soft Deletes** — Posts/comments use deletedAt, not hard delete
3. **Visitor Tracking** — Anonymous visitorId (localStorage UUID) for likes/analytics
4. **Two-Phase Federation Sync** — Pull (background worker) + Push (webhooks)
5. **Stale Sync Trigger** — Detects stale remote content, triggers async background sync
6. **FTS5 + Pagination** — Combined full-text search with cursor-based pagination
7. **Transaction-Based Sync** — Atomic batch updates for federation sync
8. **Delta Sync** — `since` parameter for incremental pull from remote blogs

---

## 10. Testing Structure

### Server Tests (`server/src/__tests__/`)

- Vitest with in-memory SQLite
- Test helpers: DB fixtures, mock auth
- Coverage: auth, posts, comments, categories, federation, analytics, upload, SSR, OAuth, settings, templates

### Client Tests (`client/src/*/__tests__/`)

- Vitest + jsdom + @testing-library/react
- Coverage: Button, Badge, ConfirmModal, markdown parser, useUndoRedo, editor shortcuts, API client

### Coverage

- **Provider:** @vitest/coverage-v8
- **Reporter:** text-summary (terminal) + html (browser)
- **Server:** `server/coverage/` — includes `src/**/*.ts`, excludes tests + migrations
- **Client:** `client/coverage/` — includes `src/**/*.{ts,tsx}`, excludes tests + vite-env.d.ts

### Pre-commit Workflow

1. `npx lint-staged` — prettier --check + eslint --max-warnings=0
2. Pre-push: Coverage report (text-summary) -> Lighthouse measurement -> .ai-vitals.md auto-update

---

## 11. Recent Changes (since 2026-02-28)

| Commit    | Description                                                                             |
| --------- | --------------------------------------------------------------------------------------- |
| `51d493b` | Major refactor: modularized routes (posts/, upload/ subdirectories), federation service |
| `1205097` | Fix build errors in FederationService catch blocks                                      |
| `e3f36ac` | Sliding session renewal for admin JWT tokens                                            |
| `2be1451` | Preserve JWT on network errors during deployment                                        |
| `05ea677` | Add @vitest/coverage-v8 for code coverage reporting                                     |
| `fa0ef03` | Add coverage report to pre-push husky hook                                              |
| `216806f` | Upgrade TypeScript 5.7.3 → 5.9.3                                                        |
| `58e37ca` | Fix 7 security vulnerabilities (Dependabot + CodeQL)                                    |
