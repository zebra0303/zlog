# zlog

A distributed, self-hosted personal blog system.

[한국어 문서 (Korean)](./README.ko.md)

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env  # Edit values as needed

# Start development server
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DB_PATH` | SQLite DB path | `./data/zlog.db` |
| `JWT_SECRET` | JWT signing key | `please-change-this` |
| `SITE_URL` | Site URL | `http://localhost:3000` |
| `ADMIN_EMAIL` | Admin email | `admin@example.com` |
| `ADMIN_PASSWORD` | Admin password | `changeme` |
| `ADMIN_DISPLAY_NAME` | Admin display name | `Blog Owner` |
| `ADMIN_BLOG_HANDLE` | Blog handle | `admin` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID (optional) | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret (optional) | - |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (optional) | - |

## Tech Stack

- **Frontend**: React 19 + Vite 6 + Tailwind CSS v4 + Zustand 5
- **Backend**: Hono 4 + SQLite (better-sqlite3) + Drizzle ORM
- **Infrastructure**: Docker + Caddy (automatic HTTPS)

## Features

- Markdown editor with live preview (split/edit/preview modes)
- Custom embeds (YouTube, CodePen, CodeSandbox)
- Dark/Light theme toggle
- Responsive design with mobile support
- SEO optimization with meta tags
- Image upload with auto-resize
- Profile & social link management
- Federation protocol (subscribe, webhook, polling)
- PWA support (Service Worker + Manifest)
- Cover image upload for posts
- SSO comments via GitHub/Google OAuth
- XSS protection for user inputs
- Multi-language support (English / Korean)
- Header/Footer theme customization (per light/dark mode)

## Deployment

```bash
docker compose up -d
```

Production (with HTTPS):
```bash
DOMAIN=yourdomain.com docker compose --profile production up -d
```

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

## License

MIT
