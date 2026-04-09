# Paper Review Tool

논문을 읽을 때 AI mate와 함께 깊게 이해할 수 있는 도구.

## Prerequisites

- **Node.js** 18+
- **Claude Code** installed and authenticated

## Setup

```bash
npm install
npx prisma db push
```

## Usage

### 1. 논문 등록

```bash
npm run paper:register -- "https://arxiv.org/abs/1706.03762"
```

### 2. Claude Code에서 분석

Claude Code 터미널에서 이 프로젝트를 열고 분석을 요청한다:

```
이 논문을 분석해줘: https://arxiv.org/abs/1706.03762
```

Claude Code가 `CLAUDE.md`를 읽고 분석 워크플로우를 따라 실행한다.
스키밍 → 배경지식 빌드 → 깊은 읽기까지 터미널에서 직접 확인 가능.

### 3. 웹 UI에서 읽기 + 채팅

```bash
npm run paper:serve -- <paper-id>
```

PDF 뷰어 + 채팅 인터페이스가 브라우저에 열린다.

## Features

- PDF viewer with page navigation and zoom
- AI analysis: background knowledge building (skim → research → deep read)
- Chat with AI about the paper (Cursor-style text selection context)
- Multi-color highlighting with memos
- Citation popover on hover
- Resizable split layout
