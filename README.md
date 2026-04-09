# Paper Review Tool

Read academic papers with an AI research mate that auto-builds background knowledge and answers your questions.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key.

3. Initialize the database:
```bash
npx prisma db push
```

4. Start the dev server:
```bash
npm run dev
```

Open http://localhost:3000

## Features

- PDF viewer with page navigation and zoom
- AI analysis: automatic background knowledge building
- Chat with AI about the paper (with text selection context)
- Multi-color highlighting with memos
- Citation popover on hover
- Resizable split layout
