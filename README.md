<img width="800" alt="zlog_wide_log" src="https://github.com/user-attachments/assets/d132c23b-08d9-42a1-bb6a-f886b05bdf07" style="margin-bottom:100px" /> <br />

## 🌐 zlog: A Decentralized Community Network Beyond Personal Blogging

**"Maintain full data ownership while enjoying seamless community connectivity."**

zlog began with a simple, exciting vision: **"What if friends or hobbyist groups with shared interests could run their own blogs while subscribing to each other to build a collective feed together?"**

<img width="800" alt="image" src="https://github.com/user-attachments/assets/94306fe1-211f-476b-aca3-90927c86af58" />

### 🤝 Personal Space, Shared Community

- **Co-created Networks**: While each person runs their own blog, you can connect specific categories to aggregate posts from like-minded peers right on your own dashboard.
- **Discovery through Flow**: Discover new zloggers through shared posts on your blog, and let your own content travel to others' feeds, inviting new audiences to your space.
- **Subscribe to Tastes**: If another zlogger loves your category, they can subscribe to it and integrate your latest updates into their own blog in real-time.

> "Where individual islands come together to form a continent—this is the decentralized blog network zlog envisions."

[한국어 문서 (Korean)](./README.ko.md)

<p>
  <img src="https://img.shields.io/badge/Self--hosted-black?style=flat-square" alt="Self-hosted" />
  <img src="https://img.shields.io/badge/Federation-6C5CE7?style=flat-square" alt="Federation" />
  <img src="https://img.shields.io/badge/RSS_2.0-orange?style=flat-square" alt="RSS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/@zebra/core-6C5CE7?style=flat-square" alt="zCore" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
</p>

---

## Why ZLOG?

|                             | Centralized Platforms   | Static Site Generators | **ZLOG**                       |
| --------------------------- | ----------------------- | ---------------------- | ------------------------------ |
| **Data Ownership**          | Platform owns your data | You own files          | **You own everything**         |
| **Cross-blog Subscription** | Platform-dependent      | Not built-in           | **Built-in Federation**        |
| **RSS**                     | Sometimes               | Plugin needed          | **Native support**             |
| **Comments**                | Third-party required    | Third-party required   | **Built-in (SSO + Anonymous)** |
| **Setup Complexity**        | None                    | Build pipeline needed  | **`docker compose up`**        |
| **Runs on Raspberry Pi**    | N/A                     | Possible               | **Yes, natively**              |

### The Problem: Personal Blogs as Isolated Islands

Personal blogs often become **"isolated islands."** No matter how great your content is, staying connected with peers or building a community usually requires moving into a "walled garden" (like Medium or Tumblr) or relying heavily on external tools like RSS readers and social media.

Centralized platforms offer connectivity at the cost of your data sovereignty and design freedom, while independent blogs offer freedom but suffer from isolation. **"Is it possible to maintain my own space while staying effortlessly connected with the people I care about?"** This is the question ZLOG aims to answer.

### The Solution: Your Blog, a Community Node

ZLOG transforms your blog into a **community node** by building subscription and federation right into the core engine. It creates a **"decentralized community network"** where independence and connectivity coexist.

1. **Co-created Community Feeds**: Friends or hobbyist groups can run their own independent blogs. By subscribing to each other's categories, your blog becomes a shared social dashboard for your circle.
2. **Discovery through Flow**: Your posts and subscribed posts from your peers live together in a single, unified feed. Visitors to your blog can naturally discover and jump to other amazing zloggers you follow.
3. **Sovereignty Meets Connectivity**: All these interactions happen on your own hardware (Mac Mini, Raspberry Pi, etc.). You maintain 100% ownership of your data and design while enjoying the benefits of a connected network.

Independent yet interconnected — a **decentralized blog network**. That's ZLOG.

---

## Core Feature: Subscription & Federation

This is what makes ZLOG unique. There are **two ways** to subscribe to a ZLOG blog:

```mermaid
flowchart LR
    subgraph methods [Two Subscription Methods]
        direction TB
        zlog[ZLOG-to-ZLOG Federation]
        rss[RSS Feed]
    end

    subgraph zlogFeatures [ZLOG Federation]
        direction TB
        realtime[Real-time Webhook Delivery]
        embedded[Posts Embedded in Your Blog]
        bidirectional[Bidirectional Communication]
        manage[Admin Dashboard Management]
    end

    subgraph rssFeatures [RSS Feed]
        direction TB
        universal[Any RSS Reader Compatible]
        standard[Standard RSS 2.0 Format]
        percategory[Per-category Feeds]
        autodiscovery[Auto-discovery Support]
    end

    zlog --> zlogFeatures
    rss --> rssFeatures
```

### ZLOG-to-ZLOG Federation

When two ZLOG instances connect, they form a **live subscription** with automatic content delivery.

```mermaid
sequenceDiagram
    participant Admin as Blog A (Subscriber)
    participant BlogB as Blog B (Publisher)

    Note over Admin,BlogB: Phase 1 — Subscribe

    Admin->>BlogB: GET /api/federation/categories
    BlogB-->>Admin: List of public categories
    Admin->>BlogB: POST /api/federation/subscribe
    BlogB-->>Admin: Subscription confirmed
    Admin->>Admin: Store subscription mapping

    Note over Admin,BlogB: Phase 2 — Content Delivery (Automatic)

    BlogB->>BlogB: Author publishes a new post
    BlogB->>Admin: POST /api/federation/webhook
    Note right of BlogB: { event: "post.published",<br/>post: { title, content, ... } }
    Admin->>Admin: Store as remote post
    Admin->>Admin: Display in local category

    Note over Admin,BlogB: Phase 3 — Reader Experience

    Note over Admin: Visitor opens Blog A's category
    Admin->>Admin: Merge local + remote posts
    Note over Admin: Remote posts show "View Original"<br/>link back to Blog B
```

#### How It Works

1. **Subscribe**: From your admin dashboard, enter a remote blog URL, select a category to follow, and map it to one of your local categories. The subscription request is sent server-to-server (no CORS issues).

2. **Automatic Delivery**: When the publisher writes a new post, ZLOG sends a webhook to all subscribers. The post content (with properly resolved image URLs) is stored locally.

3. **Seamless Display**: Remote posts appear in your category listings alongside your own posts, sorted by date. Each remote post shows a "View Original" link to the source blog. Remote posts also appear in the "All" tab on the homepage.

4. **Background Sync**: A background worker automatically syncs all subscriptions periodically (default: every 15 minutes, configurable via `WEBHOOK_SYNC_INTERVAL`). This ensures no posts are missed even if webhooks fail. The worker uses incremental sync (`?since=lastSyncedAt`) for efficiency.

5. **Manual Sync**: You can also trigger a manual sync from the admin dashboard at any time to immediately fetch the latest posts.

### RSS Feed

Every ZLOG blog automatically generates RSS 2.0 feeds:

| Feed             | URL                        | Description                            |
| ---------------- | -------------------------- | -------------------------------------- |
| **Full Blog**    | `/rss.xml`                 | Latest 20 posts across all categories  |
| **Per Category** | `/category/{slug}/rss.xml` | Latest 20 posts in a specific category |

- **Auto-discovery**: `<link rel="alternate">` tag in HTML head for automatic detection by RSS readers
- **Standard format**: Compatible with Feedly, Inoreader, NetNewsWire, and any RSS 2.0 reader
- **RSS links** are visible in the sidebar and on each category page

### Admin Subscription Management

The admin dashboard provides a complete subscription management interface:

- **My Subscriptions**: View all categories you're subscribed to, with last sync time
- **Add Subscription**: Enter a remote blog URL → fetch categories → select & map to local category
- **Manual Sync**: One-click sync button to fetch latest posts from a subscription
- **Auto Sync**: Background worker syncs all subscriptions automatically (configurable interval)
- **Unsubscribe**: Remove subscriptions you no longer want
- **Subscriber List**: See which external blogs are subscribed to your categories

### Data Architecture

```mermaid
erDiagram
    categories ||--o{ posts : contains
    categories ||--o{ subscribers : "subscribed by"
    categories ||--o{ categorySubscriptions : "subscribes to"

    remoteBlogs ||--o{ remoteCategories : has
    remoteCategories ||--o{ categorySubscriptions : "linked via"
    remoteCategories ||--o{ remotePosts : contains

    remotePosts }o--o| categories : "displayed in"
    remoteBlogs ||--o{ remotePosts : "authored by"

    categories {
        text id PK
        text name
        text slug
        text description
    }

    posts {
        text id PK
        text title
        text slug
        text content
        text status
    }

    subscribers {
        text id PK
        text categoryId FK
        text subscriberUrl
        text callbackUrl
    }

    categorySubscriptions {
        text id PK
        text localCategoryId FK
        text remoteCategoryId FK
        text lastSyncedAt
    }

    remoteBlogs {
        text id PK
        text siteUrl
        text blogTitle
    }

    remoteCategories {
        text id PK
        text remoteBlogId FK
        text name
        text slug
    }

    remotePosts {
        text id PK
        text remoteUri
        text localCategoryId FK
        text title
        text content
    }
```

---

## All Features at a Glance

### Writing & Editing

- **Markdown Editor** with live preview (edit / split / preview modes)
- **Toolbar Features**: Format text, lists, and insert media with ease. Features multi-step Undo/Redo support.
- **Post Templates**: Save and reuse markdown templates for consistent writing workflows
- **Media Insertion**: Image paste & drag-and-drop, GIPHY Sticker Picker for adding expressive stickers
- **Image alignment & dimensions syntax**: Custom markdown `![alt](url?align=center&width=W&height=H)` supports image alignment (left/right/center) and exact sizing
- **Cover image** support with upload
- **Custom embeds**: YouTube, CodePen, CodeSandbox
- **Code blocks** with syntax highlighting (highlight.js) and auto-formatting (Prettier)
- **Language label & copy button** on code blocks
- **Mermaid diagram** rendering with click-to-zoom
- **Draft / Publish** workflow with post management in admin
- **Responsive editor**: mobile-optimized layout with stacked title/category/tags rows

### Comments

- **Configurable modes**: SSO Only, Allow All (SSO + Anonymous), Anonymous Only, Disabled
- **OAuth login**: GitHub and Google for authenticated commenting
- **Anonymous comments** with password for edit/delete
- **Advanced Pagination**: Root-based pagination with "Load More" for high performance
- **Federation Comments**: View comments from remote blogs in real-time via server-side proxy
- **Rich Display**: Support for line breaks and automatic truncation ("Show more") for long comments
- **Admin moderation**: delete any comment with confirmation; auto-hiding deleted threads without active replies
- **XSS protection**: plain text only, server-side sanitization

### Engagement

- **Post Likes**: Anonymous "Heart" button for readers to show appreciation
- **Real-time Updates**: Live sync of like and comment counts without page refresh
- **In-list Metrics**: Like counts visible in the post list for popular content

### Appearance

- **Light / Dark theme** toggle with system preference detection
- **Semantic theme tokens**: CSS variable-based color system (primary, destructive, success) with full dark mode support
- **Core Web Vitals**: Optimized LCP with priority image loading for the first post
- **Custom header & footer**: background color, background image, adjustable height
- **Responsive design**: mobile-optimized with auto-shrinking header on scroll
- **Glassmorphism** effects on header/footer
- **Print-Ready**: highly optimized CSS for printing, gracefully hiding interactive elements and forcing clean black-and-white layouts even in dark mode.

### Internationalization

- **English** (default) and **Korean** built-in
- **Admin configurable**: change language from settings
- All UI strings translated including dates, time-ago formatting

### SEO & Discovery

- **RSS feeds** (blog-wide and per-category)
- **Sitemap.xml** auto-generated
- **robots.txt** configured
- **Open Graph & Twitter Card** meta tags
- **SEO settings** in admin (description, OG image)

### Visitor Analytics

- **Real-time Dashboard**: Monitor unique visitors and total page views over the last 24 hours.
- **Detailed Logs**: View recent 24-hour visitor details including IP, Country, OS, Browser, and Referer.
- **Federation Views**: Securely track view counts when your posts are read on subscribed remote blogs without compromising reader privacy.
- **Privacy-focused**: Local storage only, no third-party trackers.

### Notifications

- **Slack Integration**: Receive real-time notifications via Slack webhook.
- **Comment Alerts**: Get notified when someone leaves a new comment or reply on your posts.
- **Federation Alerts**: Instantly know when another blog subscribes to your categories.
- **i18n Support**: Notification messages automatically adapt to your blog's default language.

### Security

- **JWT authentication** for admin with **sliding session**: tokens auto-renew on daily visits, so active admins stay logged in indefinitely
- **Brute-force protection**: escalating lockout (30s → 5m → 15m) after repeated failed login attempts
- **Secret categories**: password-protected categories hidden from public listings
- **SSRF protection**: federation URL validation blocks private/internal IPs
- **XSS protection**: server-side HTML sanitization on all user inputs

### Technical

- **PWA**: installable, offline-capable with service worker
- **Image optimization**: Sharp-based resize/compress to WebP
- **SQLite**: zero-config database, single file backup
- **RESTful API** with Hono framework
- **Background sync worker**: automatic periodic federation sync with GC optimization
- **Server-proxied federation**: all cross-origin calls are server-to-server (no CORS dependency)
- **Testing**: Vitest + Testing Library for both server API and client UI components
- **Performance**: Built-in Lighthouse script to measure Core Web Vitals and provide context for AI-driven performance optimization

---

## System Architecture

```mermaid
flowchart TB
    subgraph client [Client — React 19 + Vite 7]
        direction TB
        FSD[Feature-Sliced Design]
        UI[Radix UI + Tailwind CSS v4 + @zebra/core]
        State[Zustand State Management]
        MD[Unified Markdown Pipeline]
    end

    subgraph server [Server — Hono 4 + Node.js]
        direction TB
        API[RESTful API]
        Auth[JWT + OAuth2]
        Fed[Federation Engine]
        Sync[Background Sync Worker]
        Img[Sharp Image Processing]
    end

    subgraph db [Database — SQLite]
        direction TB
        Drizzle[Drizzle ORM]
        WAL[WAL Mode]
    end

    subgraph external [External]
        direction TB
        OtherZlog[Other ZLOG Instances]
        RSSReaders[RSS Readers]
        OAuth[GitHub / Google OAuth]
    end

    client <-->|REST API| server
    server <--> db
    server <-->|Webhooks| OtherZlog
    server -->|RSS XML| RSSReaders
    server <-->|OAuth2| OAuth
```

---

## Quick Start

### With Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/zebra0303/zlog.git
cd zlog

# Configure environment
cp .env.example .env
# Edit .env with your settings (admin email, password, site URL)

# Start with Docker Compose
docker compose up -d

# Access your blog at http://localhost:3000
```

### With Docker + HTTPS (Production)

```bash
# Set your domain and start with Caddy reverse proxy
DOMAIN=yourblog.com docker compose --profile production up -d

# Caddy automatically obtains SSL certificates
# Access at https://yourblog.com
```

### Manual Setup

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build
npm run start
```

### On Raspberry Pi

ZLOG is designed to run on resource-constrained devices:

```bash
# Works on Raspberry Pi 3/4/5
docker compose up -d

# Or build manually (memory-optimized build script included)
npm install
npm run build
npm run start
```

---

## Environment Variables

| Variable                 | Description                    | Default                 |
| ------------------------ | ------------------------------ | ----------------------- |
| `ADMIN_EMAIL`            | Admin login email              | `admin@example.com`     |
| `ADMIN_PASSWORD`         | Admin login password           | `admin1234`             |
| `SITE_URL`               | Public URL of your blog        | `http://localhost:3000` |
| `ADMIN_DISPLAY_NAME`     | Author display name            | `Blog Owner`            |
| `JWT_SECRET`             | Secret for JWT signing         | `change-me-...`         |
| `PORT`                   | Server port                    | `3000`                  |
| `WEBHOOK_SYNC_INTERVAL`  | Federation sync interval (min) | `15`                    |
| `ALLOW_LOCAL_FEDERATION` | Allow localhost/private IPs    | `false`                 |
| `GITHUB_CLIENT_ID`       | GitHub OAuth App Client ID     | —                       |
| `GITHUB_CLIENT_SECRET`   | GitHub OAuth App Secret        | —                       |
| `GOOGLE_CLIENT_ID`       | Google OAuth Client ID         | —                       |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth Client Secret     | —                       |
| `VITE_GIPHY_API_KEY`     | GIPHY API key for stickers     | —                       |

---

## Project Structure

```
zlog/
├── client/           # Frontend (FSD Architecture)
│   └── src/
│       ├── app/      # Entry point, router, providers
│       ├── pages/    # Page components
│       ├── widgets/  # Header, footer, sidebar
│       ├── features/ # Auth, comments, theme
│       ├── entities/ # PostCard, CategoryBadge
│       └── shared/   # UI components, API client, i18n, utilities
│           └── ui/__tests__/ # Component unit tests (Vitest + Testing Library)
├── server/           # Backend (Hono)
│   └── src/
│       ├── __tests__/ # API integration tests (Vitest)
│       ├── db/       # Schema, migrations
│       ├── routes/   # API routes
│       ├── middleware/# Auth, error handlers
│       ├── services/ # Business logic
│       └── lib/      # Utilities
├── shared/           # Shared types
├── Dockerfile
├── docker-compose.yml
└── Caddyfile
```

---

## Federation Protocol Summary

For developers who want to integrate with ZLOG's federation:

### Public Endpoints (No Auth Required)

| Method | Endpoint                               | Description                            |
| ------ | -------------------------------------- | -------------------------------------- |
| `GET`  | `/api/federation/info`                 | Blog metadata                          |
| `GET`  | `/api/federation/categories`           | Public categories                      |
| `GET`  | `/api/federation/categories/:id/posts` | Posts in a category                    |
| `GET`  | `/api/federation/posts/:id`            | Single post detail (live verification) |
| `POST` | `/api/federation/subscribe`            | Subscribe to a category                |
| `POST` | `/api/federation/unsubscribe`          | Unsubscribe                            |
| `POST` | `/api/federation/webhook`              | Receive content updates                |

### Webhook Payload

```json
{
  "event": "post.published",
  "post": {
    "id": "019c...",
    "title": "Hello World",
    "slug": "hello-world",
    "content": "# Hello\n\nThis is my first post.",
    "excerpt": "This is my first post.",
    "coverImage": "/uploads/cover.webp",
    "status": "published",
    "createdAt": "2026-02-14T00:00:00.000Z",
    "updatedAt": "2026-02-14T00:00:00.000Z"
  },
  "categoryId": "019c...",
  "siteUrl": "https://publisher-blog.com"
}
```

### Webhook Events

| Event              | Trigger                                 |
| ------------------ | --------------------------------------- |
| `post.published`   | New post published or draft → published |
| `post.updated`     | Published post content updated          |
| `post.deleted`     | Post deleted or published → draft       |
| `post.unpublished` | Post status changed from published      |

---

## Links

- **Live Demo**: [https://zlog.pe.kr](https://zlog.pe.kr)
- **GitHub**: [https://github.com/zebra0303/zlog](https://github.com/zebra0303/zlog)
- **License**: MIT

---

<p align="center">
  <strong>ZLOG</strong> — Every story you care about, right on your blog.
</p>
