# Web UI

## 컴포넌트 구조

```
PaperView (src/app/paper/[id]/PaperView.tsx)
├── Header (title, authors, publishedDate, home 링크)
├── TabBar                     — PDF | 분석 | 배경지식 탭 (pill 스타일)
├── ResizableLayout            — 좌/우 분할 (드래그로 크기 조절)
│   ├── [PDF 탭] PdfViewer     — 연속 스크롤 PDF
│   │   ├── Toolbar            — 페이지 번호, 줌 컨트롤
│   │   ├── Document           — react-pdf Document
│   │   │   └── Page × N       — 모든 페이지 세로 나열
│   │   │       └── HighlightLayer (per page)
│   │   └── CitationPopover    — [N] 인용 호버/클릭 시 참고문헌 패널
│   ├── [분석 탭] DocViewer     — analysis.md 마크다운 렌더링
│   ├── [배경지식 탭] DocViewer — background/<topic>.md 마크다운 렌더링
│   └── ChatPanel              — AI 채팅
│       ├── Header (ExportButton + 모델 선택)
│       ├── MessageList        — 메시지 목록 + 스트리밍 + 로딩
│       ├── PresetButtons      — 프리셋 질문 버튼 (채팅 비어있을 때)
│       ├── DragContext        — 선택 텍스트 표시 + "이 부분 설명해줘" 버튼
│       └── MessageInput       — 메시지 입력
└── HighlightList              — 접을 수 있는 하단 패널 (PDF 탭에서만 표시)
```

## 핵심 컴포넌트 상세

### PaperView
**역할**: 최상위 상태 관리 + API 호출 조정 + 탭 전환

**상태**:
- `activeTab` — 현재 활성 탭 (`"pdf"` | `"analysis"` | `"bg:<topic>"`)
- `selectedText` — 드래그된 텍스트 (채팅 컨텍스트로 전달)
- `highlights` — 이 논문의 모든 하이라이트 배열
- `goToPage` — 특정 페이지로 이동 요청
- `bgTopics` / `hasAnalysis` — `/api/papers/[id]/status`에서 가져옴

**탭 시스템**:
- **PDF** (검정 pill) — PdfViewer 렌더링
- **분석** (파랑 pill) — `analysis.md`를 DocViewer로 렌더링. 분석 완료 시에만 표시
- **배경지식** (초록 pill) — 각 `background/<topic>.md`를 DocViewer로 렌더링. "배경지식" 라벨로 그룹 구분

**주요 핸들러**:
- `handleAddHighlight(hl)` — POST /api/highlights
- `handleDeleteHighlight(id)` — DELETE /api/highlights?id=xxx
- `handleUpdateMemo(id, memo)` — PATCH /api/highlights

### ResizableLayout
**역할**: 좌우 패널 분할. 구분선 드래그로 오른쪽 패널 폭 조절.

**제약**:
- 기본 폭: 384px (오른쪽 = 채팅 패널)
- 최소: 280px / 최대: 600px
- 왼쪽은 `flex-1`로 나머지 공간 차지

### DocViewer
**역할**: 마크다운 문서를 fetch하여 렌더링.

**동작**:
1. `GET /api/papers/[id]/docs?path=<docPath>` 호출
2. 응답의 `content`를 `MarkdownContent` 컴포넌트로 렌더링
3. `max-w-3xl` 컨테이너로 가독성 유지

**사용처**: 분석 탭 (`docPath="analysis.md"`), 배경지식 탭 (`docPath="background/<topic>.md"`)

### MarkdownContent (공유 컴포넌트)
**역할**: 마크다운 + 수식 렌더링. ChatPanel의 메시지와 DocViewer에서 공용.

**플러그인**:
- `remark-gfm` — 테이블, 취소선, autolink
- `remark-math` + `rehype-katex` — LaTeX 수식

**크기 모드**:
- `size="sm"` — 채팅 메시지용 (작은 폰트)
- `size="base"` — 문서 뷰어용 (큰 폰트, 넓은 여백, h2 밑줄)

### PdfViewer

#### 연속 스크롤
모든 페이지를 세로로 나열하고 스크롤로 탐색.

**현재 페이지 추적**: IntersectionObserver로 뷰포트에서 가장 많이 보이는 페이지를 감지.

**goToPage**: HighlightList에서 하이라이트 클릭 시 해당 페이지로 `scrollIntoView`.

#### 줌 debounce
줌 버튼 연타 시 150ms debounce. `scaleInput`(버튼 반영)과 `scale`(렌더링)을 분리.

#### Citation 클릭 패널
PDF 내 citation 하이퍼링크(`[N]`) 클릭 시 references 페이지로 이동하는 대신 참고문헌 정보 패널 표시.

**구현**:
1. `document.addEventListener("click", handler, true)` — document level capture phase
2. `.annotationLayer a` 클릭 감지 → `preventDefault` + `stopImmediatePropagation`
3. `findCitationNum()` — annotation link의 bounding rect과 겹치는 text layer span에서 `[N]` 또는 `[N, M, ...]` 패턴의 숫자 추출
4. `extractReferences()` — "References" 섹션을 찾아 `[N] Author, Title, Year` 파싱
5. 매칭되면 `CitationPopover`에 pinned panel 표시, 아니면 기본 navigation 유지 (Figure, Equation 등)

**CitationPopover**: 호버 시 툴팁 + 클릭 시 고정 패널 (ESC 또는 바깥 클릭으로 닫기)

### ChatPanel

상세는 [chat.md](./chat.md) 참조.

핵심:
- SSE 스트리밍 파싱 (버퍼 기반)
- 모델 선택 드롭다운 (Sonnet / Opus)
- Tool 사용 상황 실시간 표시
- **프리셋 질문 버튼** — 채팅 비어있을 때 표시:
  - 일반 프리셋: "이 논문의 핵심을 요약해줘", "이 논문의 주요 contribution이 뭐야?"
  - 배경지식 프리셋: 해당 논문의 background topic별 동적 버튼 (초록색)
  - 텍스트 선택 시: "이 부분 설명해줘" 버튼 (파란색)
- **ExportButton** — "분석 보강" 버튼. 채팅 내역 기반으로 analysis.md 보강
- **localStorage 영속화** — 메시지를 `chat:<paperId>` 키로 저장, 새로고침 시 복원

### HighlightLayer

상세는 [highlights.md](./highlights.md) 참조.

핵심:
- 드래그 후 플로팅 액션 툴바 (색상 선택 + Ask AI)
- 클릭 시 Delete/Memo 팝오버
- 좌표는 페이지 기준 퍼센트

## 라우팅

- `/` — 홈페이지 (논문 등록 폼 + My Papers 목록)
- `/paper/[id]` — 논문 읽기 + 채팅 (SSR로 Paper 메타데이터 조회)

## API 엔드포인트

- `GET /api/papers` — 논문 목록 + hasAnalysis 상태
- `POST /api/papers` — 논문 등록 (URL → arXiv 메타데이터 자동 추출)
- `GET /api/papers/[id]/pdf` — PDF 파일 서빙
- `GET /api/papers/[id]/status` — 분석 상태 + 배경지식 토픽 목록
- `GET /api/papers/[id]/docs?path=<path>` — 마크다운 문서 서빙
- `POST /api/papers/[id]/export` — 채팅 기반 analysis.md 보강 (SSE 스트리밍)
- `POST /api/chat` — AI 채팅 (SSE 스트리밍)
- `GET/POST/PATCH/DELETE /api/highlights` — 하이라이트 CRUD

## 스타일링

- **Tailwind CSS** 100% (CSS 모듈, CSS-in-JS 없음)
- **KaTeX CSS** — 수식 렌더링을 위해 `katex/dist/katex.min.css` 임포트
- **react-pdf 내장 CSS** — TextLayer, AnnotationLayer

## z-index 계층

- `.textLayer` — z-index: 2 (pdfjs 기본)
- `HighlightLayer` — z-index: 3 (`pointer-events: none`, 개별 요소만 `auto`)
- `CitationPopover` — z-index: 50 (fixed)
- `ExportButton` 모달/토스트 — z-index: 60 (fixed)
