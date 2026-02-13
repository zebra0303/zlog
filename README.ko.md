# zlog

분산형 자체 호스팅 개인 블로그 시스템

[English](./README.md)

## 빠른 시작

```bash
# 의존성 설치
npm install

# 환경변수 설정
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
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID (선택) | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret (선택) | - |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (선택) | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (선택) | - |

## 기술 스택

- **프론트엔드**: React 19 + Vite 6 + Tailwind CSS v4 + Zustand 5
- **백엔드**: Hono 4 + SQLite (better-sqlite3) + Drizzle ORM
- **인프라**: Docker + Caddy (자동 HTTPS)

## 주요 기능

- 마크다운 에디터 + 실시간 미리보기 (분할/편집/미리보기 모드)
- 커스텀 임베드 (YouTube, CodePen, CodeSandbox)
- 다크/라이트 테마 전환
- 반응형 디자인 (모바일 지원)
- SEO 최적화 (메타 태그)
- 이미지 업로드 및 자동 리사이즈
- 프로필 및 소셜 링크 관리
- Federation 프로토콜 (구독, 웹훅, 폴링)
- PWA 지원 (Service Worker + Manifest)
- 게시글 커버 이미지 업로드
- GitHub/Google OAuth를 통한 SSO 댓글
- XSS 방지 (사용자 입력 보안 처리)
- 다국어 지원 (English / 한국어)
- 헤더/푸터 테마 커스터마이징 (밝은 모드/어두운 모드 별도 설정)

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

## 라이선스

MIT
