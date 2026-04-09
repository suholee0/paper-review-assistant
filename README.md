# Paper Review Tool

Read academic papers with an AI research mate that auto-builds background knowledge and answers your questions.

## Prerequisites

- **Node.js** 18+
- **Claude Code** installed and authenticated (`npm install -g @anthropic-ai/claude-code && claude` to log in)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Initialize the database:
```bash
npx prisma db push
```

3. Start the dev server:
```bash
npm run dev
```

Open http://localhost:3000

## How it works

This tool uses your existing Claude Code subscription — no separate API key or additional costs needed. The AI features are powered by the Claude Agent SDK, which uses the same authentication as your Claude Code CLI.

Make sure you're logged into Claude Code before using the AI features:
```bash
claude  # This will prompt you to log in if needed
```

## Features

- PDF viewer with page navigation and zoom
- AI analysis: automatic background knowledge building (skim → parallel research → deep read)
- Chat with AI about the paper (with text selection context, Cursor-style)
- Multi-color highlighting with memos
- Citation popover on hover
- Resizable split layout
