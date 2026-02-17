# CLAUDE.md - 프로젝트 개발 지침

## 🛠 주요 명령어

- 빌드: `npm run build`
- 개발 서버 실행: `npm run dev`
- 린트 체크: `npm run lint`
- 포멧 체크: `npx prettier --write .`
- 테스트 실행: `npm test`
- 특정 테스트 실행: `npm test -- <파일경로>`

## 🎨 코딩 가이드라인

### 스타일 및 구조

- 모든 컴포넌트는 **TypeScript**와 **Tailwind CSS**를 사용합니다.
- 폴더구조는 **[FSD(Feature-Sliced Design)](https://feature-sliced.design)** 아키텍처를 따릅니다.
- 함수형 컴포넌트와 Hooks를 선호하며, 클래스 컴포넌트는 지양합니다.
- 에러 처리는 `try-catch` 블록과 사용자 정의 에러 유틸리티를 활용하세요.
- 코드 수정후 항상 린트 체크와 포멧 체크를 하고 테스트 실행후 문제가 없으면 커밋/푸시를 해주세요.
- 커밋 메시지는 영문으로 작성해주세요. (예: fix: correct minor typos in code)

### 기술적 제약

- 상태 관리는 `Zustand`를 사용합니다.
- API 통신은 `Axios` 대신 기본 `fetch` API를 사용합니다.
- 절대 경로 임포트(`@/components/...`)를 사용하세요.

### 테스트 규칙

- 새로운 기능을 추가할 때는 반드시 `__tests__` 폴더에 테스트 코드를 포함해야 합니다.

### UI/UX

- 항상 유저가 무엇을 할지 의식해서 가장 편리하게 사용할 수 있도록 고려 해야합니다.
  (예를 들어 SSO로그인으로 댓글을 달때는 로그인 후 커서를 댓글창에 포커스를 둡니다)
- [W3C 접근성 기준 개요 | Web Accessibility Initiative](https://www.w3.org/TR/WCAG21/)에 맞게 구현을 합니다.
