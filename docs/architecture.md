# Architecture

## 설계 원칙

### 1. Codex as the main agent
이 프로젝트는 **Codex를 1차 에이전트**로 삼고, 웹앱은 보조 도구로 동작합니다.

분석은 여러 단계의 파일 읽기·웹 검색·문서 작성이 필요한 장기 작업이므로 에이전트 세션에서 직접 수행합니다.

**Codex 터미널 세션이 메인 제어권**을 갖고, 프로젝트 디렉토리의 `AGENTS.md`와 `skills/*.md`를 따라 분석 워크플로우를 수행합니다. 웹앱은 이미 분석된 논문을 읽고 채팅하는 뷰어입니다.

### 2. 로컬 우선
- SQLite로 모든 메타데이터 저장 (`data/papers.db`)
- PDF와 분석 결과는 `papers/<paper-id>/` 아래 파일로 저장
- 웹 AI runtime은 공식 Codex SDK를 통해 서버 사용자 환경의 Codex 인증 사용

### 3. 파일 기반 분석 결과
분석 결과를 DB가 아닌 markdown 파일로 저장하는 이유:
- Codex가 자연스럽게 파일 도구로 접근 가능
- 사용자가 텍스트 에디터로 직접 확인/수정 가능
- 버전 관리(git)에 친화적

## 계층 구조

```
┌──────────────────────────────────────────────────┐
│  User                                            │
│  ┌────────────────┐   ┌────────────────────────┐ │
│  │ Codex          │   │ Browser (Web UI)       │ │
│  │ terminal       │   │                        │ │
│  └───────┬────────┘   └──────────┬─────────────┘ │
└──────────┼────────────────────────┼───────────────┘
           │                        │
           │ CLI 호출                │ HTTP
           ▼                        ▼
┌──────────────────────────────────────────────────┐
│  Orchestration Layer                             │
│  ┌────────────────┐   ┌────────────────────────┐ │
│  │ scripts/       │   │ Next.js routes         │ │
│  │ register/serve │   │ /api/chat /api/papers  │ │
│  │ /list          │   │ /api/papers/[id]/docs  │ │
│  │                │   │ /api/papers/[id]/export │ │
│  └───────┬────────┘   └──────────┬─────────────┘ │
└──────────┼────────────────────────┼───────────────┘
           │                        │
           ▼                        ▼
┌──────────────────────────────────────────────────┐
│  Domain Layer                                    │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Papers   │ │ Highlights│ │ AI Provider     │  │
│  │ (lib)    │ │ (Prisma)  │ │ (codex)         │  │
│  └────┬─────┘ └─────┬─────┘ └────────┬────────┘  │
└───────┼─────────────┼─────────────────┼──────────┘
        │             │                 │
        ▼             ▼                 ▼
┌──────────────────────────────────────────────────┐
│  Infrastructure                                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ File     │ │ SQLite   │ │ Codex           │  │
│  │ system   │ │          │ │ SDK             │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
└──────────────────────────────────────────────────┘
```

## 두 개의 실행 컨텍스트

### Context A: Codex 터미널
**무엇을 하는가:** 논문 분석 워크플로우 전체를 오케스트레이션

**어떻게:** 사용자가 Codex 세션에서 자연어로 요청 → Codex가 AGENTS.md의 지시를 따라 CLI 스크립트 호출 + `skills/read-together.md`의 단계를 수행

**왜 이렇게:** 분석은 여러 단계(파일 읽기, 웹 검색, 문서 작성)가 필요한 장기 작업. Codex 터미널이 사용자의 허가를 받으며 진행하는 방식이 가장 자연스러움

### Context B: Next.js 웹앱
**무엇을 하는가:** 이미 분석된 논문을 읽고 채팅

**어떻게:** 브라우저에서 PDF/분석/배경지식을 탭으로 전환하며 열람 + 채팅 패널에서 Codex SDK를 통한 스트리밍 Q&A

**왜 이렇게:** 읽기와 채팅은 인터랙티브 UI가 필수. PDF 하이라이트, 수식 렌더링, 마크다운 문서 뷰어, 메모 등은 터미널로 불가능

두 컨텍스트는 **공유 파일 시스템(`papers/<id>/`)과 SQLite DB**로 느슨하게 연결됩니다. 터미널에서 분석한 결과 파일을 웹앱이 읽어서 활용하는 구조입니다.

## 데이터 흐름

### 분석 시 (Context A)
```
User 요청 ("이 논문 같이 읽자: <url>")
  → Codex가 AGENTS.md 읽음
  → scripts/register-paper.ts <url> → paperDir의 기존 산출물 검토
  │
  ├─ 완성본 → scripts/serve.ts <id> → 준비 확인 후 URL 제공 (--open이면 브라우저 실행)
  │
  └─ 미완성 → skills/read-together.md 실행
           → Phase 1: PDF 전체 추출/읽기 → 스키밍 → topics.json 작성
           → Phase 2: 토픽별 병렬 웹 검색 → background/*.md 작성
           → Phase 3: 깊은 읽기 → analysis.md 작성
         → scripts/serve.ts <id> → 준비 확인 후 URL 제공 (--open이면 브라우저 실행)
```

### 채팅 시 (Context B)
```
User 질문 (웹 UI 채팅창)
  → /api/chat POST (SSE 응답)
  → CodexProvider.query()
  → Codex SDK
    → 첫 메시지면: background/, analysis.md 읽기 (tool_use 이벤트 발생)
    → 완료된 메시지 단위 텍스트 스트리밍
  → SSE 청크로 인코딩 → 클라이언트
  → ChatPanel이 text는 streamingContent로, tool_use는 toolActivity로 state 업데이트
  → MessageList에서 렌더링 (마크다운 + 수식)
```

## 확장성 고려사항

### AI Provider 추상화
`src/lib/ai/provider.ts`에 `AIProvider` 인터페이스를 정의하고 `CodexProvider`가 구현. 필요하다면 다른 provider(예: 직접 API 호출)로 교체 가능.

```typescript
export interface AIProvider {
  query(options: AIQueryOptions): AsyncGenerator<AIResponse>;
}
```

현재 구현은 `CodexProvider`입니다. 인증, sandbox, 세션 재개와 이전 runtime ID 처리 방식은 [ai-integration.md](ai-integration.md)를 참고하세요.

### 다중 논문 관리
`papers/<paper-id>/` 구조로 논문별 독립된 작업 디렉토리를 가짐. `scripts/list-papers.ts`로 목록과 분석 상태 조회 가능.

## 제약과 트레이드오프

| 결정 | 장점 | 단점 |
|------|------|------|
| Codex를 메인 에이전트로 | 작업 진행과 산출물 확인 용이 | 웹앱만으로는 분석 불가 |
| 파일 기반 분석 결과 | 투명성, 수정 용이 | DB 쿼리가 불가능한 데이터 |
| SQLite | 설정 없이 작동 | 다중 사용자 환경 부적합 |
| SSE 스트리밍 | 구현 단순 | 양방향 통신 불가 (WebSocket이 아님) |
| 연속 스크롤 PDF | 독자 친화적 | 메모리 사용량 ↑ (모든 페이지 렌더) |
