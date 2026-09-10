# 같이 읽기 — Codex 실행 지침

이 세션의 Codex가 전체 workflow를 수행한다. 이 문서는 자동 실행 프로그램이 아니라 AGENTS.md에서 참조하는 작업 지침이다.

## 입력과 등록

- `paperSource`: 사용자에게 받은 URL 또는 로컬 경로.
- 저장소 루트에서 `node --import tsx scripts/register-paper.ts <paperSource> [title]`를 실행한다.
- 반환된 `id`, `paperDir`, `pdfPath`를 모든 단계에서 사용한다. 임의로 ID를 만들거나 다른 논문 디렉토리에 저장하지 않는다.
- 지원 입력은 로컬 PDF, arXiv abs/pdf URL, 직접 PDF URL이다. HTML/출판사 URL은 먼저 페이지를 열어 실제 PDF 링크를 찾는다. 등록 결과에 PDF가 없거나 유효하지 않으면 원문을 확보하고 DB의 filePath도 맞춘 뒤 진행한다.
- 기존 topics/background/analysis를 확인한다. 완성된 기존 분석은 재사용하고 UI를 실행한다. 불완전하면 사용자의 편집을 보존하면서 누락 단계부터 이어간다. 완료 여부는 파일 존재만으로 판단하지 않는다.

## Phase 1 — 전체 skim과 background topics

1. `skills/read-paper.md`에 따라 원문 전체를 읽는다. 초록, 검색 요약, 일부 페이지만 읽고 전체 skim이라고 하지 않는다.
2. `skills/skim.md`에 따라 핵심 개념·기법·선행 연구를 추출한다.
3. 다음 배열을 `{{paperDir}}/topics.json`에 저장한다. name은 중복 없는 소문자 영문·숫자·하이픈 slug다. 설명은 한국어로 쓴다.

```json
[
  {"name": "self-attention", "description": "논문의 토큰 간 정보 결합 방식을 이해하는 데 필요한 핵심 연산"}
]
```

## Phase 2 — 토픽별 병렬 조사

**독립된 background 토픽을 서브에이전트에게 병렬 위임한다.** 이 프로젝트는 이 단계의 병렬 위임을 명시적으로 요청한다.

- 현재 제공된 도구를 사용한다. 이 환경에서는 `collaboration.spawn_agent`, `send_message`, `wait_agent`, `followup_task`다. 다른 환경에서는 실제 제공된 대응 도구를 사용한다.
- 동시 실행 한도에서 메인 에이전트 몫을 제외한 만큼만 작업자를 시작한다. 나머지 토픽은 작업자 완료 후 배정한다. idle 작업자는 followup으로 재사용할 수 있다.
- 기본적으로 부모 모델을 상속한다. 특정 제공자 모델명이나 동시 실행 수를 하드코딩하지 않는다.
- 각 작업자는 한 토픽의 문서만 쓴다. topics.json, analysis.md, 다른 작업자의 문서는 메인만 관리한다.
- 작업자에게 아래 입력을 빠짐없이 전달한다. 컨텍스트를 상속하지 않는 환경에서도 독립 수행할 수 있게 절대 경로와 충분한 논문 맥락을 제공한다.

```text
AGENTS.md와 skills/build-background.md를 읽고 따른다.
Topic: <name>
Description: <description>
Paper source: <URL 또는 절대 PDF 경로>
Paper context: <논문 제목, 핵심 주장, 이 토픽이 필요한 섹션/페이지>
Local source: <paperDir>/source/
Output path: <paperDir>/background/<name>.md
웹 검색 후 실제 원문을 열어 조사한다. 한국어 치트시트와 출처 링크를 쓴다.
이 출력 파일만 저장한다. 완료 시 경로·사용 출처·미해결 사항을 메인에 보고한다.
```

메인은 작업자 진행 중 원문 섹션 구조와 그림·수식을 확인한다. 같은 토픽을 중복 조사하지 않는다. 모든 작업자 결과를 기다리고 `node --import tsx scripts/check-paper.ts <paperDir> --backgrounds`로 누락을 검사한 뒤 실제 문서와 출처를 검토한다. 실패/누락 토픽은 재위임하거나 직접 보완한다. 병렬 도구가 없으면 이를 알리고 순차로 진행한다.

## Phase 3 — background 기반 deep read

1. 모든 `background/*.md`를 읽는다. 작업자 완료 메시지만 읽고 대체하지 않는다.
2. `skills/deep-read.md`에 따라 원문을 섹션별로 다시 읽고 근거 페이지를 확인한다.
3. `{{paperDir}}/analysis.md`를 작성한다. 장문이면 먼저 `analysis.draft.md`에 작성하고 완성 후 analysis.md로 옮긴다. 기존 완성본은 새 초안 검토 전에 덮어쓰지 않는다.
4. `node --import tsx scripts/check-paper.ts <paperDir>`를 실행하고 원문 섹션 목록과 대조한다. 검사 통과만으로 정독 완료라고 하지 않는다.

## 완료

- 읽지 못한 페이지, 확인되지 않은 수식/주장, 접근할 수 없었던 출처는 명시한다. 누락이 있으면 전체 읽기를 완료했다고 선언하지 않는다.
- 산출물을 확인한 뒤 `node --import tsx scripts/serve.ts <id>`를 장기 실행 shell 세션에서 실행한다.
- 서버 준비 메시지와 대상 URL 응답을 확인하고 사용자에게 URL 및 analysis.md 경로를 전달한다. GUI 실행은 기본 동작이 아니다.
- 연구 완료 시 `READ TOGETHER COMPLETE`를 출력한다. 서버 실패는 연구 결과와 구분하여 알린다.
