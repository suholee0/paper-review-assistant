# Web UI

## 컴포넌트 구조

```
PaperView (src/app/paper/[id]/PaperView.tsx)
├── Header (title)
├── AnalysisStatus         — 분석 완료 여부 배너
├── ResizableLayout        — 좌/우 분할 (드래그로 크기 조절)
│   ├── PdfViewer          — 연속 스크롤 PDF
│   │   ├── Toolbar        — 페이지 번호, 줌 컨트롤
│   │   ├── Document       — react-pdf Document
│   │   │   └── Page × N   — 모든 페이지 세로 나열
│   │   │       └── HighlightLayer (per page)
│   │   └── CitationPopover — [N] 인용 호버 시 참고문헌
│   └── ChatPanel          — AI 채팅
│       ├── Header (모델 선택 드롭다운)
│       ├── MessageList    — 메시지 목록 + 스트리밍 + 로딩
│       ├── DragContext    — 선택 텍스트 표시 (선택 시)
│       └── MessageInput   — 메시지 입력
└── HighlightList          — 접을 수 있는 하단 패널 (모든 하이라이트 목록)
```

## 핵심 컴포넌트 상세

### PaperView
**역할**: 최상위 상태 관리 + API 호출 조정

**상태**:
- `selectedText` — 드래그된 텍스트 (채팅 컨텍스트로 전달)
- `highlights` — 이 논문의 모든 하이라이트 배열
- `goToPage` — 특정 페이지로 이동 요청 (HighlightList에서 클릭 시)

**주요 핸들러**:
- `handleAddHighlight(hl)` — POST /api/highlights, 성공 시 state 업데이트
- `handleDeleteHighlight(id)` — DELETE /api/highlights?id=xxx
- `handleUpdateMemo(id, memo)` — PATCH /api/highlights

### ResizableLayout
**역할**: 좌우 패널 분할. 구분선 드래그로 오른쪽 패널 폭 조절.

**제약**:
- 기본 폭: 384px (오른쪽 = 채팅 패널)
- 최소: 280px / 최대: 600px
- 왼쪽은 `flex-1`로 나머지 공간 차지

**구현**: `mousedown` 시 `document`에 `mousemove`/`mouseup` 리스너 등록, `rightWidth` state 업데이트.

### PdfViewer

#### 연속 스크롤
모든 페이지를 세로로 나열하고 스크롤로 탐색. 전통적인 PDF 뷰어처럼 동작.

**렌더링**:
```tsx
<Document file={fileUrl} onLoadSuccess={...}>
  <div className="flex flex-col items-center gap-4">
    {pages.map((pageNumber) => (
      <div key={pageNumber} data-page={pageNumber} ref={setPageRef}>
        <Page pageNumber={pageNumber} scale={scale} />
        <HighlightLayer page={pageNumber} ... />
      </div>
    ))}
  </div>
</Document>
```

**현재 페이지 추적**: IntersectionObserver로 뷰포트에서 가장 많이 보이는 페이지를 감지. 이 값이 툴바의 "page / total" 표시를 갱신.

```tsx
const observer = new IntersectionObserver((entries) => {
  let maxRatio = 0;
  let mostVisiblePage = 0;
  entries.forEach((entry) => {
    if (entry.intersectionRatio > maxRatio) {
      maxRatio = entry.intersectionRatio;
      mostVisiblePage = Number(entry.target.dataset.page);
    }
  });
  if (mostVisiblePage > 0) setCurrentPage(mostVisiblePage);
}, { root: scrollContainer, threshold: [0, 0.25, 0.5, 0.75, 1] });
```

**goToPage**: HighlightList에서 하이라이트 클릭 시 해당 페이지 ref의 `scrollIntoView({ behavior: "smooth" })` 호출.

#### 줌 debounce
줌 버튼 연타 시 매번 Page를 다시 렌더하면 pdfjs가 TextLayer 태스크를 반복 취소해서 `AbortException`이 발생합니다.

해결:
```tsx
const [scaleInput, setScaleInput] = useState(1.2); // 버튼이 갱신
const [scale, setScale] = useState(1.2);           // 실제 렌더에 사용

useEffect(() => {
  if (scaleInput === scale) return;
  const timer = setTimeout(() => setScale(scaleInput), 150);
  return () => clearTimeout(timer);
}, [scaleInput, scale]);
```

버튼은 즉시 `scaleInput`을 갱신하지만, 150ms 동안 추가 입력이 없어야 실제 `scale`로 커밋됩니다.

또한 react-pdf의 `onRenderTextLayerError`, `onRenderAnnotationLayerError`, `onRenderError` 콜백으로 `AbortException`을 필터링합니다.

### ChatPanel

상세는 [chat.md](./chat.md) 참조.

핵심:
- SSE 스트리밍 파싱 (버퍼 기반)
- 모델 선택 드롭다운 (Sonnet / Opus)
- Tool 사용 상황 실시간 표시 (예: "📖 analysis.md 읽는 중")

### HighlightLayer

상세는 [highlights.md](./highlights.md) 참조.

핵심:
- 드래그 후 플로팅 액션 툴바 (색상 선택 + Ask AI)
- 클릭 시 Delete/Memo 팝오버
- 좌표는 페이지 기준 퍼센트

## 라우팅

- `/` — 랜딩 페이지 (논문 URL 또는 PDF 업로드)
- `/paper/[id]` — 논문 읽기 + 채팅 (SSR로 Paper 메타데이터 조회)

## 스타일링

- **Tailwind CSS** 100% (CSS 모듈, CSS-in-JS 없음)
- **KaTeX CSS** — 수식 렌더링을 위해 `katex/dist/katex.min.css` 임포트 (MessageList에서)
- **react-pdf 내장 CSS** — TextLayer, AnnotationLayer

## z-index 계층

pdfjs-dist의 `.textLayer`가 `z-index: 2`로 설정되어 있어, 하이라이트 레이어가 그 아래에 가려지는 문제가 있었습니다.

해결: `HighlightLayer`의 컨테이너에 `zIndex: 3`을 명시적으로 지정.

```tsx
<div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
```

`pointer-events: none`이라 텍스트 선택은 여전히 `.textLayer`에서 처리되고, 하이라이트 rect나 툴바 같은 개별 요소만 `pointer-events: auto`로 클릭 가능.
