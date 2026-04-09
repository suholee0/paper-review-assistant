# Paper Review Tool

논문을 깊게 이해하기 위한 AI 도구. 이 프로젝트에서 Claude Code가 메인 에이전트 역할을 한다.

## Available CLI Tools

Claude Code에서 직접 호출 가능한 스크립트들:

### 논문 등록
```bash
npx tsx scripts/register-paper.ts <url-or-filepath> [title]
```
PDF 다운로드 + DB 등록 + 디렉토리 생성. JSON 출력: `{ id, title, paperDir, pdfPath }`

### 웹 UI 띄우기
```bash
npx tsx scripts/serve.ts [paper-id]
```
웹 서버 시작 + 브라우저 오픈. paper-id 생략 시 랜딩 페이지.

### 논문 목록
```bash
npx tsx scripts/list-papers.ts
```
등록된 논문 목록 + 분석 상태 JSON 출력.

## Analysis Workflow

논문 분석은 Claude Code가 직접 수행한다. 전체 흐름을 한번에 하려면 `skills/analyze.md`를 참조.

### Phase 1: 스키밍
논문을 읽고 배경지식이 필요한 토픽을 식별한다.
- 결과: `papers/<id>/topics.json`

### Phase 2: 배경지식 빌드
각 토픽에 대해 웹 검색으로 자료를 모아 compact한 문서를 작성한다.
- 결과: `papers/<id>/background/<topic>.md`
- 형식: 치트시트 (3-5 문단, 핵심만)

### Phase 3: 깊은 읽기
배경지식을 참조하여 논문을 섹션별로 심층 분석한다.
- 결과: `papers/<id>/analysis.md`

### 분석 완료 후
```bash
npx tsx scripts/serve.ts <paper-id>
```
웹 UI에서 PDF 읽기 + 채팅 가능.

## File Structure

```
papers/<paper-id>/
  original.pdf          # 논문 PDF
  topics.json           # 스키밍 결과 (배경지식 토픽 목록)
  background/            # 배경지식 문서들
    <topic>.md
  analysis.md           # 깊은 읽기 결과
```

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- react-pdf + pdfjs-dist (PDF 뷰어)
- Prisma + SQLite (메타데이터)
- @anthropic-ai/claude-agent-sdk (채팅)
- Tailwind CSS
