# Paper Review Tool - Design Spec

## Overview

논문을 읽을 때 해당 논문과 관련 개념에 대해 깊이 이해하고 있는 AI mate와 함께 읽을 수 있는 로컬 웹 서비스. 논문 밖에 있는 배경지식을 AI가 자동으로 수집/정리하고, 이를 바탕으로 사용자의 질문에 깊이 있는 답변을 제공한다.

### 핵심 가치

- 논문을 읽으며 이해 안 되는 부분을 바로 질문하고 깊이 있는 답변을 얻을 수 있음
- 논문 밖의 배경지식을 AI가 자동으로 수집하여 논문 이해를 도움
- 기존 도구(NotebookLM, Moonlight AI) 대비: 논문을 "읽는 경험" 자체에 포커스

### 레퍼런스

- **NotebookLM**: 논문에 대한 정보를 빼내는 데 집중. 논문과 왔다갔다 불편. 배경지식 없이 피상적 설명
- **Moonlight AI**: 논문 읽기에 포커스된 Chrome Extension. AI 품질이 낮고 별도 구독 필요

## MVP Scope

### 포함

1. PDF 뷰어 (로컬 파일 업로드 + URL)
2. AI 배경지식 빌드 (스키밍 -> 병렬 자료 검색 -> 문서 작성)
3. AI 깊은 읽기 (배경지식 참조 심층 분석)
4. 채팅 (드래그 컨텍스트 첨부, SSE 스트리밍)
5. 하이라이팅/메모 (여러 색상 + 하이라이트 목록)
6. Citation 팝오버 (제목, 저자, 연도 표시)

### 제외 (2차)

- 서지 관리 (논문 목록, 검색, 영구 DB)
- 요약/정리 문서 Export

## Architecture

### 기술 스택

- **프레임워크**: Next.js (풀스택, 모놀리식)
- **언어**: TypeScript
- **PDF 뷰어**: @react-pdf-viewer/core
- **DB**: SQLite + Prisma
- **AI**: Claude Code SDK (@anthropic-ai/claude-code)
- **스트리밍**: Server-Sent Events (SSE)

### 시스템 구조

```
브라우저 (localhost:3000)
  ├── PDF 뷰어 (좌측)
  └── 채팅 패널 (우측)
        │
        │ HTTP + SSE
        ▼
Next.js API Routes
  ├── /api/papers      논문 등록 (업로드/URL)
  ├── /api/analyze     배경지식 빌드 + 깊은 읽기 (SSE)
  ├── /api/chat        채팅 질문/답변 (SSE)
  └── /api/highlights  하이라이팅/메모 CRUD
        │
        ├── Claude Code SDK
        ├── SQLite (Prisma)
        └── 파일 시스템 (papers/)
```

전부 로컬에서 동작. 원격 서버/DB 없음. `npm run dev` 하나로 실행.

### AI 연동

- Claude Code SDK (`@anthropic-ai/claude-code`)를 우선 사용
- OAuth 토큰을 직접 다루거나 추출하지 않음 (ToS 준수)
- 배포 시 Anthropic API 키 방식으로 전환 가능하도록 AI provider 추상화 레이어 설계
- OpenClaw 사례 참고: Consumer 구독 토큰의 제3자 도구 사용은 Anthropic이 금지함

## AI Analysis Flow

### Skill 기반 구조

각 분석 단계를 Claude Code Skill로 정의하여 품질을 독립적으로 튜닝 가능.

```
skills/
  skim.md              스키밍 + 배경지식 리스트업
  build-background.md  단일 토픽 배경지식 문서 작성
  deep-read.md         배경지식 참조 심층 분석
```

### 분석 플로우

```
사용자가 논문을 연다 (파일 업로드 or URL)
  │
  ├─ URL → Claude Code에 URL만 전달
  └─ 파일 → PDF 저장, 경로만 전달
  │
  ▼
[스키밍 Skill] — 세션 1개
  논문을 읽고 배경지식 목록 반환
  → ["transformer", "self-attention", ...]
  │
  ▼
[배경지식 빌드 Skill] — 토픽별 독립 세션, 병렬 실행
  Agent 1: transformer.md
  Agent 2: self-attention.md
  Agent 3: positional-encoding.md
  ...각각 웹 검색 → 자료 수집 → compact 문서 작성
  │
  ▼ (전부 완료)
[깊은 읽기 Skill] — 새 세션
  논문 + background/ 폴더 참조
  → analysis.md 생성
  │
  ▼
분석 완료. 채팅 가능 상태.
```

### 배경지식 문서 형식

compact한 문서. 교과서 챕터가 아닌 치트시트.

- 해당 개념이 무엇인지 (3-5 문단)
- 왜 등장했는지 (기존 방식의 한계)
- 핵심 수식/개념
- 이 논문에서 어떤 맥락으로 쓰이는지

### 논문 텍스트 처리

- URL 입력 시: Claude Code에 URL만 전달. Claude Code가 알아서 HTML 버전(ar5iv 등) 검색해서 읽음
- 파일 업로드 시: PDF 저장 후 경로만 전달
- source.md로의 사전 변환 없음

## Chat System

### 세션 관리

- 분석 세션과 채팅 세션은 분리
- **논문당 하나의 채팅 세션** 유지
- 같은 논문에 대한 질문은 동일 세션에서 이어감 (--resume)
- 대화 맥락이 계속 쌓여서 후속 질문 가능

```
논문 A 열기 → 채팅 세션 A 생성
  질문 1 → 세션 A (--resume sessionA)
  질문 2 → 세션 A (--resume sessionA)
  ...맥락 누적
```

### 채팅 컨텍스트

- 시스템 프롬프트에 `papers/<paper-id>/` 폴더 참조 지시
- background/, analysis.md 파일이 있으므로 필요할 때 Claude Code가 직접 읽음
- 드래그 컨텍스트: 사용자가 PDF에서 텍스트 드래그 시 채팅창에 자동 첨부 (Cursor 스타일)

### 분석 세션을 이어가지 않는 이유

분석 세션은 맥락이 매우 길어져서 채팅 응답이 느려지고 비용도 높아짐. 분석 결과물이 파일로 남아있으므로 채팅 세션에서 필요할 때 읽으면 됨.

## Frontend

### 레이아웃

```
┌──────────────────────────────────────────────────┐
│  [논문 제목]                        [분석 상태]    │
├────────────────────────┬─────────────────────────┤
│                        │  채팅                    │
│     PDF 뷰어           │  - 메시지 목록            │
│                        │  - 드래그 컨텍스트 표시    │
│  - 페이지 네비게이션    │  - SSE 스트리밍 응답      │
│  - 확대/축소           │                          │
│  - 텍스트 드래그 →     │→ [참조: "The att..."]     │
│    컨텍스트 자동 첨부   │  "이 부분 설명해줘"       │
│  - 하이라이팅 (다색상)  │                          │
│  - 메모 추가           │  - 입력창 + 전송 버튼     │
│  - Citation 팝오버     │                          │
├────────────────────────┴─────────────────────────┤
│  하이라이트 목록 (접을 수 있는 하단 패널)            │
└──────────────────────────────────────────────────┘
```

### PDF 뷰어 기능

- `@react-pdf-viewer/core` 기반
- 페이지 네비게이션, 확대/축소
- 텍스트 드래그 → 채팅창에 컨텍스트 자동 첨부
- 하이라이팅: 여러 색상 (yellow, green, blue, pink)
- 메모: 하이라이트에 텍스트 메모 추가
- Citation 팝오버: [1] 같은 인용 위에 마우스 올리면 제목/저자/연도 툴팁

### 채팅 패널

- 리사이즈 가능 (PDF 뷰어와 드래그로 비율 조절)
- 드래그된 텍스트 → 인용 블록으로 표시
- SSE 스트리밍으로 실시간 응답 표시

### 하이라이트 목록

- 하단 접을 수 있는 패널
- 색상별 필터
- 클릭 시 해당 페이지로 이동

## Data Model

### SQLite (Prisma)

```
Paper
  id            String   @id @default(uuid())
  title         String
  url           String?
  filePath      String
  chatSessionId String?
  createdAt     DateTime @default(now())

Highlight
  id            String   @id @default(uuid())
  paperId       String
  paper         Paper    @relation(fields: [paperId], references: [id])
  page          Int
  startOffset   Int
  endOffset     Int
  color         String   @default("yellow")
  memo          String?
  createdAt     DateTime @default(now())
```

### 파일 시스템

```
papers/
  <paper-id>/
    original.pdf          원본 PDF (업로드 시)
    background/
      transformer.md
      self-attention.md
      ...
    analysis.md
```

- DB: 메타데이터 + 하이라이팅/메모
- 파일 시스템: AI 산출물 (배경지식, 분석 결과)
- Claude Code는 파일 시스템을 직접 읽어서 참조

## 향후 확장

- 서지 관리 기능 (논문 목록, 검색, 영구 관리)
- 요약/정리 문서 Export
- AI provider 추상화 (Anthropic API, OpenAI, Gemini 등)
- Chrome Extension 또는 데스크톱 앱으로 배포
- 오픈소스 배포
