<img width="800" alt="zlog_wide_log" src="https://github.com/user-attachments/assets/d132c23b-08d9-42a1-bb6a-f886b05bdf07" style="margin-bottom:100px" /> <br />

The core feature of ZLOG is **Subscription & Federation**.

Subscribe to specific categories from other ZLOG users and view their posts on your own blog, styled the way you want. The idea started from a simple thought — wouldn't it be fun if friends or community members with similar interests each ran their own blogs, subscribed to each other, and built a shared feed together?

> [**Live Demo — zlog.pe.kr**](http://zlog.pe.kr)

[한국어 문서 (Korean)](./README.ko.md)

![Self-hosted](https://img.shields.io/badge/Self--hosted-black?style=flat-square)
![Federation](https://img.shields.io/badge/Federation-6C5CE7?style=flat-square)
![RSS](https://img.shields.io/badge/RSS_2.0-orange?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

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

### The Problem

Personal blogs are isolated islands. No matter how great your content is, reading posts from other blogs means relying on RSS readers or social media. Centralized platforms like Medium or WordPress.com make subscriptions easy, but they take away your data and design freedom.

### The Solution

ZLOG **builds subscription right into the blog itself**. Subscribe to another ZLOG blog from your admin dashboard, and:

1. When they publish a new post, it's **automatically delivered to your blog**
2. Your posts and subscribed posts appear **together in one feed**
3. All data is **stored on your server** — no platform lock-in
4. RSS feeds included by default — even non-ZLOG readers can subscribe

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
- **Image paste & drag-and-drop** — automatically uploaded and inserted
- **Cover image** support with upload
- **Custom embeds**: YouTube, CodePen, CodeSandbox
- **Code blocks** with syntax highlighting (highlight.js) and auto-formatting (Prettier)
- **Language label & copy button** on code blocks
- **Mermaid diagram** rendering with click-to-zoom
- **Draft / Publish** workflow with post management in admin

### Comments

- **Configurable modes**: SSO Only, Allow All (SSO + Anonymous), Anonymous Only, Disabled
- **OAuth login**: GitHub and Google for authenticated commenting
- **Anonymous comments** with password for edit/delete
- **Admin moderation**: delete any comment with confirmation
- **XSS protection**: plain text only, server-side sanitization

### Appearance

- **Light / Dark theme** toggle with system preference detection
- **Custom header & footer**: background color, background image, adjustable height
- **Responsive design**: mobile-optimized with auto-shrinking header on scroll
- **Glassmorphism** effects on header/footer

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

### Technical

- **PWA**: installable, offline-capable with service worker
- **Image optimization**: Sharp-based resize/compress to WebP
- **SQLite**: zero-config database, single file backup
- **JWT authentication** for admin
- **RESTful API** with Hono framework
- **Background sync worker**: automatic periodic federation sync with GC optimization
- **Server-proxied federation**: all cross-origin calls are server-to-server (no CORS dependency)

---

## System Architecture

```mermaid
flowchart TB
    subgraph client [Client — React 19 + Vite 6]
        direction TB
        FSD[Feature-Sliced Design]
        UI[Radix UI + Tailwind CSS v4]
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
npm install --legacy-peer-deps

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
npm install --legacy-peer-deps
npm run build
npm run start
```

---

## Environment Variables

| Variable               | Description                | Default                 |
| ---------------------- | -------------------------- | ----------------------- |
| `ADMIN_EMAIL`          | Admin login email          | `admin@example.com`     |
| `ADMIN_PASSWORD`       | Admin login password       | `admin1234`             |
| `SITE_URL`             | Public URL of your blog    | `http://localhost:3000` |
| `BLOG_TITLE`           | Blog title                 | `My Blog`               |
| `BLOG_HANDLE`          | Unique blog handle         | `admin`                 |
| `DISPLAY_NAME`         | Author display name        | `Blog Owner`            |
| `JWT_SECRET`           | Secret for JWT signing     | `change-me-...`         |
| `PORT`                 | Server port                | `3000`                  |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App Client ID | —                       |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret    | —                       |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID     | —                       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | —                       |

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
├── server/           # Backend (Hono)
│   └── src/
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

- **GitHub**: [https://github.com/zebra0303/zlog](https://github.com/zebra0303/zlog)
- **License**: MIT

---

<p align="center">
  <strong>ZLOG</strong> — Every story you care about, right on your blog.
</p>
