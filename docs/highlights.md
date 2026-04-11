# Highlights

## 설계 목표

- **Cursor 스타일 UX** — 텍스트 드래그 후 선택 영역 근처에 액션 툴바 등장
- **영속성** — 하이라이트는 DB에 저장, 다시 열어도 복원
- **메모** — 각 하이라이트에 개인 메모 첨부 가능
- **삭제** — 하이라이트 클릭으로 Delete 팝오버
- **정렬/줌 독립성** — PDF 줌이 바뀌거나 가운데 정렬이 바뀌어도 하이라이트가 정확한 위치에 유지

## 데이터 모델

### Prisma 스키마
```prisma
model Highlight {
  id        String   @id @default(uuid())
  paperId   String
  paper     Paper    @relation(fields: [paperId], references: [id], onDelete: Cascade)
  page      Int
  rects     String   // JSON: HighlightRect[]
  text      String   @default("")
  color     String   @default("yellow")
  memo      String?
  createdAt DateTime @default(now())
}
```

### TypeScript 타입
```typescript
export interface HighlightRect {
  top: number;    // percentage (0-100)
  left: number;   // percentage (0-100)
  width: number;  // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface HighlightData {
  id: string;
  paperId: string;
  page: number;
  rects: HighlightRect[];
  text: string;
  color: HighlightColor;  // "yellow" | "green" | "blue" | "pink"
  memo: string | null;
  createdAt: Date;
}
```

## 좌표 시스템

### 왜 퍼센트 기반인가
픽셀 좌표로 저장하면:
- 줌 변경 시 좌표가 틀어짐
- 다른 스크린 해상도에서 어긋남
- 페이지 정렬(왼쪽 vs 가운데)이 바뀌면 틀어짐

페이지(`.react-pdf__Page`) 요소 기준 퍼센트로 저장하면 모든 변환에 불변합니다.

### 계산 방법
드래그 후 `window.getSelection()`에서 `Range.getClientRects()`로 픽셀 좌표를 얻습니다. 각 rect를 해당 페이지 요소의 `getBoundingClientRect()` 기준으로 퍼센트로 변환:

```typescript
const pageBounds = pageEl.getBoundingClientRect();
const clientRects = range.getClientRects();

for (const r of clientRects) {
  rects.push({
    top: ((r.top - pageBounds.top) / pageBounds.height) * 100,
    left: ((r.left - pageBounds.left) / pageBounds.width) * 100,
    width: (r.width / pageBounds.width) * 100,
    height: (r.height / pageBounds.height) * 100,
  });
}
```

### 여러 페이지 처리
연속 스크롤에서 한 번의 드래그로 여러 페이지를 선택할 수 있지만, 현재는 **같은 페이지 내에서만** 하이라이트가 저장됩니다. 선택이 어느 페이지에 속하는지 `container.parentElement.querySelector(".react-pdf__Page")`로 판단합니다.

**주의**: 과거에는 `document.querySelector(".react-pdf__Page")` (첫 번째 페이지만 찾음)를 사용해서 여러 페이지 환경에서 좌표가 모두 첫 페이지 기준으로 저장되는 버그가 있었습니다. 이는 수정되었으나 그 시점 이전에 생성된 하이라이트는 좌표가 잘못되어 있을 수 있습니다.

## UX 플로우

### 1. 하이라이트 생성
```
사용자 드래그
  ↓
document.mouseup 이벤트 발생
  ↓
모든 HighlightLayer 인스턴스가 리스너 실행
  ↓
각 인스턴스: "이 선택이 내 페이지에 속하는가?" 확인
  │  (container.parentElement.contains(range.commonAncestorContainer))
  ↓
해당 페이지의 인스턴스만 floating toolbar 표시
  ↓
사용자가 색상 클릭
  ↓
handleHighlightWithColor(color) 실행
  → clientRects → 퍼센트 변환 → onAddHighlight 콜백
  → POST /api/highlights
  → DB 저장 + state 업데이트
```

### 2. 플로팅 툴바 위치 계산
선택의 마지막 rect를 기준으로 그 아래에 툴바 표시:

```typescript
const lastRect = clientRects[clientRects.length - 1];
const top = ((lastRect.bottom - pageBounds.top) / pageBounds.height) * 100;
const left = ((lastRect.right - pageBounds.left) / pageBounds.width) * 100;

setToolbar({
  visible: true,
  top: Math.min(top + TOOLBAR_OFFSET_TOP, TOOLBAR_MAX_TOP),         // 92 clamp
  left: Math.min(Math.max(left - TOOLBAR_OFFSET_LEFT, TOOLBAR_MIN_LEFT), TOOLBAR_MAX_LEFT), // 2-65 clamp
});
```

클램프는 툴바가 페이지 밖으로 벗어나는 것을 방지합니다.

### 3. 선택 해제 감지
`selectionchange` 이벤트로 선택이 사라지면 툴바 자동 숨김:

```typescript
function onSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    if (toolbarRef.current?.contains(document.activeElement)) return;
    setToolbar((prev) => ({ ...prev, visible: false }));
  }
}
```

툴바 버튼 클릭 시 선택이 collapse되는 것을 막기 위해 툴바의 `onMouseDown`에 `e.preventDefault()` 적용.

### 4. 하이라이트 클릭 → Delete/Memo 팝오버
저장된 하이라이트는 반투명 색상의 `<div>`로 렌더링. 클릭 이벤트 처리:

```typescript
onClick={(e) => {
  e.stopPropagation();
  setActiveHighlight((prev) => prev?.id === hl.id ? null : hl);
  setMemoText(hl.memo ?? "");
}}
```

토글 동작: 같은 하이라이트를 다시 클릭하면 팝오버가 닫힙니다.

팝오버에는 `Delete | Memo | Close` 버튼. Memo 클릭 시 textarea 펼쳐짐.

## Ask AI 통합

플로팅 툴바에는 `Ask AI` 버튼도 있음. 클릭 시 `onAskAI(selectedText)` 콜백을 통해 선택한 텍스트를 ChatPanel의 컨텍스트로 전달:

```tsx
// PaperView.tsx
<PdfViewer
  onAskAI={(text) => setSelectedText(text)}
  // ...
/>
```

ChatPanel은 `selectedText`가 설정되면 메시지 입력창 위에 `DragContext`로 표시하고, 다음 메시지 전송 시 API 요청의 `context` 필드에 포함합니다.

## 색상 상수

`src/constants/highlight.ts`에 중앙화:

```typescript
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: "bg-yellow-200/50",
  // ...
};
```

타입 가드로 API 입력 검증:
```typescript
export function isHighlightColor(value: string): value is HighlightColor {
  return (HIGHLIGHT_COLORS as readonly string[]).includes(value);
}
```

`/api/highlights` POST에서 유효하지 않은 색상은 기본값 `"yellow"`로 fallback.

## z-index 이슈와 해결

react-pdf의 `.textLayer`가 `z-index: 2`로 설정되어, HighlightLayer가 그 아래에 가려지면:
- 플로팅 툴바가 안 보임
- 하이라이트 rect 클릭이 먹히지 않음
- 팝오버가 안 보임

해결: HighlightLayer 컨테이너에 `style={{ zIndex: 3 }}` 명시. 컨테이너는 `pointer-events: none`이라 텍스트 선택에 방해되지 않고, 개별 자식(rect, toolbar, popover)만 `pointer-events: auto`로 클릭 가능.
