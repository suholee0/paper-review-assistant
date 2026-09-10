# Chat System

## 개요

AI와 논문에 대해 실시간으로 대화하는 기능. Codex SDK를 사용하며, SSE로 응답을 스트리밍합니다.

## 데이터 흐름

```
User input
  ↓
ChatPanel.handleSend()
  ↓
POST /api/chat (JSON)
  ↓
route.ts: paper 조회 → prompt 구성 → CodexProvider.query()
  ↓
Codex SDK: 모델 호출 (+tool-use 라운드트립)
  ↓
스트림 이벤트를 AIResponse로 정규화
  ↓
SSE 청크로 인코딩 → 클라이언트
  ↓
ChatPanel: 버퍼 파싱 → state 업데이트
  ↓
MessageList: 렌더링 (마크다운 + 수식)
```

## API: `/api/chat`

### 요청
```typescript
POST /api/chat
Content-Type: application/json

{
  paperId: string,
  message: string,
  context?: string,  // 드래그한 텍스트 (Ask AI)
  model?: "default"  // CODEX_MODEL 또는 서버의 Codex 설정
}
```

### 응답: SSE 스트림
```
data: {"type":"tool_use","name":"command_execution","summary":"명령 실행: cat analysis.md"}

data: {"type":"text","content":"Based on the paper, the authors propose..."}

data: {"type":"done","sessionId":"codex:<UUID>"}
```

### 이벤트 종류
- `text` — SDK의 완료된 메시지. 토큰 delta가 아닌 메시지 단위 스트리밍
- `tool_use` — AI가 tool을 호출 중임을 알림
- `done` — 응답 완료, 세션 ID 포함
- `error` — 에러 발생

## 프롬프트 구성

### 첫 메시지 (Codex 세션 없음)
```
You are a knowledgeable research assistant helping a user understand a paper.

Paper: <url or filePath>
Background knowledge and analysis are in: <paperDir>
Read the background/ directory and analysis.md if they exist to understand the paper deeply.

User question: <message>
```

Codex SDK가 이 지시를 받으면 read-only sandbox에서 배경지식 파일을 읽은 뒤 답변합니다. 이 과정은 여러 차례의 tool-use 라운드트립을 포함할 수 있습니다.

### 이후 메시지 (세션 resume)
DB의 `codex:<UUID>`에서 UUID를 추출하여 SDK의 `resumeThread()`에 전달하면 이전 대화 맥락과 이미 읽은 파일 내용이 유지됩니다. 프롬프트에는 새 질문만 추가:

```
User question: <message>
```

### context (Ask AI)
드래그한 텍스트가 있으면:
```
The user selected this text from the paper:
> <selected text>

User question: <message>
```

## Codex SDK 통합

`src/lib/ai/codex.ts`가 공식 SDK를 AIProvider 계약으로 변환합니다. 인증·설정·취소 처리는 [ai-integration.md](ai-integration.md)를 참고하세요.

- 채팅: 논문 디렉토리에서 `read-only`, 웹 검색 `live`
- 분석 보강: 논문 디렉토리에서 `workspace-write`, 웹 검색 `disabled`
- 공통: `approvalPolicy: never`, shell 네트워크 접근 비활성화

### 메시지 스트림 처리

1. `item.completed`의 `agent_message`는 ID별 한 번만 `text`로 전달합니다. `item.updated` snapshot을 텍스트 delta로 취급하지 않습니다.
2. 명령 실행·검색·파일 변경·MCP 도구 이벤트는 한국어 `tool_use` 상태로 전달합니다.
3. `turn.completed` 및 정상 스트림 종료 후 `done`을 전달합니다. 실패·인증 오류·중단은 `error`이며 성공으로 표시하지 않습니다.

### 세션 관리

성공한 응답의 thread ID를 `codex:<UUID>` 형태로 `Paper.chatSessionId`에 저장하고 이후 요청에서 재개합니다. 이전 runtime ID는 Codex 세션으로 전달하지 않으며 새 대화를 시작합니다. 기존 브라우저 메시지는 유지하지만 이전 runtime의 대화 맥락은 자동 이관하지 않습니다.

## SSE 스트리밍 상세

### 서버 측 (route.ts)
`ReadableStream`을 사용해 SSE 스트림 생성:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    for await (const chunk of provider.query({...})) {
      if (chunk.type === "text") {
        controller.enqueue(encoder.encode(sseEncode({ type: "text", content: chunk.content })));
      }
      if (chunk.type === "tool_use") {
        controller.enqueue(encoder.encode(sseEncode({ type: "tool_use", name: chunk.name, summary: chunk.summary })));
      }
      // ...
    }
    controller.close();
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
```

`sseEncode()`는 `src/lib/sse.ts`의 공통 유틸:
```typescript
export function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
```

### 클라이언트 측 (ChatPanel)
`ReadableStream`을 `getReader()`로 읽고, 청크를 버퍼에 누적한 뒤 `\n\n`으로 분리해서 파싱:

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = "";
let streamError = "";
let completed = false;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });  // stream: true로 multi-byte 안전

  const parts = buffer.split("\n\n");
  buffer = parts.pop() || "";  // 마지막은 미완성일 수 있으므로 버퍼에 유지

  for (const part of parts) {
    const line = part.trim();
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "text") {
          fullContent += data.content;
          setStreamingContent(fullContent);
          setToolActivity(null);  // 텍스트 시작되면 tool 메시지 클리어
        } else if (data.type === "tool_use") {
          setToolActivity(data.summary);
        } else if (data.type === "error") {
          streamError = data.message;
        } else if (data.type === "done") {
          completed = true;
        }
      } catch {
        // 깨진 메시지 무시
      }
    }
  }
}
```

HTTP 오류, SSE error 또는 done 이전의 연결 종료는 성공한 답변으로 저장하지 않고 사용자에게 오류로 표시합니다.

### 왜 버퍼가 필요한가
청크가 `\n\n` 경계를 가로질러 분할될 수 있습니다. 예:
- chunk 1: `data: {"type":"text","con`
- chunk 2: `tent":"hello"}\n\ndata: {"t`

단순히 `split("\n\n")`만 하면 깨집니다. 버퍼에 누적한 뒤 마지막 부분(완성되지 않았을 수 있음)은 버퍼로 되돌리는 패턴이 올바른 SSE 처리입니다.

## 프리셋 질문 버튼

채팅 내역이 비어있을 때 빠른 질문 버튼 표시:

- **일반 프리셋**: "이 논문의 핵심을 요약해줘", "이 논문의 주요 contribution이 뭐야?"
- **배경지식 프리셋**: `/api/papers/[id]/status`에서 `backgroundTopics`를 가져와 동적 생성. 클릭 시 `"<topic>에 대해 설명해줘"` 전송
- **텍스트 선택 프리셋**: 텍스트 드래그 시 DragContext 아래에 "이 부분 설명해줘" 버튼 표시

첫 메시지 전송 후 프리셋 버튼은 자동 숨김.

## 분석 보강 (ExportButton)

ChatPanel 헤더의 "분석 보강" 버튼. 채팅 내역이 있을 때만 활성화.

**흐름**:
1. 클릭 → 컨펌 다이얼로그 (메시지 수 표시)
2. "보강하기" → `POST /api/papers/[id]/export` (SSE 스트리밍)
3. AI가 기존 analysis.md + 채팅 기록을 읽고 문서 보강
4. 진행 상황 오버레이 (tool activity 표시)
5. 파일이 비어 있지 않고 실제로 변경되었는지 서버에서 확인한 뒤 완료 시 하단 토스트 "분석 문서가 업데이트되었습니다"
6. 사용자는 "분석" 탭에서 보강된 문서 확인. 실행 실패나 변경 없는 결과는 오류로 표시

## 메시지 영속화

채팅 메시지를 `localStorage`에 `chat:<paperId>` 키로 저장. 마운트 시 복원. SSR hydration 불일치 방지를 위해 초기 상태는 빈 배열 → `useEffect`에서 복원.

## UI 렌더링

### 메시지 리스트 (MessageList.tsx)
- **사용자 메시지**: plain text (`whitespace-pre-wrap`)
- **AI 메시지**: 공유 `MarkdownContent` 컴포넌트 (`remark-gfm` + `remark-math` + `rehype-katex`)로 렌더링
- **스트리밍 중**: `streamingContent`를 동일한 `MarkdownContent` 컴포넌트로 렌더 (실시간)

### 로딩 상태
`isLoading && !streamingContent`일 때:
- `toolActivity`가 있으면 → 박스 UI로 tool 메시지 표시 ("📖 ... 읽는 중")
- 없으면 → bouncing dots 3개

### 마크다운 커스터마이징
`MarkdownContent` 컴포넌트에서 Tailwind 클래스로 요소별 스타일 지정:
- 헤딩: `text-lg font-bold mt-3 mb-1` (h1), `text-base font-bold` (h2), ...
- 코드 인라인: `bg-gray-100 text-gray-800 px-1 rounded text-xs font-mono`
- 코드 블록: `bg-gray-100 rounded-md p-3 my-2 overflow-x-auto text-xs`
- 블록 인용: 왼쪽 회색 border + 이탤릭
- 테이블: 가로 스크롤 컨테이너 + border
- 링크: 파란색 + underline + `target="_blank"`

### 수식 렌더링
`rehype-katex`가 `$...$` (inline) 및 `$$...$$` (block) 수식을 KaTeX로 렌더. `katex/dist/katex.min.css`를 MessageList에서 임포트해야 스타일 적용됨.

## 모델 선택

`src/constants/models.ts`:
```typescript
export const AVAILABLE_MODELS = [
  { id: "default", label: "Codex (기본 모델)" },
] as const;

export type ChatModelId = (typeof AVAILABLE_MODELS)[number]["id"];
export const DEFAULT_CHAT_MODEL: ChatModelId = "default";
```

ChatPanel 헤더에 `<select>` 드롭다운으로 노출. 로딩 중에는 비활성화. 기본값은 서버 CODEX_MODEL 또는 로컬 Codex 설정을 따릅니다.

## 응답 속도 관련

첫 메시지는 느릴 수 있습니다. 이유:
1. Codex가 `background/*.md`와 `analysis.md`를 먼저 읽어야 함 (파일 읽기 tool-use 라운드트립)
2. 이 과정에서는 완료된 응답 메시지가 없음 (사용자는 loading dots + tool activity만 봄)

**완화책**:
- Tool-use 진행 상황을 UI에 실시간 표시 (📖 ... 읽는 중) — 구현됨
- thread resume으로 이전 대화 맥락 재사용 — 구현됨

더 빠르게 하려면 서버에서 background 파일을 미리 읽어 프롬프트에 주입하는 방법이 있지만, 첫 요청의 프롬프트 크기가 커지는 트레이드오프가 있습니다.
