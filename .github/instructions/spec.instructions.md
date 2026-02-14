# 🦓 zlog — Zebra Blog System 구현 명세서

## 1. 프로젝트 개요

**zlog**는 분산형 자체 호스팅 개인 블로그 시스템입니다. 각 사용자가 자신의 서버에 zlog를 설치하고, 다른 zlog 블로그의 카테고리를 **구독(Follow)**하면 새 글이 자동으로 동기화됩니다. ActivityPub과 유사한 컨셉이지만 HTTP API 기반의 가벼운 Federation 프로토콜을 사용합니다.

### 핵심 목표

- **분산 블로그**: 각자의 서버에 독립 설치, 서버 간 Federation
- **원클릭 설치**: Docker Compose로 `docker compose up -d` 한 줄 실행
- **모던 기술 스택**: React 19, Hono, SQLite, TypeScript strict
- **FSD 아키텍처**: Feature-Sliced Design으로 체계적인 코드 구조
- **🦓 얼룩말 브랜딩**: 귀여운 카툰 얼룩말 마스코트

---

## 2. 기술 스택 (반드시 준수)

| 영역        | 기술                                                                                                        | 버전                         |
| ----------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Language    | TypeScript (strict mode)                                                                                    | 5.7+                         |
| Frontend    | React + Vite                                                                                                | React 19, Vite 6             |
| UI Library  | shadcn/ui 스타일 (Radix UI + Tailwind CSS)                                                                  | Radix latest, Tailwind v4    |
| CSS         | Tailwind CSS v4 (`@tailwindcss/vite` 플러그인)                                                              | 4.x                          |
| Backend     | Hono                                                                                                        | 4.x                          |
| Database    | SQLite + Drizzle ORM                                                                                        | better-sqlite3 + drizzle-orm |
| State       | Zustand                                                                                                     | 5.x                          |
| Routing     | React Router                                                                                                | v7                           |
| Lint        | ESLint v9 Flat Config + typescript-eslint                                                                   | ESLint 9.x                   |
| Format      | Prettier v3 + prettier-plugin-tailwindcss                                                                   | Prettier 3.x                 |
| Infra       | Docker + Docker Compose + Caddy                                                                             | node:22-alpine               |
| Markdown    | unified + remark-parse + remark-gfm + remark-rehype + rehype-highlight + rehype-sanitize + rehype-stringify | 최신                         |
| SEO         | react-helmet-async                                                                                          | 최신                         |
| Icons       | lucide-react                                                                                                | 최신                         |
| ID 생성     | UUID v7 (uuidv7 패키지)                                                                                     | 최신                         |
| JWT         | jose                                                                                                        | 최신                         |
| 이미지 처리 | sharp                                                                                                       | 최신                         |

---

## 3. 프로젝트 구조 — FSD (Feature-Sliced Design)

반드시 [FSD 아키텍처](https://feature-sliced.design/kr/docs/get-started/overview)를 따릅니다.

```
zlog/
├── client/                       # 프론트엔드
│   ├── public/
│   │   ├── favicons/             # 🦓 얼룩말 favicon (ico, svg, png 세트)
│   │   │   ├── favicon.svg       # SVG 벡터 favicon
│   │   │   ├── favicon.ico       # 멀티사이즈 ico (16+32+48)
│   │   │   ├── favicon-16x16.png
│   │   │   ├── favicon-32x32.png
│   │   │   ├── apple-touch-icon.png   # 180x180
│   │   │   ├── android-chrome-192x192.png
│   │   │   └── android-chrome-512x512.png
│   │   ├── images/
│   │   │   ├── zlog-icon.svg          # 🦓 마스코트 아이콘 (512x512)
│   │   │   └── zlog-default-avatar.svg # 기본 프로필 아바타 (256x256)
│   │   └── site.webmanifest
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       │
│       ├── app/                  # Layer 1: 앱 초기화
│       │   ├── App.tsx           # 루트 컴포넌트
│       │   ├── providers/        # HelmetProvider 등
│       │   ├── router/           # React Router 설정, AppLayout
│       │   └── styles/
│       │       └── global.css    # Tailwind v4 import + 커스텀 테마 변수
│       │
│       ├── pages/                # Layer 2: 페이지
│       │   ├── home/ui/          # 메인 페이지 (카테고리 필터 + 게시글 목록 + 페이지네이션)
│       │   ├── post-detail/ui/   # 게시글 상세 (마크다운 렌더링)
│       │   ├── post-editor/ui/   # 글쓰기/수정 (마크다운 에디터 + 실시간 미리보기)
│       │   ├── profile/ui/       # 프로필 페이지 (소셜 링크, 통계)
│       │   ├── category-detail/ui/ # 카테고리 상세 (소개 + 해당 카테고리 글 목록)
│       │   ├── settings-profile/ui/ # 프로필 설정 (아바타 업로드, 소셜 링크 편집)
│       │   ├── admin/ui/         # 관리자 설정 (SEO, 표시 설정, Federation)
│       │   ├── login/ui/         # 로그인 페이지
│       │   └── not-found/ui/     # 404 페이지
│       │
│       ├── widgets/              # Layer 3: 독립 UI 블록
│       │   ├── header/ui/        # 글로벌 헤더 (로고 + 네비게이션 + 모바일 햄버거 메뉴)
│       │   ├── footer/ui/        # 글로벌 푸터
│       │   ├── sidebar/ui/       # 사이드바 (프로필 카드, 카테고리 목록)
│       │   ├── post-list/ui/     # 게시글 목록 위젯
│       │   ├── profile-header/ui/ # 프로필 헤더 (아바타 + 이름 + 통계)
│       │   └── category-showcase/ui/ # 카테고리 쇼케이스
│       │
│       ├── features/             # Layer 4: 사용자 기능 (각각 api/model/ui 하위 구조)
│       │   ├── auth/             # 로그인/로그아웃 (Zustand store)
│       │   ├── create-post/      # 글 작성
│       │   ├── edit-post/        # 글 수정
│       │   ├── delete-post/      # 글 삭제
│       │   ├── search-posts/     # 글 검색
│       │   ├── toggle-theme/     # 다크/라이트 테마 전환 (Zustand store)
│       │   ├── follow-category/  # 외부 블로그 카테고리 구독
│       │   ├── comment/          # 댓글 작성, 대댓글, 좋아요
│       │   ├── post-editor/      # 마크다운 에디터 핵심 로직
│       │   ├── edit-profile/     # 프로필 수정
│       │   ├── feed/             # 피드 (구독한 원격 글 포함)
│       │   └── manage-categories/ # 카테고리 CRUD
│       │
│       ├── entities/             # Layer 5: 비즈니스 엔티티
│       │   ├── post/             # Post 타입, PostCard UI, API 함수
│       │   ├── category/         # Category 타입, CategoryBadge UI
│       │   ├── tag/              # Tag 타입, TagBadge UI
│       │   ├── comment/          # Comment 타입, CommentThread UI
│       │   ├── user/             # User 타입, UserAvatar, SocialLinks UI
│       │   └── feed/             # Feed 엔티티 (로컬 + 원격 글 통합)
│       │
│       └── shared/               # Layer 6: 공용
│           ├── api/client.ts     # API 클라이언트 (fetch 래퍼, JWT 토큰 관리)
│           ├── config/           # 상수 (페이지당 글 수, 최대 댓글 깊이 등)
│           ├── lib/
│           │   ├── cn.ts         # clsx + tailwind-merge 유틸
│           │   ├── formatDate.ts # 한국어 날짜 포맷 + 상대시간
│           │   └── markdown/
│           │       ├── parser.ts # unified 마크다운 파이프라인
│           │       └── plugins/
│           │           └── remarkEmbed.ts  # 커스텀 임베드 (@[youtube], @[codepen], @[codesandbox])
│           ├── types/            # 공용 TypeScript 타입
│           └── ui/               # 공용 UI 컴포넌트
│               ├── Button.tsx    # shadcn 스타일 (cva variants)
│               ├── Input.tsx
│               ├── Card.tsx      # Card, CardHeader, CardContent
│               ├── Badge.tsx
│               ├── Textarea.tsx
│               ├── Skeleton.tsx
│               ├── LazyImage.tsx # IntersectionObserver 기반 Lazy Loading
│               ├── Pagination.tsx
│               ├── SEOHead.tsx   # react-helmet-async 래퍼
│               ├── ZlogLogo.tsx  # 🦓 얼룩말 마스코트 SVG 컴포넌트
│               ├── DefaultAvatar.tsx # 기본 아바타 SVG 컴포넌트
│               └── index.ts      # barrel export
│
├── server/                       # 백엔드
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Hono 서버 엔트리포인트
│       ├── db/
│       │   ├── index.ts          # better-sqlite3 연결 (WAL mode)
│       │   ├── schema.ts         # Drizzle ORM 스키마 (13개 테이블)
│       │   ├── migrate.ts        # 마이그레이션 실행
│       │   └── migrations/       # Drizzle 마이그레이션 파일
│       ├── routes/
│       │   ├── auth.ts           # POST /login, GET /me
│       │   ├── posts.ts          # CRUD + 페이지네이션 + Webhook 발송
│       │   ├── categories.ts     # CRUD + 통계
│       │   ├── comments.ts       # 트리 구조 + 좋아요
│       │   ├── settings.ts       # 프로필 + 소셜 링크 + 사이트 설정 + 아바타 업로드
│       │   └── federation.ts     # info, categories, subscribe, webhook
│       ├── middleware/
│       │   ├── auth.ts           # JWT 인증 (jose, Bearer token)
│       │   └── errorHandler.ts   # 글로벌 에러 핸들링
│       ├── services/
│       │   ├── bootstrap.ts      # 첫 실행 시 테이블 생성 + 관리자 계정 생성
│       │   └── feedService.ts    # Webhook 배포 (구독자들에게 이벤트 전송)
│       ├── jobs/                 # 주기적 폴링 동기화 (향후 구현)
│       └── lib/
│           ├── uuid.ts           # UUID v7 생성
│           ├── slug.ts           # URL-safe 슬러그 생성 (한글 지원)
│           └── password.ts       # SHA-512 해싱 + timing-safe 비교
│
├── shared/                       # 프론트/백 공유 타입
│   └── types/
│       ├── index.ts              # 모든 타입 barrel export
│       └── socialPlatform.ts     # 소셜 플랫폼 정의 (13종)
│
├── Dockerfile                    # 멀티 스테이지 빌드 (client-build → server-build → production)
├── docker-compose.yml            # zlog + Caddy(HTTPS) + Backup 서비스
├── Caddyfile                     # 자동 HTTPS 리버스 프록시
├── .env.example                  # 환경변수 템플릿
├── .dockerignore
├── .gitignore
├── eslint.config.mjs             # ESLint v9 Flat Config
├── .prettierrc                   # Prettier v3
├── tsconfig.base.json            # TypeScript 공용 설정
├── package.json                  # 모노레포 워크스페이스 루트
└── README.md                     # 설치 가이드 (Docker + 로컬 개발 + 프로덕션)
```

---

## 4. 데이터베이스 스키마 (SQLite + Drizzle ORM)

총 13개 테이블을 설계합니다. ID는 모두 UUID v7 (시간순 정렬 가능).

### 4.1 `owner` — 블로그 소유자 (1명)

| 컬럼               | 타입                 | 설명                     |
| ------------------ | -------------------- | ------------------------ |
| id                 | TEXT PK              | UUID v7                  |
| email              | TEXT UNIQUE NOT NULL | 로그인 이메일            |
| passwordHash       | TEXT NOT NULL        | SHA-512 해시 (salt:hash) |
| blogHandle         | TEXT UNIQUE NOT NULL | 블로그 핸들 (@handle)    |
| siteUrl            | TEXT NOT NULL        | 외부 URL (Federation용)  |
| displayName        | TEXT NOT NULL        | 표시 이름                |
| bio                | TEXT                 | 한 줄 소개               |
| aboutMe            | TEXT                 | 상세 자기소개 (마크다운) |
| jobTitle           | TEXT                 | 직함                     |
| company            | TEXT                 | 소속                     |
| location           | TEXT                 | 활동 지역                |
| avatarUrl          | TEXT                 | 프로필 이미지 URL        |
| avatarOriginalName | TEXT                 | 업로드된 원본 파일명     |
| avatarMimeType     | TEXT                 | 이미지 MIME 타입         |
| avatarSizeBytes    | INTEGER              | 원본 크기                |
| blogTitle          | TEXT                 | 블로그 제목              |
| blogDescription    | TEXT                 | 블로그 설명              |
| createdAt          | TEXT                 | 생성 일시                |
| updatedAt          | TEXT                 | 수정 일시                |

### 4.2 `socialLinks` — 소셜 링크

| 컬럼      | 타입              | 설명                             |
| --------- | ----------------- | -------------------------------- |
| id        | TEXT PK           | UUID v7                          |
| platform  | TEXT NOT NULL     | 플랫폼 키 (github, twitter, ...) |
| url       | TEXT NOT NULL     | 링크 URL                         |
| label     | TEXT              | 커스텀 레이블                    |
| sortOrder | INTEGER DEFAULT 0 | 정렬 순서                        |

**지원 플랫폼 (13종)**: github, twitter (X), instagram, linkedin, youtube, facebook, threads, mastodon, bluesky, website, email, rss, custom

### 4.3 `categories` — 카테고리

| 컬럼                 | 타입                 | 설명                        |
| -------------------- | -------------------- | --------------------------- |
| id                   | TEXT PK              |                             |
| name                 | TEXT NOT NULL        | 카테고리 이름               |
| slug                 | TEXT UNIQUE NOT NULL | URL 슬러그                  |
| description          | TEXT                 | 짧은 설명                   |
| longDescription      | TEXT                 | 상세 설명 (마크다운)        |
| coverImage           | TEXT                 | 커버 이미지 URL             |
| sortOrder            | INTEGER DEFAULT 0    | 정렬 순서                   |
| isPublic             | BOOLEAN DEFAULT true | 공개 여부 (Federation 노출) |
| createdAt, updatedAt | TEXT                 |                             |

### 4.4 `posts` — 게시글

| 컬럼                            | 타입                           | 설명            |
| ------------------------------- | ------------------------------ | --------------- |
| id                              | TEXT PK                        | UUID v7         |
| categoryId                      | TEXT FK → categories           |                 |
| title                           | TEXT NOT NULL                  | 제목            |
| slug                            | TEXT UNIQUE NOT NULL           | URL 슬러그      |
| content                         | TEXT NOT NULL                  | 마크다운 본문   |
| excerpt                         | TEXT                           | 발췌문 (200자)  |
| coverImage                      | TEXT                           | 커버 이미지 URL |
| status                          | TEXT (draft/published/deleted) |                 |
| viewCount                       | INTEGER DEFAULT 0              |                 |
| createdAt, updatedAt, deletedAt | TEXT                           |                 |

**인덱스**: status, categoryId, createdAt

### 4.5 `tags` + `postTags`

- `tags`: id, name (UNIQUE), slug (UNIQUE)
- `postTags`: postId FK, tagId FK, UNIQUE(postId, tagId)

### 4.6 `comments` — 댓글 (대댓글 지원)

| 컬럼                            | 타입                      | 설명                       |
| ------------------------------- | ------------------------- | -------------------------- |
| id                              | TEXT PK                   |                            |
| postId                          | TEXT FK → posts (CASCADE) |                            |
| authorName                      | TEXT NOT NULL             | 작성자 이름                |
| authorEmail                     | TEXT NOT NULL             | 작성자 이메일              |
| authorUrl                       | TEXT                      | 작성자 웹사이트            |
| authorAvatarUrl                 | TEXT                      | 작성자 아바타              |
| content                         | TEXT NOT NULL             | 내용 (최대 2,000자)        |
| parentId                        | TEXT                      | 부모 댓글 ID (최대 깊이 3) |
| isEdited                        | BOOLEAN DEFAULT false     |                            |
| createdAt, updatedAt, deletedAt | TEXT                      |                            |

### 4.7 `commentLikes` — 댓글 좋아요

- id, commentId FK (CASCADE), visitorId, createdAt
- UNIQUE(commentId, visitorId) — 중복 방지

### 4.8~4.12 Federation 관련 테이블

- **`remoteBlogs`**: 외부 블로그 캐시 (id, siteUrl UNIQUE, displayName, blogTitle, avatarUrl, lastFetchedAt)
- **`remoteCategories`**: 외부 카테고리 캐시 (remoteBlogId FK, remoteId, name, slug, description)
- **`categorySubscriptions`**: 구독 관계 (localCategoryId FK, remoteCategoryId FK, isActive, lastSyncedAt)
  - UNIQUE(localCategoryId, remoteCategoryId)
- **`remotePosts`**: 외부 글 캐시 (remoteUri UNIQUE, remoteBlogId FK, remoteCategoryId FK, localCategoryId FK, title, content, remoteStatus enum[published/draft/deleted/unreachable], ...)
- **`subscribers`**: 다른 서버가 나를 구독한 기록 (categoryId FK, subscriberUrl, callbackUrl, isActive)
  - UNIQUE(categoryId, subscriberUrl)

### 4.13 `siteSettings` — 사이트 설정 (key-value)

- id, key (UNIQUE), value, updatedAt
- 기본 키: posts_per_page, lazy_load_images, blog_title, seo_description, seo_og_image, webhook_sync_interval, default_theme

---

## 5. API 명세

### 5.1 인증

| Method | Path            | 설명                                   | 인증   |
| ------ | --------------- | -------------------------------------- | ------ |
| POST   | /api/auth/login | `{email, password}` → `{token, owner}` | -      |
| GET    | /api/auth/me    | 현재 로그인된 사용자 정보              | Bearer |

### 5.2 게시글

| Method | Path                            | 설명                                                 | 인증   |
| ------ | ------------------------------- | ---------------------------------------------------- | ------ |
| GET    | /api/posts?page=N&category=slug | 목록 (페이지네이션)                                  | -      |
| GET    | /api/posts/:slug                | 상세 (조회수 +1)                                     | -      |
| POST   | /api/posts                      | 작성 `{title, content, categoryId?, status?, tags?}` | Bearer |
| PUT    | /api/posts/:id                  | 수정                                                 | Bearer |
| DELETE | /api/posts/:id                  | 소프트 삭제 (status→deleted)                         | Bearer |

게시글이 published 상태로 변경되면 해당 카테고리의 subscribers에게 Webhook 전송.

### 5.3 카테고리

| Method | Path                  | 설명                                                        | 인증   |
| ------ | --------------------- | ----------------------------------------------------------- | ------ |
| GET    | /api/categories       | 공개 카테고리 목록 (postCount, followerCount 서브쿼리 포함) | -      |
| GET    | /api/categories/:slug | 카테고리 상세                                               | -      |
| POST   | /api/categories       | 생성 `{name, description?, longDescription?, coverImage?}`  | Bearer |
| PUT    | /api/categories/:id   | 수정                                                        | Bearer |
| DELETE | /api/categories/:id   | 삭제 (해당 글은 categoryId→null)                            | Bearer |

### 5.4 댓글

| Method | Path                                    | 설명                                                 | 인증 |
| ------ | --------------------------------------- | ---------------------------------------------------- | ---- |
| GET    | /api/posts/:postId/comments?visitorId=X | 트리 구조 반환 (좋아요 수, 내 좋아요 여부 포함)      | -    |
| POST   | /api/posts/:postId/comments             | 작성 `{authorName, authorEmail, content, parentId?}` | -    |
| POST   | /api/comments/:id/like                  | 좋아요 토글 `{visitorId}`                            | -    |
| DELETE | /api/comments/:id                       | 소프트 삭제                                          | -    |

### 5.5 프로필 & 설정

| Method | Path                      | 설명                                               | 인증   |
| ------ | ------------------------- | -------------------------------------------------- | ------ |
| GET    | /api/profile              | 공개 프로필 (socialLinks + stats 포함)             | -      |
| PUT    | /api/profile              | 프로필 수정                                        | Bearer |
| POST   | /api/profile/avatar       | 아바타 업로드 (FormData, sharp→WebP 변환+리사이즈) | Bearer |
| DELETE | /api/profile/avatar       | 아바타 삭제                                        | Bearer |
| GET    | /api/profile/social-links | 소셜 링크 목록                                     | -      |
| PUT    | /api/profile/social-links | 소셜 링크 전체 교체 `{links: [...]}`               | Bearer |
| GET    | /api/settings             | 사이트 설정 (key-value)                            | -      |
| PUT    | /api/settings             | 사이트 설정 저장                                   | Bearer |

**아바타 업로드 처리**:

- 검증: JPEG/PNG/WebP/GIF, 최대 5MB
- sharp로 리사이즈 + WebP 변환
- 저장: `uploads/avatar/original/{uuid}.{ext}`, `uploads/avatar/256/{uuid}.webp`, `uploads/avatar/64/{uuid}.webp`

### 5.6 Federation

| Method | Path                                           | 설명                                                 |
| ------ | ---------------------------------------------- | ---------------------------------------------------- |
| GET    | /api/federation/info                           | 이 블로그 정보 (siteUrl, displayName, ...)           |
| GET    | /api/federation/categories                     | 공개 카테고리 목록                                   |
| GET    | /api/federation/categories/:id/posts?since=ISO | 카테고리별 게시글 (since 이후 변경분)                |
| GET    | /api/federation/posts/:id                      | 게시글 상세                                          |
| POST   | /api/federation/subscribe                      | 구독 요청 `{categoryId, subscriberUrl, callbackUrl}` |
| POST   | /api/federation/unsubscribe                    | 구독 해제 `{categoryId, subscriberUrl}`              |
| POST   | /api/federation/webhook                        | 이벤트 수신 `{event, post, categoryId, siteUrl}`     |

**Webhook 이벤트**: `post.published`, `post.updated`, `post.deleted`, `post.unpublished`

**동기화 전략**: Webhook (실시간) + 주기적 폴링 (15분, 설정 가능, 실패 대비)

### 5.7 기타

| Method | Path         | 설명                         |
| ------ | ------------ | ---------------------------- |
| GET    | /api/health  | `{status: "ok", timestamp}`  |
| GET    | /robots.txt  | 크롤러 허용 규칙             |
| GET    | /sitemap.xml | 자동 생성 (게시글, 카테고리) |

---

## 6. 프론트엔드 상세

### 6.1 라우팅

| 경로              | 페이지                                          |
| ----------------- | ----------------------------------------------- |
| `/`               | 홈 (카테고리 필터 + 게시글 목록 + 페이지네이션) |
| `/posts/:slug`    | 게시글 상세 (마크다운 렌더링)                   |
| `/write`          | 게시글 작성 (마크다운 에디터)                   |
| `/profile`        | 블로그 프로필                                   |
| `/category/:slug` | 카테고리 상세 + 해당 글 목록                    |
| `/login`          | 로그인                                          |
| `/admin`          | 관리자 설정                                     |
| `/settings`       | 프로필 설정 (아바타, 소셜 링크)                 |

### 6.2 마크다운 에디터

- **3가지 뷰 모드**: Edit (에디터만), Split (좌우 분할), Preview (미리보기만)
- **실시간 미리보기**: 내용 변경 후 150ms 디바운스로 렌더링
- **통합 파이프라인**: unified → remark-parse → remark-gfm → remark-rehype → rehype-highlight → rehype-sanitize → rehype-stringify
- **커스텀 임베드 문법**:
  - `@[youtube](VIDEO_ID_OR_URL)` → 유튜브 (youtube-nocookie.com)
  - `@[codepen](user/pen/id)` → CodePen
  - `@[codesandbox](SANDBOX_ID)` → CodeSandbox
- **코드 하이라이팅**: rehype-highlight (언어 자동 감지)
- **XSS 방지**: rehype-sanitize (iframe은 임베드 도메인만 허용)

### 6.3 다크/라이트 테마

- Zustand store에서 isDark 상태 관리
- `document.documentElement.classList.toggle("dark")` 사용
- localStorage에 `zlog_theme` 키로 저장
- 시스템 설정 자동 감지: `prefers-color-scheme: dark`
- CSS 변수로 테마 색상 정의 (`--color-primary`, `--color-background`, ...)

### 6.4 반응형 디자인

```
Desktop (>960px):  2컬럼 레이아웃 (메인 + 사이드바)
Tablet (641-960px): 1컬럼, 사이드바 2열 그리드로 변환
Mobile (<640px):   1컬럼, 햄버거 메뉴, 세로 카드 레이아웃
```

- 모바일: 햄버거 메뉴 (홈/프로필/관리/다크모드)
- 터치 친화적 버튼 (최소 44px)
- 접근성: focus-visible, 시맨틱 HTML, ARIA 레이블

### 6.5 이미지 Lazy Loading

- `IntersectionObserver` 기반 (`rootMargin: "200px"`)
- 뷰포트 진입 200px 전부터 로딩 시작
- 로드 완료 시 fade-in (0.4s opacity 전환)
- 로딩 중 파스텔 그라데이션 플레이스홀더
- 관리자 설정에서 on/off 가능

### 6.6 SEO

- `react-helmet-async`로 페이지별 메타태그 동적 설정
- Open Graph (`og:title`, `og:description`, `og:image`, `og:type`)
- 게시글 페이지: `article:published_time`, `article:author`, `article:tag`
- `/sitemap.xml` 자동 생성
- `/robots.txt` 크롤러 허용

### 6.7 공용 UI 컴포넌트 스타일

- shadcn/ui 스타일: Radix UI 프리미티브 + `cva` (class-variance-authority) + `clsx` + `tailwind-merge`
- Button variants: default(보라), outline, ghost, destructive, link
- Card: rounded-xl + border + shadow
- 색상 팔레트:
  - Primary: `#6C5CE7` (보라), Primary Light: `#A29BFE`
  - Accent: `#FF6B6B` (빨간)
  - Background: `#FAF9FF`, Surface: `#FFFFFF`
  - Dark mode: Background `#0F0F14`, Surface `#1A1A24`

---

## 7. 관리자 설정 페이지

### 7.1 표시 설정

- **페이지당 게시글 수**: 3, 5, 10, 15, 20, 30 선택 (select)
- **이미지 Lazy Loading**: on/off 토글 스위치

### 7.2 SEO 설정

- **블로그 제목**: text input
- **메타 설명**: textarea (최대 160자, 글자 수 실시간 표시)
- **Google 검색 미리보기**: 실시간 프리뷰 (제목 / URL / 설명)

### 7.3 Federation 설정

- **사이트 URL**: 읽기 전용 (환경변수에서 설정)
- **Webhook 동기화 주기**: 5분, 15분, 30분, 1시간 선택

---

## 8. 프로필 이미지 업로드

### 저장 구조

```
uploads/avatar/
  original/{uuid}.{ext}   ← 원본 보관
  256/{uuid}.webp          ← 프로필 표시용
  64/{uuid}.webp           ← 댓글/아이콘용
```

### 처리 흐름

1. 클라이언트에서 FormData로 전송
2. 검증: JPEG/PNG/WebP/GIF, 최대 5MB
3. sharp로 리사이즈 + WebP 변환 (256px, 64px)
4. 기존 이미지 삭제 후 새 이미지 저장
5. DB에 avatarUrl 업데이트
6. 즉시 미리보기 (Optimistic UI)

---

## 9. 🦓 얼룩말 브랜딩

### 마스코트 아이콘 (`zlog-icon.svg`, 512x512)

- 보라색 그라데이션 원형 배경 (#6C5CE7 → #A29BFE)
- 귀여운 카툰 얼룩말 얼굴: 분홍 귀, 검은 갈기, 흰 얼굴, 줄무늬, 큰 눈(흰 하이라이트), 검은 코, 미소, 분홍 볼터치
- 우측 하단 빨간 원형 배지에 흰색 "Z" 글자
- SVG React 컴포넌트 (`ZlogLogo`)

### 기본 아바타 (`zlog-default-avatar.svg`, 256x256)

- 파스텔 원형 배경 (#E8E5FF → #D4D0FB)
- 단순화된 얼룩말 얼굴 (원형 클리핑)
- SVG React 컴포넌트 (`DefaultAvatar`)
- 프로필 이미지 미설정 시 사용

### Favicon 세트

Pillow로 프로그래매틱 생성 (보라 배경 + 얼룩말 얼굴):

- `favicon.svg` (벡터)
- `favicon.ico` (16+32+48px 멀티사이즈)
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `favicon-64x64.png`, `favicon-128x128.png`
- `apple-touch-icon.png` (180x180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`

---

## 10. Docker & 배포

### Dockerfile (멀티 스테이지)

```
Stage 1 (client-build): node:22-alpine → npm ci → vite build
Stage 2 (server-build): node:22-alpine → npm ci → tsc build
Stage 3 (production):   node:22-alpine → 런타임 의존성 + client/dist + server/dist
```

### docker-compose.yml

```yaml
services:
  zlog: # 메인 앱 (포트 3000, volume: zlog-data, zlog-uploads)
  caddy: # HTTPS 프록시 (profiles: [production], 포트 80/443)
  backup: # 자동 백업 (profiles: [backup], 매일, 7일 보관)
```

### 사용법

```bash
# 최소 실행
cp .env.example .env && docker compose up -d

# HTTPS 프로덕션
docker compose --profile production up -d

# 자동 백업 포함
docker compose --profile backup up -d
```

### .env.example 항목

```env
PORT=3000
SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
ADMIN_DISPLAY_NAME=Blog Owner
ADMIN_BLOG_HANDLE=admin
JWT_SECRET=please-change-this
WEBHOOK_SYNC_INTERVAL=15
```

---

## 11. 코드 품질 설정

### ESLint v9 Flat Config (`eslint.config.mjs`)

- `@eslint/js` recommended
- `typescript-eslint` strictTypeChecked + stylisticTypeChecked
- `eslint-plugin-react` (client만, react-jsx transform)
- `eslint-plugin-react-hooks` recommended
- `eslint-config-prettier` (마지막)
- 커스텀: `_` 접두어 unused 변수 허용, restrict-template-expressions off

### Prettier v3 (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### TypeScript (`tsconfig.base.json`)

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `moduleResolution: "bundler"`
- `target: "ES2022"`

---

## 12. Federation 동작 상세

### 구독 흐름 (B가 A의 카테고리를 구독)

1. B → `GET A/api/federation/info` → A 블로그 정보 확인
2. B → `GET A/api/federation/categories` → A의 카테고리 목록 조회
3. B → `POST A/api/federation/subscribe` `{categoryId, subscriberUrl, callbackUrl}` → 구독 등록
4. A가 새 글 발행 → `POST B/callbackUrl` (webhook) `{event: "post.published", post, categoryId}`
5. B가 webhook 수신 → remotePosts 테이블에 캐시
6. 폴링 보완: B가 주기적으로 `GET A/api/federation/categories/:id/posts?since=...` 호출

### 원격 글 표시

- 로컬 카테고리 페이지에 로컬 글과 원격 글을 함께 표시
- 원격 글은 점선 테두리 + 출처 블로그 이름 배지
- 삭제된 원격 글: 회색 + "원본이 삭제됨" 표시
- 접근 불가: "원본 서버에 접근할 수 없음" 표시

### 전역 URI

모든 게시글은 `https://{host}/posts/{uuid-v7}` 형태의 전역 고유 URI를 가짐.

---

## 13. README 작성 요구사항

처음 사용하는 개발자가 **README만 읽고 5분 안에 실행**할 수 있도록 작성:

- **빠른 시작 (Docker)**: 3단계 (clone → .env → docker compose up)
- **로컬 개발**: npm install → npm run dev
- **프로덕션 배포**: Docker + Caddy (HTTPS) / Docker 단독 / Node.js 직접 실행
- **자동 백업**: docker compose --profile backup
- **환경변수 표**: 모든 변수 기본값 + 설명
- **프로젝트 구조**: FSD 레이어 설명 포함 트리
- **주요 기능**: 마크다운 에디터, Federation, 댓글, 테마, 반응형, SEO
- **기술 스택 표**: 영역별 기술 + 선택 이유
- **Federation 설명**: API + 구독 흐름 예시
- **API 문서**: 전체 엔드포인트 목록
- **문제 해결 FAQ**: Docker 안 됨, 데이터 초기화, 이미지 업로드, Federation 안 됨, 포트 변경

---

## 14. 구현 순서 (Phase)

1. **Phase 1**: 프로젝트 초기화 — 모노레포 설정, ESLint/Prettier, TypeScript, 공유 타입
2. **Phase 2**: 데이터베이스 — Drizzle 스키마, bootstrap (자동 테이블 생성 + 관리자 계정)
3. **Phase 3**: 백엔드 API — auth, posts, categories, comments, settings (CRUD 전체)
4. **Phase 4**: 프론트엔드 기초 — App, Router, 공용 UI 컴포넌트, 테마
5. **Phase 5**: 페이지 구현 — Home, PostDetail, PostEditor, Profile, Admin, Settings, Login
6. **Phase 6**: 마크다운 에디터 — unified 파이프라인, 임베드 플러그인, 실시간 미리보기
7. **Phase 7**: 프로필 이미지 + 소셜 링크 — 아바타 업로드, 소셜 링크 CRUD, 프로필 설정 UI
8. **Phase 8**: Federation — federation API, 구독 프로토콜, webhook, 원격 글 캐시
9. **Phase 9**: SEO + 성능 — 메타태그, sitemap, robots.txt, Lazy Loading, 코드 스플리팅
10. **Phase 10**: 🦓 브랜딩 + 반응형 — 마스코트 SVG, favicon, 반응형 레이아웃, 접근성
11. **Phase 11**: Docker + 배포 — Dockerfile, docker-compose.yml, Caddyfile, .env.example
12. **Phase 12**: README + 문서화

---

## 15. 핵심 구현 원칙

- **TypeScript strict**: `strict: true`, `noUncheckedIndexedAccess`, 런타임 에러 최소화
- **FSD 레이어 규칙**: 상위 레이어만 하위 레이어를 import (pages → widgets → features → entities → shared)
- **barrel export**: 각 모듈은 `index.ts`를 통해 공개 API만 노출
- **Optimistic UI**: 좋아요, 댓글 작성 등은 서버 응답 전에 UI 즉시 반영
- **에러 처리**: 모든 API 호출에 try-catch, 사용자 친화적 에러 메시지 (한국어)
- **보안**: rehype-sanitize (XSS 방지), JWT 인증, timing-safe 비밀번호 비교, CORS 설정
- **성능**: WAL mode (SQLite 동시 읽기), Lazy Loading, 코드 스플리팅, 이미지 WebP 변환
