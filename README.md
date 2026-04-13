# Paper Review Tool

> **Claude Code 권한 안내**: 이 프로젝트는 `.claude/settings.json`에 Claude Code 도구 권한이 미리 설정되어 있습니다. `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebSearch`, `WebFetch`와 제한된 `Bash` 명령(`npm`, `npx`, `git`, `node` 등)이 허용됩니다. clone 후 사용 전에 [.claude/settings.json](./.claude/settings.json)을 직접 확인하시기 바랍니다.

논문을 읽을 때 AI 메이트와 함께 깊게 이해할 수 있는 로컬 도구.

Claude Code가 논문을 먼저 **스키밍 → 배경지식 수집 → 깊은 읽기** 과정을 거쳐 분석한 뒤,
웹 UI에서 논문을 읽으면서 AI와 바로 대화할 수 있습니다.

## 핵심 컨셉

- **Claude Code가 메인 에이전트** — 분석 워크플로우는 Claude Code 터미널에서 직접 수행
- **웹 UI는 뷰어 + 채팅** — PDF 뷰어, 하이라이트, 마크다운/수식 렌더링 채팅
- **로컬 우선** — SQLite, 로컬 파일 시스템. 외부 API 키 불필요 (사용자의 Claude Code 구독 사용)

> **주의**: 이 도구는 로컬에서 실행하며, 사용자 본인의 Claude Code 구독이 필요합니다. 공유 서버로 배포하여 여러 사용자가 하나의 구독을 공유하는 형태로 사용하지 마세요.

## 주요 기능

### 같이 읽기 (Read Together)
- Claude Code가 논문을 읽고 배경지식이 필요한 토픽을 자동 식별
- 각 토픽에 대해 웹 검색으로 compact한 치트시트 작성
- 배경지식을 바탕으로 섹션별 깊이 있는 분석 수행
- 이미 분석된 논문은 분석 과정을 스킵하고 바로 웹 UI 오픈

### 웹 UI
- **홈페이지** — 등록된 논문 목록 (제목, 저자, 발행일, 분석 상태 표시)
- **탭 시스템** — PDF | 분석 | 배경지식 탭으로 좌측 패널 전환
- **PDF 뷰어** — 연속 스크롤, 가운데 정렬, 줌 조절
- **문서 뷰어** — analysis.md, 배경지식 문서를 마크다운 렌더링으로 열람
- **하이라이트** — 4가지 색상, 드래그 후 플로팅 툴바로 원클릭 하이라이트
- **Ask AI** — 드래그한 텍스트를 AI 채팅의 컨텍스트로 바로 전달
- **메모** — 하이라이트에 메모 추가/삭제
- **채팅** — Claude Agent SDK 기반 실시간 스트리밍 응답
  - 마크다운 + LaTeX 수식 렌더링 (KaTeX)
  - 모델 선택 (Sonnet / Opus)
  - Tool 사용 상황 실시간 표시 (예: "📖 analysis.md 읽는 중")
  - 프리셋 질문 버튼 (일반 질문 + 배경지식 토픽별 동적 버튼)
  - 메시지 영속화 (새로고침 시에도 대화 내역 유지)
- **인용 클릭 패널** — `[N]` citation 클릭 시 페이지 이동 없이 참고문헌 정보 패널 표시
- **분석 보강** — 채팅 내용 기반으로 analysis.md 자동 보강

## 설치

### 필수 조건
- **Node.js** 18+
- **Claude Code** 설치 및 로그인 완료 ([설치 가이드](https://docs.anthropic.com/ko/docs/claude-code))

### 설치
```bash
git clone https://github.com/suholee0/paper-review-assistant.git
cd paper-review-assistant
bash scripts/setup.sh
```

또는 Claude Code에서 바로 시작해도 됩니다 — 설정이 안 되어 있으면 자동으로 setup을 실행합니다.

## 사용법

### 기본 흐름

이 프로젝트는 Claude Code가 메인 에이전트로 동작합니다. 프로젝트 디렉토리에서 Claude Code 세션을 열고 자연어로 요청하면 됩니다.

```
이 논문 같이 읽자: https://arxiv.org/abs/1706.03762
```

Claude Code가 `CLAUDE.md`를 읽고 워크플로우를 따라 실행합니다:
1. 논문 등록 (PDF 다운로드 + DB 저장)
2. 이미 분석되었는지 확인 (파일 존재 체크)
3. 미분석이면 `skills/read-together.md` 워크플로우 실행 (스키밍 → 배경지식 → 깊은 읽기)
4. 분석 완료 후 웹 UI 실행

### CLI 스크립트 (직접 호출)

```bash
# 논문 등록
npx tsx scripts/register-paper.ts <url-or-filepath> [title]

# 웹 UI 띄우기 (paper-id 생략 시 랜딩 페이지)
npx tsx scripts/serve.ts [paper-id]

# 논문 목록 + 분석 상태 조회
npx tsx scripts/list-papers.ts
```

## 파일 구조

```
paper-review-tool/
├── CLAUDE.md              # Claude Code용 프로젝트 가이드
├── skills/                # Claude Code가 호출하는 스킬 파일들
│   └── read-together.md   # 같이 읽기 워크플로우
├── scripts/               # CLI 도구
│   ├── register-paper.ts
│   ├── serve.ts
│   └── list-papers.ts
├── src/                   # Next.js 애플리케이션
│   ├── app/               # 페이지 + API 라우트
│   ├── components/        # PDF 뷰어, 채팅, 하이라이트 컴포넌트
│   ├── lib/               # AI provider, DB, PDF 유틸
│   ├── constants/         # 색상, 모델 ID 등
│   └── types/             # TypeScript 타입 정의
├── papers/                # 논문별 작업 디렉토리 (gitignore)
│   └── <paper-id>/
│       ├── original.pdf
│       ├── topics.json    # 스키밍으로 식별된 배경지식 토픽 목록
│       ├── background/    # 토픽별 배경지식 문서
│       │   └── *.md
│       └── analysis.md    # 깊은 읽기 결과
├── data/                  # SQLite DB (gitignore)
└── docs/                  # 기술 문서 (개발자용)
```

## 아키텍처 요약

```
┌─────────────────────────────────────────────┐
│   Claude Code 터미널 (메인 에이전트)          │
│   - CLAUDE.md + skills/read-together.md 실행 │
│   - 논문 분석 워크플로우 오케스트레이션        │
└──────────────┬──────────────────────────────┘
               │ CLI 호출
               ▼
┌─────────────────────────────────────────────┐
│   scripts/ (CLI 도구)                        │
│   - register-paper / serve / list-papers    │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   Next.js 웹앱                               │
│   ┌───────────────┐   ┌──────────────────┐  │
│   │ PDF Viewer    │   │ Chat Panel       │  │
│   │ + Highlights  │◄─►│ + Model selector │  │
│   │ + Ask AI      │   │ + Markdown/Math  │  │
│   └───────────────┘   └──────┬───────────┘  │
│                              │              │
│   ┌──────────────────────────▼────────────┐ │
│   │ API Routes (SSE streaming)            │ │
│   │ /api/chat → Claude Agent SDK          │ │
│   └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 기술 스택
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **PDF**: react-pdf + pdfjs-dist
- **Chat UI**: react-markdown + remark-math + rehype-katex
- **DB**: Prisma + SQLite (로컬 메타데이터)
- **AI**: @anthropic-ai/claude-agent-sdk (Claude Code 인증 재사용)

## 상세 문서

기술적인 세부사항은 `docs/` 폴더를 참고하세요:

- [architecture.md](./docs/architecture.md) — 전체 아키텍처와 설계 결정
- [read-together-workflow.md](./docs/read-together-workflow.md) — 같이 읽기 워크플로우 상세
- [web-ui.md](./docs/web-ui.md) — 웹 UI 컴포넌트 구조
- [highlights.md](./docs/highlights.md) — 하이라이트 시스템 구현
- [chat.md](./docs/chat.md) — 채팅 스트리밍 + tool-use 표시
- [ai-integration.md](./docs/ai-integration.md) — Claude Agent SDK 통합
- [database.md](./docs/database.md) — DB 스키마와 파일 시스템 레이아웃
- [development.md](./docs/development.md) — 개발 환경 설정과 기여 가이드

## 라이선스

MIT License — [LICENSE](./LICENSE) 파일 참조
