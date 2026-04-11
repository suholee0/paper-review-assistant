# AI Integration

## @anthropic-ai/claude-agent-sdk

이 프로젝트는 **Claude Agent SDK**를 사용합니다. 이는 Claude Code의 내부 엔진을 라이브러리로 노출한 것으로, 사용자의 기존 Claude Code 로그인을 재사용합니다.

### 왜 Claude Agent SDK인가?

대안들과 비교:

| 방법 | 장점 | 단점 |
|------|------|------|
| `@anthropic-ai/sdk` (raw API) | 단순 | 사용자에게 API 키를 받아야 함 (과금) |
| Claude Code CLI spawn | 사용자 구독 재사용 | 셸 이스케이핑, 프로세스 관리 복잡 |
| **Claude Agent SDK** | 사용자 구독 재사용, JS API | 잘 알려지지 않음 |

Anthropic 이용약관상 Consumer 구독 OAuth 토큰을 제3자 앱에서 재사용하는 것은 금지되어 있으나(OpenClaw 선례), **Claude Agent SDK**는 공식 라이브러리로 같은 인증을 사용합니다. 사용자가 본인 기기에서 본인 구독으로 쓰는 것은 개인 사용이므로 안전합니다.

**단, 이 프로젝트를 배포할 때는 사용자가 각자 Claude Code를 설치하고 로그인해야 합니다**. 타인의 토큰을 사용하는 것은 불가합니다.

## Provider 추상화

`src/lib/ai/provider.ts`:
```typescript
export type AIResponse =
  | { type: "text"; content: string }
  | { type: "progress"; message: string }
  | { type: "tool_use"; name: string; summary: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; message: string };

export interface AIQueryOptions {
  prompt: string;
  sessionId?: string;
  cwd?: string;
  allowedTools?: string[];
  model?: string;
}

export interface AIProvider {
  query(options: AIQueryOptions): AsyncGenerator<AIResponse>;
}
```

현재 구현체는 `ClaudeAgentProvider`만 존재. 필요 시 다른 provider로 교체 가능한 구조.

`getAIProvider()`는 싱글톤을 반환:
```typescript
let instance: AIProvider | null = null;
export function getAIProvider(): AIProvider {
  if (!instance) instance = new ClaudeAgentProvider();
  return instance;
}
```

## ClaudeAgentProvider 구현

`src/lib/ai/claude-agent.ts`.

### 생성자
상태 없음. 각 `query()` 호출은 독립적.

### query() 메서드

```typescript
async *query(options: AIQueryOptions): AsyncGenerator<AIResponse> {
  const { prompt, sessionId, cwd, allowedTools, model } = options;
  
  const sdkOptions = {
    cwd: cwd || process.cwd(),
    allowedTools: allowedTools || defaultAllowedTools,
    ...(model && { model }),
    ...(sessionId && { resume: sessionId }),
  };

  for await (const message of query({ prompt, options: sdkOptions })) {
    // message 종류별 처리
  }
}
```

### SDK 메시지 타입

Claude Agent SDK는 여러 종류의 메시지를 async generator로 반환합니다:

#### `assistant` 메시지
모델의 응답. `content` 배열에 `text` 또는 `tool_use` 블록이 들어있음:
```typescript
{
  type: "assistant",
  message: {
    content: [
      { type: "text", text: "답변 시작..." },
      { type: "tool_use", name: "Read", input: { file_path: "..." } },
    ]
  },
  session_id: "..."
}
```

처리:
- `text` 블록: 로그만 남김 (실제 스트리밍은 `stream_event`에서)
- `tool_use` 블록: `summarizeToolUse()`로 변환 후 yield

#### `stream_event`
실시간 텍스트 델타:
```typescript
{
  type: "stream_event",
  event: {
    type: "content_block_delta",
    delta: { type: "text_delta", text: "hel" }
  }
}
```

처리: `text_delta`만 추출해 yield.

#### `result`
최종 결과:
```typescript
{
  type: "result",
  subtype: "success" | "error",
  result?: string,   // 성공 시 전체 응답
  errors?: string[], // 실패 시 에러 목록
  session_id: string
}
```

처리:
- 성공: sessionId를 `done` 이벤트로 yield
- 실패: error yield

### Tool-Use 요약

```typescript
function summarizeToolUse(name: string, input: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  
  switch (name) {
    case "Read": {
      const filePath = typeof inp.file_path === "string" ? inp.file_path : "";
      const base = filePath ? path.basename(filePath) : "파일";
      return `📖 ${base} 읽는 중`;
    }
    case "Glob":    return `🔍 파일 검색 중: ${inp.pattern}`;
    case "Grep":    return `🔍 내용 검색 중: ${inp.pattern}`;
    case "WebSearch": return `🌐 웹 검색 중: ${inp.query}`;
    case "WebFetch":  return `🌐 페이지 가져오는 중: ${inp.url}`;
    case "Bash":    return `⚙️ 명령 실행 중: ${(inp.command as string).slice(0, 60)}`;
    default:        return `🔧 ${name} 실행 중`;
  }
}
```

이 함수의 결과가 채팅 UI의 `toolActivity` state로 전달되어 "AI가 지금 뭘 하고 있는지" 실시간 표시됩니다.

## Tool 권한

### 기본값
```typescript
const defaultAllowedTools = [
  "Read", "Write", "Edit",
  "Bash", "Glob", "Grep",
  "WebSearch", "WebFetch",
];
```

채팅과 분석 모두 같은 세트를 사용. 분석은 파일 작성(Write)과 웹 검색(WebSearch)이 필요하고, 채팅은 파일 읽기(Read, Glob)가 필요합니다.

### 왜 `allowedTools`로 명시하는가
이전 시도에서 `permissionMode: "acceptEdits"`를 썼더니 WebSearch/WebFetch에 대해 계속 권한 요청이 와서 무한 루프에 빠졌습니다. `allowedTools`로 명시적 허용이 더 안정적입니다.

### 보안 고려
`Bash`를 포함하고 있어 임의 명령 실행이 가능합니다. 이 프로젝트는 개인 로컬 사용이 전제이므로 문제되지 않지만, 다중 사용자 환경이라면 Bash를 제거해야 합니다.

## 세션 관리

### 첫 메시지
`chatSessionId`가 없음 → 시스템 프롬프트로 논문 맥락 설명 + SDK가 파일 읽기 수행

### 응답 완료 시
SDK가 반환한 `session_id`를 `Paper.chatSessionId`에 저장:
```typescript
if (chunk.type === "done" && chunk.sessionId && !paper.chatSessionId) {
  await prisma.paper.update({
    where: { id: paper.id },
    data: { chatSessionId: chunk.sessionId },
  });
}
```

### 이후 메시지
`sdkOptions.resume = chatSessionId` → SDK가 이전 대화와 읽은 파일 맥락을 유지. 새 프롬프트는 질문만 담으면 됨.

## 로깅

현재는 `console.log` 직접 사용:
- `[claude-agent]` 쿼리 시작, cwd, sessionId
- `[claude]` assistant 텍스트 응답 (첫 200자)
- `[claude] Tool:` tool_use 호출

개발 환경에서 "AI가 지금 뭘 하는지" 터미널로 확인하기 위함. 프로덕션에서는 디버그 플래그로 gate하는 것이 이상적이나 현재는 미구현.

## 에러 처리

SDK 호출 실패 시:
```typescript
try {
  for await (const message of query({...})) { ... }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  yield { type: "error", message };
}
```

`route.ts`에서 이를 받아 SSE로 `type: "error"` 이벤트 전송. ChatPanel은 에러 메시지를 "Error: Failed to get response."로 대체 표시.

## 향후 개선 가능성

1. **배경지식 주입**: 서버에서 background 파일을 미리 읽어 프롬프트에 포함 → tool-use 라운드트립 제거, 첫 응답 가속화
2. **`maxTurns: 1`**: SDK가 여러 턴의 tool-use 사이클을 돌리는 것을 막아 응답 종료 시점 앞당김
3. **Chat 전용 tool 축소**: Q&A에는 `Read`, `Glob`만 있으면 충분. Bash/Write/Edit 제거
4. **로그 게이팅**: `NODE_ENV === "development"` 체크 추가
