# zlog

분산형 자체 호스팅 개인 블로그 시스템

## 빠른 시작

```bash
# 의존성 설치
npm install

# .env 설정
cp .env.example .env  # 필요한 값 수정

# 개발 서버 시작
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3000

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | `3000` |
| `DB_PATH` | SQLite DB 경로 | `./data/zlog.db` |
| `JWT_SECRET` | JWT 서명 키 | `please-change-this` |
| `SITE_URL` | 사이트 URL | `http://localhost:3000` |
| `ADMIN_EMAIL` | 관리자 이메일 | `admin@example.com` |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | `changeme` |
| `ADMIN_DISPLAY_NAME` | 관리자 표시 이름 | `Blog Owner` |
| `ADMIN_BLOG_HANDLE` | 블로그 핸들 | `admin` |

## 기술 스택

- **프론트엔드**: React 19 + Vite 6 + Tailwind CSS v4 + Zustand 5
- **백엔드**: Hono 4 + SQLite (better-sqlite3) + Drizzle ORM
- **인프라**: Docker + Caddy (자동 HTTPS)

## 배포

```bash
docker compose up -d
```

프로덕션 (HTTPS 포함):
```bash
DOMAIN=yourdomain.com docker compose --profile production up -d
```

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
│       └── shared/   # UI, API, 유틸
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
