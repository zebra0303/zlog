# 프로젝트 개발 지침 (AI Context)

## 🤖 AI 에이전트 행동 지침 (AI Behavior)

- 불필요한 인사말이나 사과를 생략하고 간결하게 답변하세요.
- 코드를 수정할 때는 기존 로직을 훼손하지 않도록 주의하고, 수정된 부분에 대해 짧게 주석(영문)으로 이유를 설명하세요.
- 확신이 없는 패키지 설치나 구조 변경은 임의로 진행하지 말고 먼저 물어보세요.

## 🛠 주요 명령어

- 빌드: `npm run build`
- 개발 서버 실행: `npm run dev`
- 린트 체크: `npm run lint`
- 포맷 체크: `npx prettier --write .`
- 테스트 실행: `npm test`
- 특정 테스트 실행: `npm test -- <파일경로>`

## 🎨 코딩 가이드라인

### 기술 스택 및 구조

- 프레임워크/언어: **React**, **TypeScript**, **Tailwind CSS**
- 디렉토리 구조는 **[FSD(Feature-Sliced Design)](https://feature-sliced.design)** 아키텍처를 엄격하게 따릅니다.
  - `app`: 전역 설정, 스타일, 프로바이더
  - `pages`: 라우팅되는 전체 페이지 컴포넌트
  - `widgets`: 독립적인 UI 블록 (예: Header, Sidebar)
  - `features`: 사용자 상호작용 및 비즈니스 로직 (예: Auth, Commenting)
  - `entities`: 비즈니스 엔티티 (예: User, Post)
  - `shared`: 재사용 가능한 UI 컴포넌트, 유틸리티, API 클라이언트
- 절대 경로 임포트(`@/shared/...`, `@/features/...`)를 사용하세요.

### 코드 컨벤션

- 함수형 컴포넌트와 Hooks를 선호하며, 클래스 컴포넌트는 지양합니다.
- 상태 관리는 `Zustand`를 사용합니다.
- API 통신은 외부 라이브러리(Axios 등) 대신 **기본 `fetch` API**를 사용합니다.
- 에러 처리는 `try-catch` 블록과 사용자 정의 에러 유틸리티(`@/shared/lib/errors` 등)를 활용하세요.
- 번들링 청크 사이즈는 500kB를 넘지 않도록 코드를 분할(Code Splitting)하세요.

### 테스트 규칙

- 새로운 기능을 추가할 때는 반드시 `__tests__` 폴더에 **[Jest / Vitest 입력]** 및 Testing Library를 활용한 테스트 코드를 포함해야 합니다.
- 엣지 케이스(Edge cases)와 에러 상태에 대한 테스트를 우선적으로 작성하세요.

### UI/UX 및 접근성

- 사용자 경험(UX)을 최우선으로 고려하세요. (예: SSO 로그인으로 댓글 작성 시, 완료 후 즉시 댓글창으로 포커스 자동 이동)
- [W3C 접근성 기준 (WCAG 2.1)](https://www.w3.org/TR/WCAG21/)을 준수합니다. (적절한 `aria-*` 태그 사용, 키보드 네비게이션 지원, 시맨틱 HTML 태그 사용)

### 🚀 워크플로우 (Git)

- 코드 수정 후에는 항상 린트 체크(`npm run lint`)와 포맷 체크, 테스트(`npm test`)를 실행하세요.
- 모든 체크를 통과하면 커밋을 진행하세요.
- 주석과 커밋 메시지는 **영문**으로 작성합니다.
- Conventional Commits 규칙을 따르세요. (예: `feat: add SSO login`, `fix: correct minor typos in code`)
