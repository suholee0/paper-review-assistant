# Chat System

## 개요

AI와 논문에 대해 실시간으로 대화하는 기능. Claude Agent SDK를 사용하며, SSE로 응답을 스트리밍합니다.

## 데이터 흐름

```
User input
  ↓
ChatPanel.handleSend()
  ↓
POST /api/chat (JSON)
  ↓
route.ts: paper 조회 → prompt 구성 → ClaudeAgentProvider.query()
  ↓
Claude Agent SDK: 모델 호출 (+tool-use 라운드트립)
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
  model?: "claude-sonnet-4-6" | "claude-opus-4-6"
}
```

### 응답: SSE 스트림
```
data: {"type":"tool_use","name":"Read","summary":"📖 analysis.md 읽는 중"}

data: {"type":"text","content":"Based on the paper"}

data: {"type":"text","content":", the authors propose..."}

data: {"type":"done","sessionId":"abc-123"}
```

### 이벤트 종류
- `text` — 텍스트 델타 (실시간 스트리밍)
- `tool_use` — AI가 tool을 호출 중임을 알림
- `done` — 응답 완료, 세션 ID 포함
- `error` — 에러 발생

## 프롬프트 구성

### 첫 메시지 (세션 없음)
```
You are a knowledgeable research assistant helping a user understand a paper.

Paper: <url or filePath>
Background knowledge and analysis are in: <paperDir>
Read the background/ directory and analysis.md if they exist to understand the paper deeply.

User question: <message>
```

Claude Agent SDK가 이 지시를 받으면 `Read`, `Glob` tool을 사용해서 배경지식 파일을 읽은 뒤 답변합니다. 이 과정은 여러 차례의 tool-use 라운드트립을 포함할 수 있습니다.

### 이후 메시지 (세션 resume)
SDK의 `resume` 옵션에 `chatSessionId`를 전달하면 이전 대화 맥락과 이미 읽은 파일 내용이 유지됩니다. 프롬프트에는 새 질문만 추가:

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

## Claude Agent SDK 통합

`src/lib/ai/claude-agent.ts`가 SDK를 래핑합니다.

### 기본 옵션
```typescript
const sdkOptions = {
  cwd: paperDir,
  allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch"],
  model: "claude-sonnet-4-6",  // 또는 Opus
  resume: chatSessionId,       // 세션 이어가기
};
```

### 메시지 스트림 처리
SDK의 `query()`는 async generator로 메시지를 반환합니다. 종류:

1. **`assistant` 메시지** — 모델의 응답 (텍스트 + tool_use 블록 포함)
   - `tool_use` 블록 감지 시 → `summarizeToolUse()`로 사용자 친화 메시지 생성 → yield
2. **`stream_event`** — 실시간 text delta
   - `content_block_delta` + `text_delta` 타입만 추출 → yield
3. **`result`** — 최종 결과
   - 성공: sessionId yield
   - 실패: error yield

### Tool-Use 요약

`summarizeToolUse(name, input)` 함수가 tool 호출을 한국어 메시지로 변환:

```typescript
switch (name) {
  case "Read":       return `📖 ${basename} 읽는 중`;
  case "Glob":       return `🔍 파일 검색 중: ${pattern}`;
  case "Grep":       return `🔍 내용 검색 중: ${pattern}`;
  case "WebSearch":  return `🌐 웹 검색 중: ${query}`;
  case "WebFetch":   return `🌐 페이지 가져오는 중: ${url}`;
  case "Bash":       return `⚙️ 명령 실행 중: ${command}`;
  default:           return `🔧 ${name} 실행 중`;
}
```

이 메시지는 채팅 UI에서 "AI가 지금 뭘 하고 있는지" 보여주는 데 사용됩니다.

### 세션 관리
첫 메시지 처리 후 SDK가 반환한 `session_id`를 `Paper.chatSessionId`로 DB에 저장. 두 번째 메시지부터는 이 세션을 resume해서:
- 이전 대화 맥락 유지
- 이미 읽은 파일을 다시 읽지 않음 (속도 개선)

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
        }
      } catch {
        // 깨진 메시지 무시
      }
    }
  }
}
```

### 왜 버퍼가 필요한가
청크가 `\n\n` 경계를 가로질러 분할될 수 있습니다. 예:
- chunk 1: `data: {"type":"text","con`
- chunk 2: `tent":"hello"}\n\ndata: {"t`

단순히 `split("\n\n")`만 하면 깨집니다. 버퍼에 누적한 뒤 마지막 부분(완성되지 않았을 수 있음)은 버퍼로 되돌리는 패턴이 올바른 SSE 처리입니다.

## UI 렌더링

### 메시지 리스트 (MessageList.tsx)
- **사용자 메시지**: plain text (`whitespace-pre-wrap`)
- **AI 메시지**: `<ReactMarkdown>` + `remarkMath` + `rehypeKatex`로 마크다운과 수식 렌더링
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
  { id: "claude-sonnet-4-6", label: "Sonnet" },
  { id: "claude-opus-4-6", label: "Opus" },
] as const;

export type ChatModelId = (typeof AVAILABLE_MODELS)[number]["id"];
export const DEFAULT_CHAT_MODEL: ChatModelId = "claude-sonnet-4-6";
```

ChatPanel 헤더에 `<select>` 드롭다운으로 노출. 로딩 중에는 비활성화. 기본값은 Sonnet(더 빠름).

## 응답 속도 관련

첫 메시지는 느릴 수 있습니다. 이유:
1. Claude가 `background/*.md`와 `analysis.md`를 먼저 읽어야 함 (Read/Glob tool-use 라운드트립)
2. 이 과정에서는 text delta가 없음 (사용자는 loading dots + tool activity만 봄)

**완화책**:
- Tool-use 진행 상황을 UI에 실시간 표시 (📖 ... 읽는 중) — 구현됨
- 세션 resume으로 두 번째 메시지부터는 빠름 — 구현됨
- 기본 모델을 Sonnet으로 — 구현됨

더 빠르게 하려면 서버에서 background 파일을 미리 읽어 프롬프트에 주입하는 방법이 있지만, 첫 요청의 프롬프트 크기가 커지는 트레이드오프가 있습니다.
