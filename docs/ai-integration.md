# Codex AI runtime

웹 채팅과 분석 보강은 `src/lib/ai/codex.ts`의 CodexProvider를 통해 공식 `@openai/codex-sdk`를 사용한다. AIProvider의 async generator와 SSE 이벤트 형식은 유지한다.

## 설치·인증

`npm ci`로 SDK 및 버전이 고정된 Codex CLI 의존성을 설치한다. 웹 서버를 실행하는 OS 사용자로 `npx --no-install codex login`을 수행하고 `npx --no-install codex login status`로 확인한다. 인증 파일은 SDK/CLI가 처리하며 앱이 토큰을 브라우저에 전달하지 않는다. 서버 사용자에게 Codex의 인증·세션 저장소 접근 권한이 있어야 한다.

- `CODEX_PATH`: 선택적인 CLI 경로. 없으면 SDK에 함께 설치된 실행 파일 사용
- `CODEX_MODEL`: 선택적인 모델 ID. 없으면 Codex의 로컬 모델 설정 사용
- SDK 생성은 첫 요청에 지연하여 빌드에 로그인이나 모델 호출이 필요하지 않도록 한다.
- Next.js `serverExternalPackages`에 SDK를 등록하여 실행 파일 탐색이 번들 경로에 영향을 받지 않게 한다.

## Provider 계약

```typescript
interface AIQueryOptions {
  prompt: string;
  sessionId?: string;
  cwd?: string;
  access?: "read-only" | "workspace-write";
  webSearch?: boolean;
  signal?: AbortSignal;
  model?: string;
}
```

`query()`는 text, tool_use, done, error 이벤트를 생성한다. API routes가 기존 `data: <JSON>\n\n` SSE로 변환한다.

| SDK 이벤트 | 기존 계약 |
| --- | --- |
| item.completed / agent_message | text (완료된 메시지를 ID별 한 번 전달) |
| command_execution, web_search, file_change, mcp_tool_call | tool_use (같은 작업 ID 중복 표시 방지) |
| turn.completed + 정상 스트림 종료 | done + codex 접두어 세션 ID |
| turn.failed, error, 실행 예외, 불완전 종료 | error; done을 보내지 않음 |

SDK의 item.updated는 토큰 delta가 아닌 snapshot이다. 텍스트는 완료 메시지 단위로 보내고 중간 작업 상황은 tool_use로 보낸다. reasoning 내용은 사용자 텍스트에 섞지 않는다.

## 권한

- 채팅: `sandboxMode: read-only`, `webSearchMode: live`
- 분석 보강: `sandboxMode: workspace-write`, 논문 디렉토리를 workingDirectory로 지정, 웹 검색 disabled
- 공통: `approvalPolicy: never`, shell 네트워크 접근 disabled, 앱이 추가하는 쓰기 디렉토리 없음

sandbox는 파일·프로세스 접근 정책이며 개별 도구 이름 allowlist가 아니다. read-only도 Codex 자체의 인증·thread 기록 저장에는 호스트 쓰기 권한이 필요하다. workspace-write는 작업 경로 및 runtime이 허용하는 임시 경로 등에 대한 정책이며 단일 파일 ACL이 아니다. `analysis.md`만 수정하는 것은 개발자 지침이고 파일별 OS 권한으로 강제하지 않는다. 사용자의 로컬 Codex 설정 및 호스트 제약도 적용된다. never 정책은 sandbox를 우회하지 않으며 승인 필요한 작업은 거절된다. 웹 runtime 개발자 지침은 현재 질문/보강만 수행하고 전체 분석 workflow나 서버 실행을 시작하지 않도록 한다.

## 세션 전환

DB의 기존 chatSessionId 필드를 그대로 사용한다. 새 ID는 `codex:<UUID>`다. 이 형식만 resumeThread에 전달하고, 다른 형식이면 논문 맥락을 포함한 새 thread를 시작한다. 성공 시 DB에 새 ID를 기록한다. 기존 로컬 메시지·논문 파일은 보존하지만 이전 runtime의 대화 내용은 Codex thread에 자동 주입되지 않는다.

인증 오류나 존재하지 않는 Codex thread는 오류로 반환한다. 임의로 세션을 새로 만들어 문제를 숨기지 않는다. 같은 서버 프로세스에서 동일 논문의 동시 AI 요청은 충돌 오류를 반환한다.

## 종료·보강 검증

요청의 AbortSignal과 10분 timeout을 SDK에 전달한다. 스트림 소비자가 generator를 닫으면 작업도 중단하고 논문 잠금을 해제한다. SDK가 완료 이벤트 후 비정상 종료해도 성공으로 처리하지 않는다.

분석 보강은 별도 thread에서 analysis.md를 수정한다. route는 성공 후 파일이 비어 있지 않고 실제 변경되었는지 검사한 뒤 기존 done/content 이벤트를 보낸다. 문서 내용의 의미적 정확성은 사용자가 검토한다.

## 검증

`npm test`는 SDK 이벤트/실패/중단 및 API SSE 계약을 검사한다. `npm run build`는 프로덕션 번들 생성을 확인한다. 실제 인증을 사용하는 검증은 `npm run test:codex`로 실행한다. 임시 논문 디렉토리에서 파일 읽기, thread 재개, 문서 수정을 확인하고 정리한다. 실제 모델 요청 3회가 발생하며 thread 기록은 Codex 저장소에 남는다. smoke test는 `.env.local`을 자동으로 읽지 않으므로 CODEX_MODEL/CODEX_PATH는 shell에 설정한다.

참고: [공식 Codex SDK 문서](https://learn.chatgpt.com/docs/codex-sdk), 설치된 SDK 0.154.0의 ThreadOptions 및 ThreadEvent 타입.
