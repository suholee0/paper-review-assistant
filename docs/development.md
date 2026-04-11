# Development Guide

## 환경 설정

### 요구 사항
- Node.js 18+
- npm
- Claude Code 설치 및 로그인

### 초기 설정
```bash
git clone <repo-url>
cd paper-review-tool
npm install
npx prisma db push
```

## 개발 스크립트

```bash
# 개발 서버
npm run dev           # Next.js dev server (port 3000)

# 빌드 검증
npm run build         # Next.js 프로덕션 빌드
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript 타입 체크

# 테스트
npm test              # Vitest 단일 실행
npm run test:watch    # Vitest watch 모드

# CLI 도구
npm run paper:register -- <url-or-file>
npm run paper:serve -- [paper-id]
npm run paper:list
```

## 프로젝트 구조

```
paper-review-tool/
├── CLAUDE.md              # Claude Code 프로젝트 가이드
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── vitest.config.ts
├── prisma/
│   └── schema.prisma
├── skills/                # Claude Code 스킬 (markdown)
│   ├── read-together.md   # 같이 읽기 워크플로우 (메인)
│   ├── skim.md            # Phase 1 개별 스킬
│   ├── build-background.md # Phase 2 개별 스킬
│   └── deep-read.md       # Phase 3 개별 스킬
├── scripts/               # CLI 도구
│   ├── register-paper.ts
│   ├── serve.ts
│   └── list-papers.ts
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── page.tsx       # 랜딩 페이지
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── paper/[id]/
│   │   │   ├── page.tsx       # SSR 논문 페이지
│   │   │   └── PaperView.tsx  # 클라이언트 컴포넌트
│   │   └── api/
│   │       ├── papers/        # 논문 CRUD
│   │       ├── highlights/    # 하이라이트 CRUD
│   │       └── chat/          # SSE 채팅
│   ├── components/
│   │   ├── pdf/           # PDF 뷰어
│   │   ├── chat/          # 채팅 UI
│   │   ├── highlights/    # 하이라이트 목록
│   │   └── layout/        # 레이아웃 (Resizable, AnalysisStatus)
│   ├── lib/
│   │   ├── ai/            # AI provider
│   │   ├── db.ts          # Prisma 싱글톤
│   │   ├── papers.ts      # 파일 시스템 유틸
│   │   ├── references.ts  # PDF 인용 추출
│   │   └── sse.ts         # SSE 인코더
│   ├── constants/
│   │   ├── highlight.ts   # 색상 상수 + 타입
│   │   └── models.ts      # 모델 ID 상수
│   └── types/
│       └── index.ts       # 공유 타입
├── __tests__/             # Vitest 테스트
├── data/                  # SQLite (gitignore)
├── papers/                # 논문별 작업 디렉토리 (gitignore)
└── docs/                  # 기술 문서
```

## 코딩 컨벤션

### TypeScript
- 모든 소스는 TypeScript
- `any` 지양. `unknown` + 타입 가드 사용
- 공용 타입은 `src/types/`에 집중
- 상수는 `src/constants/`에 집중 (색상, 모델 ID 등)

### React
- 모든 상호작용 컴포넌트는 `"use client"` 디렉티브
- 상태는 가장 가까운 공통 부모에 (전역 상태 매니저 미사용)
- 부수 효과는 `useEffect`, 메모이제이션은 `useCallback/useMemo`
- props drilling은 2~3 레벨까지는 용인

### 파일 이름
- 컴포넌트: `PascalCase.tsx`
- 유틸/라이브러리: `kebab-case.ts` 또는 `camelCase.ts`
- 테스트: `<원본>.test.ts`

### 스타일
- **Tailwind CSS만 사용** (CSS 모듈, CSS-in-JS 금지)
- 색상은 `src/constants/highlight.ts`에서 import
- 매직 넘버는 상수화 (특히 magic 좌표값)

### API 라우트
- 모든 라우트는 `export async function POST/GET/PATCH/DELETE`
- 입력 검증: `if (!field || typeof field !== "expected")` → 400 반환
- `NextResponse.json({...}, { status })` 사용

## 테스트

### 구조
```
__tests__/
├── api/
│   ├── chat.test.ts
│   ├── highlights.test.ts
│   └── papers.test.ts
└── lib/
    ├── papers.test.ts
    └── ai/
        └── provider.test.ts
```

### 작성 가이드
- **Vitest** 사용
- API 라우트는 request 객체를 모킹해서 호출
- Prisma는 실제 DB(SQLite)에 연결하여 통합 테스트
- AI provider는 모킹

### 실행
```bash
npm test              # 단일 실행
npm run test:watch    # watch 모드
```

### 알려진 이슈
`__tests__/api/papers.test.ts`와 `__tests__/api/chat.test.ts`에서 `Request` → `NextRequest` 타입 캐스팅 관련 타입 에러가 있습니다. 테스트는 런타임에 정상 동작합니다.

## 빌드 캐시 이슈

개발 중 `.next` 디렉토리가 꼬여 `Cannot find module './vendor-chunks/...'` 같은 에러가 발생할 수 있습니다. 해결:

```bash
rm -rf .next
npm run dev
```

특히 npm install 후나 큰 의존성 추가 후에 자주 발생합니다.

## Prisma 스키마 변경

```bash
# 1. prisma/schema.prisma 수정
# 2. DB에 반영
npx prisma db push

# 3. (선택) Prisma Client 재생성
npx prisma generate
```

## 커밋 컨벤션 (권장)

- `feat:` 새 기능
- `fix:` 버그 수정
- `refactor:` 기능 변경 없는 리팩토링
- `docs:` 문서만 변경
- `test:` 테스트 추가/수정
- `chore:` 빌드/설정

## 디버깅 팁

### PDF 렌더링 문제
- `AbortException: TextLayer task cancelled` — 정상 cancellation signal. `src/components/pdf/PdfViewer.tsx`에서 필터링됨
- PDF 안 보임 — `/api/papers/[id]/pdf` 응답 확인, `filePath`가 빈 문자열은 아닌지 확인

### 채팅 응답 없음
- 터미널에 `[claude-agent]`, `[claude]` 로그 확인
- 첫 메시지는 tool-use 때문에 느릴 수 있음 (배경지식 파일 읽기)
- Claude Code 로그인 상태 확인: `claude --version`

### 하이라이트가 이상한 위치에
- 과거 버전에서 저장한 하이라이트라면 좌표가 첫 페이지 기준일 수 있음
- 삭제 후 다시 하이라이트
- 현재 버전은 페이지별 형제 요소를 정확히 참조

### SSE 스트림 중간에 끊김
- 버퍼링 이슈일 가능성. ChatPanel의 버퍼 패턴 확인
- 서버 로그에 에러 있는지 확인

## 의존성

### 핵심
- `next` `^15.3` — 프레임워크
- `react` `^19` — UI
- `@anthropic-ai/claude-agent-sdk` — AI
- `@prisma/client` + `prisma` — DB
- `react-pdf` + `pdfjs-dist` — PDF

### UI
- `tailwindcss` `^4`
- `react-markdown` — 마크다운 렌더링
- `remark-math` + `rehype-katex` + `katex` — 수식

### 개발
- `typescript` `^5`
- `vitest` + `@testing-library/react` — 테스트
- `eslint` + `eslint-config-next`
- `tsx` — TypeScript 스크립트 실행

## 기여 가이드

1. 이슈 먼저 논의 (큰 변경인 경우)
2. 브랜치 생성: `feat/xxx` 또는 `fix/xxx`
3. 커밋 작고 의미 있게
4. 테스트 통과 확인: `npm test && npm run build`
5. PR 생성
