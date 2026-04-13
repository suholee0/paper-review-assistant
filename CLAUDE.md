# Paper Review Tool

논문을 깊게 이해하기 위한 AI 도구. 이 프로젝트에서 Claude Code가 메인 에이전트 역할을 한다.

## 첫 실행 자동 설정

사용자가 논문을 같이 읽자고 요청했는데 `node_modules/` 디렉토리가 없으면, 먼저 setup을 실행한다:

```bash
bash scripts/setup.sh
```

이 스크립트가 `npm install` + `npx prisma db push`를 한번에 처리한다. setup 완료 후 요청된 작업을 이어서 수행한다.

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

## 같이 읽기 (Read Together) Workflow

논문을 같이 읽기 위한 워크플로우. Claude Code가 직접 수행한다. 전체 흐름은 `skills/read-together.md`를 참조.

### 이미 분석된 논문 확인

같이 읽기를 시작하기 전에 먼저 해당 논문이 이미 분석되었는지 확인한다:
1. `papers/<id>/analysis.md` 파일이 존재하는지 확인
2. 존재하면 분석 과정을 스킵하고 바로 웹 UI를 띄운다:
   ```bash
   npx tsx scripts/serve.ts <paper-id>
   ```

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

### 같이 읽기 완료 후
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

## 마크다운 문서 작성 규칙

배경지식(`background/*.md`)과 분석(`analysis.md`) 문서는 웹 UI에서 react-markdown + remark-gfm + KaTeX로 렌더링된다. 다음 규칙을 반드시 지킨다:

### 테이블 안 LaTeX 수식

마크다운 테이블의 `|` 구분자와 LaTeX 기호가 충돌한다. 테이블 셀 안에서:

- **norm**: `\|` 사용 금지 → `\lVert ... \rVert` 사용
- **대괄호**: `\left[`, `\right]` 사용 금지 → `\bigl[`, `\bigr]` 사용
- **조건부 표기**: `x|y` 사용 금지 → `x \mid y` 사용
- **집합 표기**: `\{`, `\}` 는 문제없음

```markdown
# BAD — 테이블 파싱 깨짐
| Loss | $\mathbb{E}\left\[\|f(x)\|^2\right\]$ |

# GOOD
| Loss | $\mathbb{E}\bigl[\lVert f(x)\rVert^2\bigr]$ |
```

### 일반 규칙

- 한국어로 작성
- 수식은 inline `$...$` 또는 display `$$...$$` 사용
- 코드 블록에 언어 태그 명시 (```python, ```bash 등)

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- react-pdf + pdfjs-dist (PDF 뷰어)
- Prisma + SQLite (메타데이터)
- @anthropic-ai/claude-agent-sdk (채팅)
- Tailwind CSS
