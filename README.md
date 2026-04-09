# Paper Review Tool

Read academic papers with an AI research mate that auto-builds background knowledge and answers your questions.

## Prerequisites

- **Node.js** 18+
- **Claude Code** installed and authenticated (`npm install -g @anthropic-ai/claude-code && claude` to log in)

## Setup

```bash
npm install
npx prisma db push
```

## Usage

### Open and analyze a paper

```bash
npm run open -- "https://arxiv.org/abs/1706.03762"
```

This will:
1. Download the PDF
2. Launch Claude Code in your terminal for analysis (you can watch and interact)
3. After analysis completes, open the web UI in your browser

You can also open a local PDF:
```bash
npm run open -- ./path/to/paper.pdf
```

### Just open the web UI (for previously analyzed papers)

```bash
npm run dev
```

Open http://localhost:3000

## How it works

1. **Analysis (terminal)**: Claude Code runs interactively, reading the paper, searching for background material, and writing knowledge documents. You see everything in your terminal.

2. **Reading + Chat (web)**: The web UI shows the PDF with highlights, memos, and a chat panel. Chat uses the accumulated knowledge to give deep, contextual answers.

No separate API key needed — uses your existing Claude Code authentication.

## Features

- PDF viewer with page navigation and zoom
- AI analysis: automatic background knowledge building (skim → parallel research → deep read)
- Chat with AI about the paper (with text selection context, Cursor-style)
- Multi-color highlighting with memos
- Citation popover on hover
- Resizable split layout
