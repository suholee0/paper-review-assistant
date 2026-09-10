# Read Together Workflow

## 개요

"같이 읽기"는 Codex가 논문을 사람처럼 단계적으로 이해해가는 3단계 워크플로우입니다.

**철학**: AI에게 "이 논문 요약해줘"라고 한 방에 물어보면 피상적인 답변이 나옵니다. 실제로 사람이 논문을 깊게 이해할 때는 배경지식을 먼저 쌓고, 그 위에서 논문을 다시 읽습니다. 이 워크플로우는 그 과정을 흉내냅니다.

## 3단계 플로우

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Phase 1     │     │  Phase 2         │     │  Phase 3     │
│  Skimming    │ ──► │  Background      │ ──► │  Deep Read   │
│              │     │  Knowledge Build │     │              │
│ 출력:        │     │ 출력:            │     │ 출력:        │
│ topics.json  │     │ background/*.md  │     │ analysis.md  │
└──────────────┘     └──────────────────┘     └──────────────┘
```

## 진입점

- Codex가 `AGENTS.md`를 읽고 흐름 파악
- 사용자가 논문을 함께 읽기를 요청하면 → 등록 후 `skills/read-together.md` 참조
- 해당 논문이 이미 분석됐는지 먼저 확인 (topics/background/analysis의 완성도 검사)
  - 완성본이면 재사용하고 `scripts/serve.ts <id>` 실행
  - 없거나 불완전하면 누락 단계부터 실행

## Phase 1: Skimming

### 목적
논문을 처음부터 끝까지 훑어보고 **"이 논문을 이해하려면 어떤 배경지식이 필요한가?"**를 식별합니다.

### 입력
- 논문 URL 또는 PDF 파일 경로

### 프로세스
1. Codex가 논문을 읽음
   - URL이 주어지면 arXiv HTML 버전(ar5iv, arxiv.org/html) 우선 시도
   - `node scripts/read-paper.mjs <paperDir>`로 모든 페이지 텍스트 추출
   - `--render 1,3,5`로 표·그림·수식 페이지를 이미지로 확인. 추출만으로 정독 완료라 판단하지 않음
   - HTML이 없거나 부록이 누락되어도 PDF 전체를 읽음. 상세 절차: `skills/read-paper.md`
2. 주요 개념, 기법, 선행 연구들을 목록화
3. 각 항목에 간단한 설명 추가

### 출력 형식
`papers/<id>/topics.json`:

```json
[
  {
    "name": "self-attention",
    "description": "Transformer의 토큰 간 상호작용을 이해하는 데 필요한 핵심 연산"
  },
  {
    "name": "seq2seq",
    "description": "이 논문이 개선하려는 기존의 입력·출력 시퀀스 모델링 방식"
  }
]
```

### 품질 체크
- 너무 많이 식별하면 Phase 2가 길어짐 (5~10개 권장)
- 너무 적으면 배경지식 부족 — 논문 이해에 필요한 핵심만

## Phase 2: Background Knowledge Build

### 목적
Phase 1에서 식별한 각 토픽에 대해 **Compact한 치트시트**를 작성합니다.

### 입력
- `topics.json`의 각 항목
- 현재 Codex 환경의 웹 검색·페이지 열기 도구

### 프로세스
각 토픽마다:
1. 웹 검색으로 권위 있는 자료 찾기 (논문, 공식 문서, 교과서)
2. 핵심만 뽑아 compact하게 정리
3. `papers/<id>/background/<topic-name>.md`에 저장

### 출력 형식
각 배경지식 파일은 치트시트여야 하며 **교과서 챕터가 아닙니다**. 3~5 문단, 핵심만.

권장 구조:
```markdown
# <Topic Name>

## What it is
<간결한 설명 3~5 문단>

## Why it exists
<이 개념이 해결하는 문제>

## Key formulas / concepts
<핵심 수식이나 아이디어>

## Relevance to the paper
<이 토픽이 대상 논문과 어떻게 연결되는가>

## Sources
<직접 열어 확인한 출처 링크>
```

### 왜 compact해야 하는가
- Phase 3에서 Codex가 모든 background를 context에 로드해야 함
- 각 파일이 길면 context window가 빠르게 소진됨
- 핵심만 뽑는 연습 자체가 이해를 돕는 훈련

### 병렬 처리
각 토픽을 별도 서브에이전트에게 위임하고 현재 동시 실행 한도에 맞춰 작업자를 재사용합니다. 각 작업자는 배정된 background 파일만 작성하며, 모든 파일을 메인이 검토한 뒤 deep read를 시작합니다. 모델은 기본적으로 부모 설정을 상속합니다. 병렬 도구가 없는 환경에서는 이를 알리고 순차로 진행합니다.

## Phase 3: Deep Reading

### 목적
배경지식을 바탕으로 논문을 섹션별로 깊게 분석합니다.

### 입력
- 원 논문
- `papers/<id>/background/*.md` 모두

### 프로세스
1. background 디렉토리의 모든 파일 읽기
2. 논문을 다시 읽되, 이번에는 배경지식을 연결하며 읽기
3. 섹션별로 분석 작성

### 출력 형식
`papers/<id>/analysis.md`:

```markdown
# <Paper Title>

## Summary
<2~3 문단 요약 — 기여점 중심>

## Section-by-section analysis

### <Section 1>
- **What the authors are saying**: ...
- **How it connects to background knowledge**: ...
- **Key insights or novel contributions**: ...
- **Assumptions or limitations**: ...

### <Section 2>
...

## Key takeaways
<가장 중요한 것들>

## Open questions
<불명확하거나 추가 조사가 필요한 것들>
```

### 완료 신호
Codex는 마지막에 `READ TOGETHER COMPLETE`를 출력합니다.

## 실행 예시

```
User: 이 논문 같이 읽자: https://arxiv.org/abs/1706.03762

Codex:
  1. AGENTS.md 확인
  2. node --import tsx scripts/register-paper.ts https://arxiv.org/abs/1706.03762
     → { id: "abc-123", title: "Attention Is All You Need", ... }
  3. papers/abc-123/analysis.md 존재 확인 → 없음
  4. skills/read-together.md 로드
  5. Phase 1 실행
     - arxiv.org/html/1706.03762 읽기
     - topics.json 저장: [
         { name: "self-attention", description: "..." },
         { name: "positional-encoding", description: "..." },
         ...
       ]
  6. Phase 2 실행 (토픽별 병렬 위임)
     - 웹 검색 + 출처 페이지 확인 ("self-attention mechanism")
     - 핵심 정리
     - background/self-attention.md 저장
     - ... (반복)
  7. Phase 3 실행
     - background/*.md 모두 읽기
     - 논문 섹션별 분석
     - analysis.md 저장
  8. check-paper.ts로 산출물 구조 검사 후 원문과 대조 → "READ TOGETHER COMPLETE"
  9. node --import tsx scripts/serve.ts abc-123
     → 준비 확인 후 URL 안내 (--open이면 브라우저 실행)
```

## 워크플로우 후 웹 UI

분석이 끝나면 웹 UI에서:
- PDF 뷰어로 논문 읽기
- 궁금한 부분을 드래그해서 AI에게 질문 ("이 부분 더 설명해줘")
- AI는 `background/`와 `analysis.md`를 참조해 답변
- 하이라이트 + 메모로 자신만의 독서 기록 만들기

웹 UI의 Q&A와 분석 보강도 공식 Codex SDK로 별도 thread에서 실행합니다. 인증과 권한은 [ai-integration.md](ai-integration.md)를 참고하세요.

## 참고 파일

- `AGENTS.md` — 프로젝트 루트의 Codex 가이드
- `skills/read-together.md` — 워크플로우 정의 (전체 흐름)
- `skills/skim.md` — Phase 1 개별 스킬 (참고용)
- `skills/build-background.md` — Phase 2 개별 스킬 (참고용)
- `skills/deep-read.md` — Phase 3 개별 스킬 (참고용)
