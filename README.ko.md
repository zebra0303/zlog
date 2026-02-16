<img width="800" alt="zlog_wide_log" src="https://github.com/user-attachments/assets/d132c23b-08d9-42a1-bb6a-f886b05bdf07" style="margin-bottom:100px" />  <br />

> **내 블로그, 내 데이터, 내 네트워크.**
> ZLOG는 블로그끼리 서로 **구독**하고 새 글을 **실시간으로 주고받는** 셀프 호스팅 블로그 시스템입니다. 플랫폼 없이도 독립적인 블로그들이 하나의 네트워크처럼 연결됩니다.

[English](./README.md)

![Self-hosted](https://img.shields.io/badge/Self--hosted-black?style=flat-square)
![Federation](https://img.shields.io/badge/Federation-6C5CE7?style=flat-square)
![RSS](https://img.shields.io/badge/RSS_2.0-orange?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

---

## 왜 ZLOG인가?

|                        | 중앙형 플랫폼        | 정적 사이트 생성기   | **ZLOG**                |
| ---------------------- | -------------------- | -------------------- | ----------------------- |
| **데이터 소유권**      | 플랫폼이 데이터 소유 | 파일은 내 것         | **모든 것이 내 것**     |
| **블로그 간 구독**     | 플랫폼 종속          | 미지원               | **Federation 내장**     |
| **RSS**                | 때때로 지원          | 플러그인 필요        | **네이티브 지원**       |
| **댓글**               | 서드파티 필요        | 서드파티 필요        | **내장 (SSO + 익명)**   |
| **설치 난이도**        | 없음                 | 빌드 파이프라인 필요 | **`docker compose up`** |
| **라즈베리 파이 지원** | 해당 없음            | 가능                 | **네이티브 지원**       |

### 문제

개인 블로그는 외딴 섬입니다. 아무리 좋은 글을 써도 다른 블로그의 글을 읽으려면 RSS 리더나 소셜 미디어에 의존해야 합니다. 네이버·티스토리 같은 중앙형 플랫폼은 구독을 쉽게 해주지만, 내 데이터와 디자인의 자유를 가져갑니다.

### 해결책

ZLOG는 **블로그 자체에 구독 기능을 내장**합니다. 관리자 대시보드에서 다른 ZLOG 블로그를 구독하면:

1. 상대 블로그에 새 글이 올라오면 **내 블로그로 자동 전달**됩니다
2. 내 글과 구독한 글이 **하나의 피드에서 함께** 보입니다
3. 모든 데이터는 **내 서버에 저장** — 플랫폼 종속 없음
4. RSS 피드도 기본 제공 — ZLOG가 아닌 독자도 구독 가능

블로그마다 독립적이면서도 서로 연결되는 **분산 블로그 네트워크**, 그것이 ZLOG입니다.

---

## 핵심 기능: 구독 & Federation

ZLOG를 특별하게 만드는 기능입니다. ZLOG 블로그를 구독하는 **두 가지 방법**이 있습니다:

```mermaid
flowchart LR
    subgraph methods [두 가지 구독 방식]
        direction TB
        zlog[ZLOG간 Federation]
        rss[RSS 피드]
    end

    subgraph zlogFeatures [ZLOG Federation]
        direction TB
        realtime[실시간 웹훅 전달]
        embedded[내 블로그에 글 임베드]
        bidirectional[양방향 통신]
        manage[관리자 대시보드 관리]
    end

    subgraph rssFeatures [RSS 피드]
        direction TB
        universal[모든 RSS 리더 호환]
        standard[표준 RSS 2.0 형식]
        percategory[카테고리별 피드]
        autodiscovery[자동 감지 지원]
    end

    zlog --> zlogFeatures
    rss --> rssFeatures
```

### ZLOG간 Federation

두 ZLOG 인스턴스가 연결되면 자동 콘텐츠 전달이 포함된 **실시간 구독**이 형성됩니다.

```mermaid
sequenceDiagram
    participant Admin as 블로그 A (구독자)
    participant BlogB as 블로그 B (발행자)

    Note over Admin,BlogB: 1단계 — 구독

    Admin->>BlogB: GET /api/federation/categories
    BlogB-->>Admin: 공개 카테고리 목록
    Admin->>BlogB: POST /api/federation/subscribe
    BlogB-->>Admin: 구독 확인
    Admin->>Admin: 구독 매핑 저장

    Note over Admin,BlogB: 2단계 — 콘텐츠 전달 (자동)

    BlogB->>BlogB: 작성자가 새 글 발행
    BlogB->>Admin: POST /api/federation/webhook
    Note right of BlogB: { event: "post.published",<br/>post: { title, content, ... } }
    Admin->>Admin: 원격 게시글로 저장
    Admin->>Admin: 로컬 카테고리에 표시

    Note over Admin,BlogB: 3단계 — 독자 경험

    Note over Admin: 방문자가 블로그 A의 카테고리 열람
    Admin->>Admin: 로컬 + 원격 게시글 병합
    Note over Admin: 원격 게시글에 블로그 B로의<br/>"원본글 보기" 링크 표시
```

#### 동작 방식

1. **구독**: 관리자 대시보드에서 원격 블로그 URL을 입력하고, 구독할 카테고리를 선택한 뒤, 로컬 카테고리에 매핑합니다. 구독 요청은 서버 간 통신으로 전송됩니다 (CORS 문제 없음).

2. **자동 전달**: 발행자가 새 글을 작성하면, ZLOG가 모든 구독자에게 웹훅을 보냅니다. 게시글 내용(이미지 URL 포함)이 로컬에 저장됩니다.

3. **통합 표시**: 원격 게시글이 로컬 게시글과 함께 카테고리 목록에 날짜순으로 표시됩니다. 각 원격 게시글에는 원본 블로그로의 "원본글 보기" 링크가 있습니다. 원격 게시글은 홈페이지의 "전체" 탭에도 표시됩니다.

4. **백그라운드 동기화**: 백그라운드 워커가 주기적으로 모든 구독을 자동 동기화합니다 (기본: 15분 간격, `WEBHOOK_SYNC_INTERVAL`로 설정 가능). 웹훅이 실패하더라도 게시글이 누락되지 않도록 보장합니다. 워커는 효율성을 위해 증분 동기화(`?since=lastSyncedAt`)를 사용합니다.

5. **수동 동기화**: 관리자 대시보드에서 언제든지 수동 동기화를 트리거하여 최신 게시글을 즉시 가져올 수 있습니다.

### RSS 피드

모든 ZLOG 블로그는 RSS 2.0 피드를 자동으로 생성합니다:

| 피드            | URL                        | 설명                             |
| --------------- | -------------------------- | -------------------------------- |
| **전체 블로그** | `/rss.xml`                 | 모든 카테고리의 최신 20개 게시글 |
| **카테고리별**  | `/category/{slug}/rss.xml` | 특정 카테고리의 최신 20개 게시글 |

- **자동 감지**: HTML head에 `<link rel="alternate">` 태그로 RSS 리더가 자동 감지
- **표준 형식**: Feedly, Inoreader, NetNewsWire 등 모든 RSS 2.0 리더와 호환
- **RSS 링크**가 사이드바와 각 카테고리 페이지에 표시

### 관리자 구독 관리

관리자 대시보드에서 완전한 구독 관리 인터페이스를 제공합니다:

- **내 구독**: 구독 중인 모든 카테고리 확인, 마지막 동기화 시간 표시
- **구독 추가**: 원격 블로그 URL 입력 → 카테고리 조회 → 선택 & 로컬 카테고리에 매핑
- **수동 동기화**: 원클릭 동기화 버튼으로 최신 게시글 가져오기
- **자동 동기화**: 백그라운드 워커가 모든 구독을 자동으로 동기화 (설정 가능한 주기)
- **구독 해제**: 더 이상 원하지 않는 구독 제거
- **구독자 목록**: 내 카테고리를 구독 중인 외부 블로그 확인

### 데이터 아키텍처

```mermaid
erDiagram
    categories ||--o{ posts : "포함"
    categories ||--o{ subscribers : "구독됨"
    categories ||--o{ categorySubscriptions : "구독"

    remoteBlogs ||--o{ remoteCategories : "보유"
    remoteCategories ||--o{ categorySubscriptions : "연결"
    remoteCategories ||--o{ remotePosts : "포함"

    remotePosts }o--o| categories : "표시됨"
    remoteBlogs ||--o{ remotePosts : "작성"

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

## 전체 기능 한눈에 보기

### 글쓰기 & 편집

- **마크다운 에디터** + 실시간 미리보기 (편집 / 분할 / 미리보기 모드)
- **이미지 붙여넣기 & 드래그 앤 드롭** — 자동 업로드 및 삽입
- **커버 이미지** 업로드 지원
- **커스텀 임베드**: YouTube, CodePen, CodeSandbox
- **코드 블록**: 구문 강조 (highlight.js) + 자동 포맷팅 (Prettier)
- **언어 라벨 & 복사 버튼** (코드 블록)
- **Mermaid 다이어그램** 렌더링 + 클릭 확대
- **초안 / 발행** 워크플로우 + 관리자 게시글 관리

### 댓글

- **설정 가능한 모드**: SSO 전용, 전체 허용 (SSO + 익명), 익명 전용, 비활성화
- **OAuth 로그인**: GitHub, Google을 통한 인증 댓글
- **익명 댓글**: 비밀번호로 수정/삭제 가능
- **관리자 중재**: 확인 후 모든 댓글 삭제 가능
- **XSS 방지**: 텍스트만 허용, 서버 측 정제

### 외관

- **라이트 / 다크 테마** 전환 + 시스템 설정 감지
- **헤더 & 푸터 커스터마이징**: 배경색, 배경 이미지, 높이 조절
- **반응형 디자인**: 모바일 최적화 + 스크롤 시 헤더 자동 축소
- **글래스모피즘** 효과 (헤더/푸터)

### 다국어 지원

- **영어** (기본) 및 **한국어** 내장
- **관리자 설정 가능**: 설정에서 언어 변경
- 날짜, 시간 경과 포맷 포함 모든 UI 문자열 번역

### SEO & 검색 최적화

- **RSS 피드** (블로그 전체 및 카테고리별)
- **sitemap.xml** 자동 생성
- **robots.txt** 설정
- **Open Graph & Twitter Card** 메타 태그
- **SEO 설정** (관리자에서 설명, OG 이미지 설정)

### 기술

- **PWA**: 설치 가능, 서비스 워커로 오프라인 지원
- **이미지 최적화**: Sharp 기반 리사이즈/압축 → WebP 변환
- **SQLite**: 설정 불필요, 단일 파일 백업
- **JWT 인증**: 관리자용
- **RESTful API**: Hono 프레임워크
- **백그라운드 동기화 워커**: 주기적 Federation 자동 동기화 + GC 최적화
- **서버 프록시 Federation**: 모든 크로스 오리진 호출이 서버 간 통신 (CORS 의존성 없음)

---

## 시스템 아키텍처

```mermaid
flowchart TB
    subgraph client [클라이언트 — React 19 + Vite 6]
        direction TB
        FSD[Feature-Sliced Design]
        UI[Radix UI + Tailwind CSS v4]
        State[Zustand 상태 관리]
        MD[Unified 마크다운 파이프라인]
    end

    subgraph server [서버 — Hono 4 + Node.js]
        direction TB
        API[RESTful API]
        Auth[JWT + OAuth2]
        Fed[Federation 엔진]
        Sync[백그라운드 동기화 워커]
        Img[Sharp 이미지 처리]
    end

    subgraph db [데이터베이스 — SQLite]
        direction TB
        Drizzle[Drizzle ORM]
        WAL[WAL 모드]
    end

    subgraph external [외부]
        direction TB
        OtherZlog[다른 ZLOG 인스턴스]
        RSSReaders[RSS 리더]
        OAuth[GitHub / Google OAuth]
    end

    client <-->|REST API| server
    server <--> db
    server <-->|웹훅| OtherZlog
    server -->|RSS XML| RSSReaders
    server <-->|OAuth2| OAuth
```

---

## 빠른 시작

### Docker 사용 (권장)

```bash
# 저장소 클론
git clone https://github.com/zebra0303/zlog.git
cd zlog

# 환경 설정
cp .env.example .env
# .env를 편집하여 설정 (관리자 이메일, 비밀번호, 사이트 URL)

# Docker Compose로 시작
docker compose up -d

# http://localhost:3000 에서 블로그 접속
```

### Docker + HTTPS (프로덕션)

```bash
# 도메인 설정 후 Caddy 리버스 프록시와 함께 시작
DOMAIN=yourblog.com docker compose --profile production up -d

# Caddy가 자동으로 SSL 인증서를 발급합니다
# https://yourblog.com 에서 접속
```

### 수동 설치

```bash
# 의존성 설치
npm install --legacy-peer-deps

# 개발 모드 (핫 리로드)
npm run dev

# 프로덕션 빌드
npm run build
npm run start
```

### 라즈베리 파이

ZLOG는 리소스가 제한된 기기에서도 동작하도록 설계되었습니다:

```bash
# 라즈베리 파이 3/4/5에서 동작
docker compose up -d

# 또는 수동 빌드 (메모리 최적화 빌드 스크립트 포함)
npm install --legacy-peer-deps
npm run build
npm run start
```

---

## 환경 변수

| 변수                   | 설명                       | 기본값                  |
| ---------------------- | -------------------------- | ----------------------- |
| `ADMIN_EMAIL`          | 관리자 로그인 이메일       | `admin@example.com`     |
| `ADMIN_PASSWORD`       | 관리자 로그인 비밀번호     | `admin1234`             |
| `SITE_URL`             | 블로그 공개 URL            | `http://localhost:3000` |
| `BLOG_TITLE`           | 블로그 제목                | `My Blog`               |
| `BLOG_HANDLE`          | 고유 블로그 핸들           | `admin`                 |
| `DISPLAY_NAME`         | 작성자 표시 이름           | `Blog Owner`            |
| `JWT_SECRET`           | JWT 서명 비밀키            | `change-me-...`         |
| `PORT`                 | 서버 포트                  | `3000`                  |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App Client ID | —                       |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret    | —                       |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID     | —                       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | —                       |

---

## 프로젝트 구조

```
zlog/
├── client/           # 프론트엔드 (FSD 아키텍처)
│   └── src/
│       ├── app/      # 엔트리포인트, 라우터, 프로바이더
│       ├── pages/    # 페이지 컴포넌트
│       ├── widgets/  # 헤더, 푸터, 사이드바
│       ├── features/ # 인증, 댓글, 테마
│       ├── entities/ # PostCard, CategoryBadge
│       └── shared/   # UI 컴포넌트, API 클라이언트, i18n, 유틸리티
├── server/           # 백엔드 (Hono)
│   └── src/
│       ├── db/       # 스키마, 마이그레이션
│       ├── routes/   # API 라우트
│       ├── middleware/# 인증, 에러 핸들러
│       ├── services/ # 비즈니스 로직
│       └── lib/      # 유틸리티
├── shared/           # 공유 타입
├── Dockerfile
├── docker-compose.yml
└── Caddyfile
```

---

## Federation 프로토콜 요약

ZLOG의 Federation과 통합하려는 개발자를 위한 안내:

### 공개 엔드포인트 (인증 불필요)

| 메서드 | 엔드포인트                             | 설명                           |
| ------ | -------------------------------------- | ------------------------------ |
| `GET`  | `/api/federation/info`                 | 블로그 메타데이터              |
| `GET`  | `/api/federation/categories`           | 공개 카테고리                  |
| `GET`  | `/api/federation/categories/:id/posts` | 카테고리의 게시글              |
| `GET`  | `/api/federation/posts/:id`            | 단일 게시글 상세 (실시간 검증) |
| `POST` | `/api/federation/subscribe`            | 카테고리 구독                  |
| `POST` | `/api/federation/unsubscribe`          | 구독 해제                      |
| `POST` | `/api/federation/webhook`              | 콘텐츠 업데이트 수신           |

### 웹훅 페이로드

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

### 웹훅 이벤트

| 이벤트             | 트리거                       |
| ------------------ | ---------------------------- |
| `post.published`   | 새 글 발행 또는 초안 → 발행  |
| `post.updated`     | 발행된 글 내용 수정          |
| `post.deleted`     | 게시글 삭제 또는 발행 → 초안 |
| `post.unpublished` | 게시글 상태가 발행에서 변경  |

---

## 링크

- **GitHub**: [https://github.com/zebra0303/zlog](https://github.com/zebra0303/zlog)
- **라이선스**: MIT

---

<p align="center">
  <strong>ZLOG</strong> — 내가 관심 있는 세상의 모든 이야기, 내 블로그에서.
</p>
