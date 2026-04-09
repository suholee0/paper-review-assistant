# Paper Review Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that lets users read academic papers alongside an AI mate that auto-builds background knowledge and answers questions with deep understanding.

**Architecture:** Monolithic Next.js 15 (App Router) fullstack app. PDF rendered in browser via react-pdf, AI powered by Claude Agent SDK with skill-based analysis pipeline, data stored locally in SQLite + file system.

**Tech Stack:** Next.js 15, TypeScript, react-pdf + pdfjs-dist, Prisma + SQLite, @anthropic-ai/claude-agent-sdk, Tailwind CSS, Server-Sent Events

**Spec:** `docs/superpowers/specs/2026-04-09-paper-review-tool-design.md`

**Note:** Design spec listed @react-pdf-viewer/core but it is unmaintained. Using react-pdf + pdfjs-dist instead.

---

## File Structure

```
paper-review-tool/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Landing page (open paper)
│   │   ├── globals.css                   # Tailwind + global styles
│   │   └── paper/[id]/
│   │       └── page.tsx                  # Main paper view
│   ├── components/
│   │   ├── pdf/
│   │   │   ├── PdfViewer.tsx             # PDF rendering + page nav
│   │   │   ├── HighlightLayer.tsx        # Highlight overlays per page
│   │   │   ├── CitationPopover.tsx       # Citation hover tooltip
│   │   │   └── TextSelection.tsx         # Drag-to-select context
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx             # Chat container
│   │   │   ├── MessageList.tsx           # Message display
│   │   │   ├── MessageInput.tsx          # Input + context attachment
│   │   │   └── DragContext.tsx           # Selected text preview chip
│   │   ├── highlights/
│   │   │   └── HighlightList.tsx         # Bottom panel highlight list
│   │   └── layout/
│   │       ├── ResizableLayout.tsx        # Draggable split pane
│   │       └── AnalysisStatus.tsx         # Analysis progress indicator
│   ├── lib/
│   │   ├── db.ts                         # Prisma client singleton
│   │   ├── ai/
│   │   │   ├── provider.ts              # AI provider interface
│   │   │   ├── claude-agent.ts          # Claude Agent SDK impl
│   │   │   └── skills.ts               # Skill loading + execution
│   │   └── papers.ts                    # Paper file management
│   └── types/
│       └── index.ts                      # Shared type definitions
├── skills/
│   ├── skim.md                           # Skimming skill
│   ├── build-background.md               # Background knowledge skill
│   └── deep-read.md                      # Deep reading skill
├── papers/                               # AI artifacts (gitignored)
├── data/                                 # SQLite DB (gitignored)
└── __tests__/
    ├── lib/
    │   ├── papers.test.ts
    │   └── ai/
    │       ├── provider.test.ts
    │       └── skills.test.ts
    └── api/
        ├── papers.test.ts
        ├── highlights.test.ts
        └── chat.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `prisma/schema.prisma`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/db.ts`, `src/types/index.ts`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-pdf pdfjs-dist prisma @prisma/client @anthropic-ai/claude-agent-sdk
npm install -D @types/node vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:../data/papers.db"
}

model Paper {
  id            String      @id @default(uuid())
  title         String
  url           String?
  filePath      String
  chatSessionId String?
  createdAt     DateTime    @default(now())
  highlights    Highlight[]
}

model Highlight {
  id          String   @id @default(uuid())
  paperId     String
  paper       Paper    @relation(fields: [paperId], references: [id], onDelete: Cascade)
  page        Int
  startOffset Int
  endOffset   Int
  color       String   @default("yellow")
  memo        String?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 5: Initialize database**

```bash
mkdir -p data
npx prisma generate
npx prisma db push
```

- [ ] **Step 6: Create Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 7: Create shared types**

Create `src/types/index.ts`:

```typescript
export interface PaperMeta {
  id: string;
  title: string;
  url: string | null;
  filePath: string;
  chatSessionId: string | null;
  createdAt: Date;
}

export interface HighlightData {
  id: string;
  paperId: string;
  page: number;
  startOffset: number;
  endOffset: number;
  color: string;
  memo: string | null;
  createdAt: Date;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  context?: string; // Dragged text context
  timestamp: Date;
}

export interface AnalysisProgress {
  phase: "skimming" | "building" | "reading" | "complete" | "error";
  message: string;
  topics?: string[];
  completedTopics?: string[];
}

export interface BackgroundTopic {
  name: string;
  filename: string;
}
```

- [ ] **Step 8: Update .gitignore**

Append to `.gitignore`:

```
papers/
data/
```

- [ ] **Step 9: Create minimal landing page**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-8">Paper Review Tool</h1>
      <p className="text-gray-600">Open a paper to get started.</p>
    </main>
  );
}
```

- [ ] **Step 10: Verify setup**

```bash
npm run build
npm run test -- --passWithNoTests
```

Expected: Build succeeds, test runner works.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Next.js, Prisma, and Vitest"
```

---

## Task 2: Paper Management

**Files:**
- Create: `src/lib/papers.ts`, `src/app/api/papers/route.ts`, `__tests__/lib/papers.test.ts`, `__tests__/api/papers.test.ts`

- [ ] **Step 1: Write failing test for paper directory management**

Create `__tests__/lib/papers.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createPaperDir, getPaperDir, PAPERS_ROOT } from "@/lib/papers";

const TEST_PAPERS_ROOT = path.join(process.cwd(), "test-papers");

describe("papers", () => {
  beforeEach(() => {
    // Override PAPERS_ROOT for tests
    fs.mkdirSync(TEST_PAPERS_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_PAPERS_ROOT, { recursive: true, force: true });
  });

  it("creates paper directory with background subfolder", () => {
    const paperId = "test-123";
    const dir = createPaperDir(paperId, TEST_PAPERS_ROOT);

    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, "background"))).toBe(true);
  });

  it("returns correct paper directory path", () => {
    const paperId = "test-456";
    const dir = getPaperDir(paperId, TEST_PAPERS_ROOT);

    expect(dir).toBe(path.join(TEST_PAPERS_ROOT, paperId));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/papers.test.ts
```

Expected: FAIL — cannot find module `@/lib/papers`

- [ ] **Step 3: Implement paper directory management**

Create `src/lib/papers.ts`:

```typescript
import fs from "fs";
import path from "path";

export const PAPERS_ROOT = path.join(process.cwd(), "papers");

export function createPaperDir(
  paperId: string,
  root: string = PAPERS_ROOT
): string {
  const dir = path.join(root, paperId);
  fs.mkdirSync(path.join(dir, "background"), { recursive: true });
  return dir;
}

export function getPaperDir(
  paperId: string,
  root: string = PAPERS_ROOT
): string {
  return path.join(root, paperId);
}

export function savePdf(
  paperId: string,
  buffer: Buffer,
  root: string = PAPERS_ROOT
): string {
  const dir = createPaperDir(paperId, root);
  const filePath = path.join(dir, "original.pdf");
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function paperHasAnalysis(
  paperId: string,
  root: string = PAPERS_ROOT
): boolean {
  const analysisPath = path.join(root, paperId, "analysis.md");
  return fs.existsSync(analysisPath);
}

export function listBackgroundTopics(
  paperId: string,
  root: string = PAPERS_ROOT
): string[] {
  const bgDir = path.join(root, paperId, "background");
  if (!fs.existsSync(bgDir)) return [];
  return fs
    .readdirSync(bgDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/lib/papers.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test for papers API**

Create `__tests__/api/papers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock papers lib
vi.mock("@/lib/papers", () => ({
  savePdf: vi.fn().mockReturnValue("/papers/test-id/original.pdf"),
  createPaperDir: vi.fn().mockReturnValue("/papers/test-id"),
  PAPERS_ROOT: "/papers",
}));

import { prisma } from "@/lib/db";

describe("POST /api/papers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a paper from URL", async () => {
    const mockPaper = {
      id: "test-id",
      title: "Test Paper",
      url: "https://arxiv.org/abs/1706.03762",
      filePath: "",
      chatSessionId: null,
      createdAt: new Date(),
    };

    (prisma.paper.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPaper
    );

    const { POST } = await import("@/app/api/papers/route");

    const request = new Request("http://localhost/api/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://arxiv.org/abs/1706.03762",
        title: "Test Paper",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("test-id");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run __tests__/api/papers.test.ts
```

Expected: FAIL — cannot find module `@/app/api/papers/route`

- [ ] **Step 7: Implement papers API route**

Create `src/app/api/papers/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { savePdf, createPaperDir } from "@/lib/papers";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const paper = await prisma.paper.create({
      data: { title, filePath: "" },
    });

    const filePath = savePdf(paper.id, buffer);
    const updated = await prisma.paper.update({
      where: { id: paper.id },
      data: { filePath },
    });

    return NextResponse.json(updated, { status: 201 });
  }

  const body = await request.json();
  const { url, title } = body;

  if (!url && !title) {
    return NextResponse.json(
      { error: "URL or title required" },
      { status: 400 }
    );
  }

  const paper = await prisma.paper.create({
    data: {
      title: title || "Untitled",
      url: url || null,
      filePath: "",
    },
  });

  createPaperDir(paper.id);

  return NextResponse.json(paper, { status: 201 });
}

export async function GET() {
  const papers = await prisma.paper.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(papers);
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run __tests__/api/papers.test.ts __tests__/lib/papers.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/papers.ts src/app/api/papers/route.ts __tests__/lib/papers.test.ts __tests__/api/papers.test.ts
git commit -m "feat: paper management API with file storage"
```

---

## Task 3: PDF Viewer Component

**Files:**
- Create: `src/components/pdf/PdfViewer.tsx`, `src/app/paper/[id]/page.tsx`
- Modify: `src/app/page.tsx`, `next.config.ts`

- [ ] **Step 1: Configure Next.js for PDF.js worker**

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 2: Create PDF viewer component**

Create `src/components/pdf/PdfViewer.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  onTextSelect?: (text: string, page: number) => void;
}

export default function PdfViewer({ fileUrl, onTextSelect }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onTextSelect?.(selection.toString().trim(), currentPage);
    }
  }, [currentPage, onTextSelect]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 shrink-0">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="px-2 py-1 text-sm border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-sm">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="px-2 py-1 text-sm border rounded disabled:opacity-50"
        >
          Next
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          className="px-2 py-1 text-sm border rounded"
        >
          -
        </button>
        <span className="text-sm">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.1))}
          className="px-2 py-1 text-sm border rounded"
        >
          +
        </button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-200 p-4" onMouseUp={handleMouseUp}>
        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
          <Page pageNumber={currentPage} scale={scale} />
        </Document>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create paper view page**

Create `src/app/paper/[id]/page.tsx`:

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import PaperView from "./PaperView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaperPage({ params }: Props) {
  const { id } = await params;
  const paper = await prisma.paper.findUnique({ where: { id } });

  if (!paper) {
    notFound();
  }

  return <PaperView paper={paper} />;
}
```

Create `src/app/paper/[id]/PaperView.tsx`:

```tsx
"use client";

import { useState } from "react";
import PdfViewer from "@/components/pdf/PdfViewer";
import type { PaperMeta } from "@/types";

interface Props {
  paper: PaperMeta;
}

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  const fileUrl = paper.filePath
    ? `/api/papers/${paper.id}/pdf`
    : "";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 min-w-0">
          {fileUrl ? (
            <PdfViewer
              fileUrl={fileUrl}
              onTextSelect={(text) => setSelectedText(text)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No PDF available. Analysis will use the paper URL.
            </div>
          )}
        </div>

        {/* Chat Panel placeholder */}
        <div className="w-96 border-l bg-white flex flex-col">
          <div className="p-4 text-gray-500 text-sm">
            Chat panel (coming in Task 8)
          </div>
          {selectedText && (
            <div className="p-3 mx-3 mb-3 bg-blue-50 rounded text-xs">
              Selected: &ldquo;{selectedText.slice(0, 100)}...&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add PDF serving endpoint**

Create `src/app/api/papers/[id]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const paper = await prisma.paper.findUnique({ where: { id } });

  if (!paper || !paper.filePath || !fs.existsSync(paper.filePath)) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(paper.filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="paper.pdf"`,
    },
  });
}
```

- [ ] **Step 5: Update landing page with paper open form**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title: title || url }),
    });

    const paper = await res.json();
    router.push(`/paper/${paper.id}`);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(".pdf", ""));

    const res = await fetch("/api/papers", {
      method: "POST",
      body: formData,
    });

    const paper = await res.json();
    router.push(`/paper/${paper.id}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <h1 className="text-3xl font-bold">Paper Review Tool</h1>

      <form onSubmit={handleUrlSubmit} className="flex flex-col gap-3 w-full max-w-md">
        <input
          type="text"
          placeholder="Paper title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="url"
          placeholder="arXiv URL (e.g. https://arxiv.org/abs/1706.03762)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={!url || loading}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          Open from URL
        </button>
      </form>

      <div className="text-gray-400">or</div>

      <label className="cursor-pointer bg-gray-100 border-2 border-dashed rounded-lg px-8 py-6 text-center hover:bg-gray-50">
        <span className="text-gray-600">Upload PDF file</span>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={loading}
        />
      </label>

      {loading && <p className="text-gray-500">Opening paper...</p>}
    </main>
  );
}
```

- [ ] **Step 6: Verify PDF viewer works**

```bash
npm run build
npm run dev
```

Open `http://localhost:3000`, upload a PDF, verify it renders.

- [ ] **Step 7: Commit**

```bash
git add src/components/pdf/PdfViewer.tsx src/app/paper/ src/app/api/papers/[id]/ src/app/page.tsx next.config.ts
git commit -m "feat: PDF viewer with page navigation and text selection"
```

---

## Task 4: AI Provider Abstraction

**Files:**
- Create: `src/lib/ai/provider.ts`, `src/lib/ai/claude-agent.ts`, `__tests__/lib/ai/provider.test.ts`

- [ ] **Step 1: Write failing test for provider interface**

Create `__tests__/lib/ai/provider.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import type { AIProvider, AIResponse } from "@/lib/ai/provider";

describe("AIProvider interface", () => {
  it("defines query method that returns async iterable", async () => {
    const mockProvider: AIProvider = {
      query: vi.fn(async function* () {
        yield { type: "text" as const, content: "Hello" };
        yield { type: "done" as const, sessionId: "sess-1" };
      }),
    };

    const chunks: AIResponse[] = [];
    for await (const chunk of mockProvider.query({ prompt: "test" })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ type: "text", content: "Hello" });
    expect(chunks[1]).toEqual({ type: "done", sessionId: "sess-1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/ai/provider.test.ts
```

Expected: FAIL — cannot find module `@/lib/ai/provider`

- [ ] **Step 3: Implement provider interface**

Create `src/lib/ai/provider.ts`:

```typescript
export type AIResponse =
  | { type: "text"; content: string }
  | { type: "progress"; message: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; message: string };

export interface AIQueryOptions {
  prompt: string;
  sessionId?: string;
  cwd?: string;
  allowedTools?: string[];
}

export interface AIProvider {
  query(options: AIQueryOptions): AsyncGenerator<AIResponse>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/lib/ai/provider.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement Claude Agent SDK provider**

Create `src/lib/ai/claude-agent.ts`:

```typescript
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk";
import type { AIProvider, AIResponse, AIQueryOptions } from "./provider";

export class ClaudeAgentProvider implements AIProvider {
  async *query(options: AIQueryOptions): AsyncGenerator<AIResponse> {
    try {
      const queryOptions: Record<string, unknown> = {
        cwd: options.cwd || process.cwd(),
        allowedTools: options.allowedTools || [
          "Read",
          "Write",
          "Edit",
          "Bash",
          "Glob",
          "Grep",
          "WebSearch",
          "WebFetch",
        ],
        permissionMode: "acceptEdits" as const,
      };

      if (options.sessionId) {
        queryOptions.resume = options.sessionId;
      }

      let sessionId = "";

      for await (const message of claudeQuery({
        prompt: options.prompt,
        options: queryOptions,
      })) {
        if (message.type === "system" && message.session_id) {
          sessionId = message.session_id;
        }

        if (message.type === "assistant" && message.content) {
          for (const block of message.content) {
            if (block.type === "text") {
              yield { type: "text", content: block.text };
            }
          }
        }

        if (message.type === "result") {
          yield { type: "done", sessionId };
        }
      }
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
```

- [ ] **Step 6: Create provider factory**

Add to `src/lib/ai/provider.ts`:

```typescript
import { ClaudeAgentProvider } from "./claude-agent";

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!_provider) {
    _provider = new ClaudeAgentProvider();
  }
  return _provider;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/ __tests__/lib/ai/
git commit -m "feat: AI provider abstraction with Claude Agent SDK"
```

---

## Task 5: Skills System

**Files:**
- Create: `src/lib/ai/skills.ts`, `skills/skim.md`, `skills/build-background.md`, `skills/deep-read.md`, `__tests__/lib/ai/skills.test.ts`

- [ ] **Step 1: Write failing test for skill loading**

Create `__tests__/lib/ai/skills.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadSkill, buildPrompt } from "@/lib/ai/skills";
import path from "path";

const SKILLS_DIR = path.join(process.cwd(), "skills");

describe("skills", () => {
  it("loads a skill file and returns its content", () => {
    const content = loadSkill("skim", SKILLS_DIR);
    expect(content).toContain("스키밍");
  });

  it("builds prompt by replacing variables", () => {
    const template = "Analyze {{paperUrl}} and save to {{outputDir}}";
    const result = buildPrompt(template, {
      paperUrl: "https://arxiv.org/abs/1706.03762",
      outputDir: "/papers/abc/background",
    });

    expect(result).toBe(
      "Analyze https://arxiv.org/abs/1706.03762 and save to /papers/abc/background"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/ai/skills.test.ts
```

Expected: FAIL — cannot find module `@/lib/ai/skills`

- [ ] **Step 3: Create skill files**

Create `skills/skim.md`:

```markdown
# Skim Paper

You are an expert research assistant. Your task is to skim a paper and identify the background knowledge needed to deeply understand it.

## Input

Paper: {{paperSource}}

## Instructions

1. Read the paper thoroughly — use the URL to find and read the HTML version, or read the file at the given path
2. Identify all concepts, techniques, and prior works that a reader needs to understand to fully grasp this paper
3. For each concept, provide a brief (1 sentence) description of why it's needed

## Output Format

Return a JSON array of topics. Each topic has a "name" (short identifier, used as filename) and "description" (why this concept is needed for understanding this paper). Example:

```json
[
  {"name": "self-attention", "description": "Core mechanism used in the transformer architecture proposed in this paper"},
  {"name": "seq2seq", "description": "The existing paradigm this paper aims to improve upon"}
]
```

Return ONLY the JSON array, no other text.
```

Create `skills/build-background.md`:

```markdown
# Build Background Knowledge

You are an expert research assistant. Your task is to write a compact background knowledge document about a specific topic, tailored to help a reader understand a particular paper.

## Input

Topic: {{topicName}}
Topic description: {{topicDescription}}
Paper: {{paperSource}}
Output path: {{outputPath}}

## Instructions

1. Research this topic using web search — find authoritative sources, tutorials, key papers
2. Write a compact reference document (NOT a textbook chapter — a cheat sheet)
3. Save the document to the output path

## Document Structure

Write the document in Markdown with these sections:

- **What it is** (3-5 paragraphs): Clear explanation of the concept
- **Why it exists**: What problem it solves, limitations of prior approaches
- **Key formulas/concepts**: Core mathematical or algorithmic ideas (if applicable)
- **Relevance to the paper**: How this concept is used in the context of the target paper

Keep it compact. The reader should be able to skim this in 2-3 minutes and understand enough to follow the paper.

## Output

Save the document to {{outputPath}}. Confirm by writing: DONE: {{topicName}}
```

Create `skills/deep-read.md`:

```markdown
# Deep Read Paper

You are an expert research assistant. You have background knowledge available and your task is to deeply analyze a paper section by section.

## Input

Paper: {{paperSource}}
Background knowledge directory: {{backgroundDir}}
Output path: {{outputPath}}

## Instructions

1. Read all background knowledge documents in the background directory
2. Re-read the paper carefully, section by section
3. Write a deep analysis that demonstrates thorough understanding

## Analysis Structure

Write the analysis in Markdown:

- **Summary**: 2-3 paragraph summary of the paper's contribution
- **Section-by-section analysis**: For each major section, explain:
  - What the authors are saying
  - How it connects to the background knowledge
  - Key insights or novel contributions
  - Any assumptions or limitations
- **Key takeaways**: The most important things to remember
- **Open questions**: Things that remain unclear or could be explored further

## Output

Save the analysis to {{outputPath}}.
```

- [ ] **Step 4: Implement skills module**

Create `src/lib/ai/skills.ts`:

```typescript
import fs from "fs";
import path from "path";

const DEFAULT_SKILLS_DIR = path.join(process.cwd(), "skills");

export function loadSkill(
  name: string,
  skillsDir: string = DEFAULT_SKILLS_DIR
): string {
  const filePath = path.join(skillsDir, `${name}.md`);
  return fs.readFileSync(filePath, "utf-8");
}

export function buildPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function buildSkillPrompt(
  skillName: string,
  variables: Record<string, string>,
  skillsDir: string = DEFAULT_SKILLS_DIR
): string {
  const template = loadSkill(skillName, skillsDir);
  return buildPrompt(template, variables);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run __tests__/lib/ai/skills.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/skills.ts skills/ __tests__/lib/ai/skills.test.ts
git commit -m "feat: skill system with skim, background build, and deep read skills"
```

---

## Task 6: Analysis Pipeline API

**Files:**
- Create: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Implement SSE analysis endpoint**

Create `src/app/api/analyze/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { buildSkillPrompt } from "@/lib/ai/skills";
import { getPaperDir } from "@/lib/papers";
import path from "path";

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { paperId } = await request.json();
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });

  if (!paper) {
    return new Response(JSON.stringify({ error: "Paper not found" }), {
      status: 404,
    });
  }

  const paperDir = getPaperDir(paper.id);
  const paperSource = paper.url || paper.filePath;
  const provider = getAIProvider();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Phase 1: Skim
        controller.enqueue(
          sseEncode({ phase: "skimming", message: "Skimming paper..." })
        );

        const skimPrompt = buildSkillPrompt("skim", { paperSource });
        let skimResult = "";

        for await (const chunk of provider.query({
          prompt: skimPrompt,
          cwd: paperDir,
        })) {
          if (chunk.type === "text") {
            skimResult += chunk.content;
          }
        }

        let topics: Array<{ name: string; description: string }>;
        try {
          const jsonMatch = skimResult.match(/\[[\s\S]*\]/);
          topics = JSON.parse(jsonMatch?.[0] || "[]");
        } catch {
          topics = [];
          controller.enqueue(
            sseEncode({
              phase: "error",
              message: "Failed to parse skim results",
            })
          );
          controller.close();
          return;
        }

        controller.enqueue(
          sseEncode({
            phase: "building",
            message: `Building background for ${topics.length} topics...`,
            topics: topics.map((t) => t.name),
          })
        );

        // Phase 2: Build background (parallel)
        const bgDir = path.join(paperDir, "background");
        const buildPromises = topics.map(async (topic) => {
          const outputPath = path.join(bgDir, `${topic.name}.md`);
          const prompt = buildSkillPrompt("build-background", {
            topicName: topic.name,
            topicDescription: topic.description,
            paperSource,
            outputPath,
          });

          for await (const chunk of provider.query({
            prompt,
            cwd: paperDir,
          })) {
            if (chunk.type === "done") {
              controller.enqueue(
                sseEncode({
                  phase: "building",
                  message: `Completed: ${topic.name}`,
                  completedTopic: topic.name,
                })
              );
            }
          }
        });

        await Promise.all(buildPromises);

        // Phase 3: Deep read
        controller.enqueue(
          sseEncode({ phase: "reading", message: "Deep reading paper..." })
        );

        const deepReadPrompt = buildSkillPrompt("deep-read", {
          paperSource,
          backgroundDir: bgDir,
          outputPath: path.join(paperDir, "analysis.md"),
        });

        for await (const chunk of provider.query({
          prompt: deepReadPrompt,
          cwd: paperDir,
        })) {
          if (chunk.type === "text") {
            controller.enqueue(
              sseEncode({ phase: "reading", message: chunk.content })
            );
          }
        }

        controller.enqueue(
          sseEncode({ phase: "complete", message: "Analysis complete" })
        );
      } catch (error) {
        controller.enqueue(
          sseEncode({
            phase: "error",
            message:
              error instanceof Error ? error.message : "Analysis failed",
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create analysis status component**

Create `src/components/layout/AnalysisStatus.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import type { AnalysisProgress } from "@/types";

interface Props {
  paperId: string;
  onComplete: () => void;
}

export default function AnalysisStatus({ paperId, onComplete }: Props) {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  function startAnalysis() {
    setIsRunning(true);
    setCompletedTopics([]);

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId }),
    }).then(async (response) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n\n").filter(Boolean);

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            setProgress(data);

            if (data.completedTopic) {
              setCompletedTopics((prev) => [...prev, data.completedTopic]);
            }

            if (data.phase === "complete") {
              setIsRunning(false);
              onComplete();
            }

            if (data.phase === "error") {
              setIsRunning(false);
            }
          }
        }
      }
    });
  }

  const phaseLabels: Record<string, string> = {
    skimming: "Skimming paper...",
    building: "Building background knowledge...",
    reading: "Deep reading...",
    complete: "Analysis complete",
    error: "Error",
  };

  return (
    <div className="p-3 border-b bg-gray-50">
      {!isRunning && !progress?.phase ? (
        <button
          onClick={startAnalysis}
          className="bg-blue-600 text-white text-sm rounded px-3 py-1.5"
        >
          Start Analysis
        </button>
      ) : (
        <div className="text-sm">
          <div className="font-medium">
            {progress ? phaseLabels[progress.phase] || progress.message : ""}
          </div>
          {progress?.topics && (
            <div className="mt-1 flex flex-wrap gap-1">
              {progress.topics.map((topic) => (
                <span
                  key={topic}
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    completedTopics.includes(topic)
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/ src/components/layout/AnalysisStatus.tsx
git commit -m "feat: AI analysis pipeline with SSE streaming (skim, build, deep read)"
```

---

## Task 7: Chat System

**Files:**
- Create: `src/app/api/chat/route.ts`, `src/components/chat/ChatPanel.tsx`, `src/components/chat/MessageList.tsx`, `src/components/chat/MessageInput.tsx`, `src/components/chat/DragContext.tsx`

- [ ] **Step 1: Implement chat API endpoint**

Create `src/app/api/chat/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { getPaperDir } from "@/lib/papers";

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { paperId, message, context } = await request.json();
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });

  if (!paper) {
    return new Response(JSON.stringify({ error: "Paper not found" }), {
      status: 404,
    });
  }

  const paperDir = getPaperDir(paper.id);
  const provider = getAIProvider();

  let prompt = "";

  if (!paper.chatSessionId) {
    // First message: set up context
    const paperSource = paper.url || paper.filePath;
    prompt += `You are a knowledgeable research assistant helping a user understand a paper.\n\n`;
    prompt += `Paper: ${paperSource}\n`;
    prompt += `Background knowledge and analysis are in: ${paperDir}\n`;
    prompt += `Read the background/ directory and analysis.md if they exist to understand the paper deeply.\n\n`;
  }

  if (context) {
    prompt += `The user selected this text from the paper:\n> ${context}\n\n`;
  }

  prompt += `User question: ${message}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.query({
          prompt,
          sessionId: paper.chatSessionId || undefined,
          cwd: paperDir,
        })) {
          if (chunk.type === "text") {
            controller.enqueue(
              sseEncode({ type: "text", content: chunk.content })
            );
          }
          if (chunk.type === "done" && chunk.sessionId) {
            // Save session ID for future messages
            if (!paper.chatSessionId) {
              await prisma.paper.update({
                where: { id: paper.id },
                data: { chatSessionId: chunk.sessionId },
              });
            }
            controller.enqueue(
              sseEncode({ type: "done", sessionId: chunk.sessionId })
            );
          }
          if (chunk.type === "error") {
            controller.enqueue(
              sseEncode({ type: "error", message: chunk.message })
            );
          }
        }
      } catch (error) {
        controller.enqueue(
          sseEncode({
            type: "error",
            message:
              error instanceof Error ? error.message : "Chat failed",
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create DragContext component**

Create `src/components/chat/DragContext.tsx`:

```tsx
interface Props {
  text: string;
  onClear: () => void;
}

export default function DragContext({ text, onClear }: Props) {
  return (
    <div className="flex items-start gap-2 mx-3 mb-2 p-2 bg-blue-50 rounded text-xs border border-blue-200">
      <div className="flex-1 line-clamp-3 text-gray-700">
        &ldquo;{text}&rdquo;
      </div>
      <button
        onClick={onClear}
        className="text-gray-400 hover:text-gray-600 shrink-0"
      >
        x
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create MessageList component**

Create `src/components/chat/MessageList.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  streamingContent: string;
}

export default function MessageList({ messages, streamingContent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-auto p-3 space-y-4">
      {messages.map((msg, i) => (
        <div key={i}>
          {msg.context && (
            <div className="mb-1 p-2 bg-blue-50 rounded text-xs text-gray-600 border-l-2 border-blue-300">
              &ldquo;{msg.context}&rdquo;
            </div>
          )}
          <div
            className={`text-sm ${
              msg.role === "user" ? "text-blue-900" : "text-gray-800"
            }`}
          >
            <span className="font-medium text-xs text-gray-500 block mb-0.5">
              {msg.role === "user" ? "You" : "AI"}
            </span>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        </div>
      ))}

      {streamingContent && (
        <div className="text-sm text-gray-800">
          <span className="font-medium text-xs text-gray-500 block mb-0.5">
            AI
          </span>
          <div className="whitespace-pre-wrap">{streamingContent}</div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Create MessageInput component**

Create `src/components/chat/MessageInput.tsx`:

```tsx
"use client";

import { useState, type KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="p-3 border-t">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the paper..."
          disabled={disabled}
          rows={2}
          className="flex-1 border rounded px-3 py-2 text-sm resize-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="bg-blue-600 text-white text-sm rounded px-4 disabled:opacity-50 self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ChatPanel container**

Create `src/components/chat/ChatPanel.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import DragContext from "./DragContext";
import type { ChatMessage } from "@/types";

interface Props {
  paperId: string;
  selectedText: string | null;
  onClearSelection: () => void;
}

export default function ChatPanel({
  paperId,
  selectedText,
  onClearSelection,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(
    async (message: string) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        context: selectedText || undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");
      onClearSelection();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperId,
            message,
            context: selectedText || undefined,
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n\n").filter(Boolean);

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: fullContent,
            timestamp: new Date(),
          },
        ]);
        setStreamingContent("");
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Error: Failed to get response.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [paperId, selectedText, onClearSelection]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b font-medium text-sm">Chat</div>
      <MessageList messages={messages} streamingContent={streamingContent} />
      {selectedText && (
        <DragContext text={selectedText} onClear={onClearSelection} />
      )}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

- [ ] **Step 6: Integrate chat into paper view**

Update `src/app/paper/[id]/PaperView.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import PdfViewer from "@/components/pdf/PdfViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import AnalysisStatus from "@/components/layout/AnalysisStatus";
import type { PaperMeta } from "@/types";

interface Props {
  paper: PaperMeta;
}

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  const fileUrl = paper.filePath ? `/api/papers/${paper.id}/pdf` : "";

  const clearSelection = useCallback(() => setSelectedText(null), []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
      </div>

      {/* Analysis Status */}
      <AnalysisStatus paperId={paper.id} onComplete={() => {}} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 min-w-0">
          {fileUrl ? (
            <PdfViewer
              fileUrl={fileUrl}
              onTextSelect={(text) => setSelectedText(text)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No PDF available. Analysis will use the paper URL.
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className="w-96 border-l bg-white flex flex-col">
          <ChatPanel
            paperId={paper.id}
            selectedText={selectedText}
            onClearSelection={clearSelection}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/chat/ src/components/chat/ src/app/paper/[id]/PaperView.tsx
git commit -m "feat: chat system with SSE streaming and drag context"
```

---

## Task 8: Highlighting System

**Files:**
- Create: `src/app/api/highlights/route.ts`, `src/components/pdf/HighlightLayer.tsx`, `src/components/highlights/HighlightList.tsx`
- Modify: `src/components/pdf/PdfViewer.tsx`, `src/app/paper/[id]/PaperView.tsx`

- [ ] **Step 1: Write failing test for highlights API**

Create `__tests__/api/highlights.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    highlight: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Highlights API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a highlight", async () => {
    const mockHighlight = {
      id: "hl-1",
      paperId: "paper-1",
      page: 3,
      startOffset: 100,
      endOffset: 200,
      color: "yellow",
      memo: null,
      createdAt: new Date(),
    };

    (prisma.highlight.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHighlight
    );

    const { POST } = await import("@/app/api/highlights/route");

    const request = new Request("http://localhost/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperId: "paper-1",
        page: 3,
        startOffset: 100,
        endOffset: 200,
        color: "yellow",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("hl-1");
  });

  it("lists highlights for a paper", async () => {
    (prisma.highlight.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "hl-1", paperId: "paper-1", page: 1, color: "yellow" },
    ]);

    const { GET } = await import("@/app/api/highlights/route");

    const request = new Request(
      "http://localhost/api/highlights?paperId=paper-1"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/api/highlights.test.ts
```

Expected: FAIL — cannot find module `@/app/api/highlights/route`

- [ ] **Step 3: Implement highlights API**

Create `src/app/api/highlights/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { paperId, page, startOffset, endOffset, color, memo } = body;

  const highlight = await prisma.highlight.create({
    data: { paperId, page, startOffset, endOffset, color, memo },
  });

  return NextResponse.json(highlight, { status: 201 });
}

export async function GET(request: NextRequest) {
  const paperId = request.nextUrl.searchParams.get("paperId");

  if (!paperId) {
    return NextResponse.json(
      { error: "paperId required" },
      { status: 400 }
    );
  }

  const highlights = await prisma.highlight.findMany({
    where: { paperId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(highlights);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, memo, color } = body;

  const data: Record<string, string> = {};
  if (memo !== undefined) data.memo = memo;
  if (color !== undefined) data.color = color;

  const highlight = await prisma.highlight.update({
    where: { id },
    data,
  });

  return NextResponse.json(highlight);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.highlight.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/api/highlights.test.ts
```

Expected: PASS

- [ ] **Step 5: Create HighlightLayer component**

Create `src/components/pdf/HighlightLayer.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { HighlightData } from "@/types";

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-200/50",
  green: "bg-green-200/50",
  blue: "bg-blue-200/50",
  pink: "bg-pink-200/50",
};

interface Props {
  highlights: HighlightData[];
  page: number;
  onAddHighlight: (highlight: {
    page: number;
    startOffset: number;
    endOffset: number;
    color: string;
  }) => void;
  onDeleteHighlight: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
}

export default function HighlightLayer({
  highlights,
  page,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateMemo,
}: Props) {
  const [selectedColor, setSelectedColor] = useState("yellow");
  const [editingMemo, setEditingMemo] = useState<string | null>(null);

  const pageHighlights = highlights.filter((h) => h.page === page);

  function handleHighlightSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    onAddHighlight({
      page,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      color: selectedColor,
    });
    selection.removeAllRanges();
  }

  return (
    <>
      {/* Color picker toolbar */}
      <div className="absolute top-1 right-1 z-10 flex gap-1 bg-white/80 rounded p-1">
        {Object.keys(COLOR_MAP).map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className={`w-4 h-4 rounded-full border-2 ${
              COLOR_MAP[color]
            } ${selectedColor === color ? "border-gray-800" : "border-transparent"}`}
          />
        ))}
        <button
          onClick={handleHighlightSelection}
          className="text-xs px-1 bg-gray-100 rounded"
          title="Highlight selected text"
        >
          H
        </button>
      </div>

      {/* Rendered highlights */}
      {pageHighlights.map((hl) => (
        <div key={hl.id} className="group relative">
          <div
            className={`absolute ${COLOR_MAP[hl.color] || COLOR_MAP.yellow} cursor-pointer`}
            onClick={() => setEditingMemo(editingMemo === hl.id ? null : hl.id)}
          />
          {editingMemo === hl.id && (
            <div className="absolute z-20 bg-white shadow-lg rounded p-2 border min-w-[200px]">
              <textarea
                defaultValue={hl.memo || ""}
                placeholder="Add a memo..."
                className="w-full text-xs border rounded p-1"
                rows={3}
                onBlur={(e) => onUpdateMemo(hl.id, e.target.value)}
              />
              <button
                onClick={() => onDeleteHighlight(hl.id)}
                className="text-xs text-red-500 mt-1"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 6: Create HighlightList panel**

Create `src/components/highlights/HighlightList.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { HighlightData } from "@/types";

const COLOR_LABELS: Record<string, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  pink: "Pink",
};

interface Props {
  highlights: HighlightData[];
  onGoToPage: (page: number) => void;
}

export default function HighlightList({ highlights, onGoToPage }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterColor, setFilterColor] = useState<string | null>(null);

  const filtered = filterColor
    ? highlights.filter((h) => h.color === filterColor)
    : highlights;

  return (
    <div className="border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-sm font-medium text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
      >
        <span>Highlights ({highlights.length})</span>
        <span>{isOpen ? "▼" : "▲"}</span>
      </button>

      {isOpen && (
        <div className="max-h-48 overflow-auto">
          {/* Color filter */}
          <div className="flex gap-1 px-4 py-2 border-b">
            <button
              onClick={() => setFilterColor(null)}
              className={`text-xs px-2 py-0.5 rounded ${
                !filterColor ? "bg-gray-200" : "bg-gray-50"
              }`}
            >
              All
            </button>
            {Object.entries(COLOR_LABELS).map(([color, label]) => (
              <button
                key={color}
                onClick={() => setFilterColor(color)}
                className={`text-xs px-2 py-0.5 rounded ${
                  filterColor === color ? "bg-gray-200" : "bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Highlight items */}
          {filtered.map((hl) => (
            <div
              key={hl.id}
              onClick={() => onGoToPage(hl.page)}
              className="px-4 py-2 text-xs hover:bg-gray-50 cursor-pointer border-b flex items-center gap-2"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  {
                    yellow: "bg-yellow-400",
                    green: "bg-green-400",
                    blue: "bg-blue-400",
                    pink: "bg-pink-400",
                  }[hl.color] || "bg-gray-400"
                }`}
              />
              <span className="text-gray-500">p.{hl.page}</span>
              {hl.memo && (
                <span className="text-gray-700 truncate">{hl.memo}</span>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              No highlights yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/highlights/ src/components/pdf/HighlightLayer.tsx src/components/highlights/HighlightList.tsx __tests__/api/highlights.test.ts
git commit -m "feat: highlighting system with multi-color, memo, and list panel"
```

---

## Task 9: Citation Popover

**Files:**
- Create: `src/components/pdf/CitationPopover.tsx`

- [ ] **Step 1: Create citation popover component**

Create `src/components/pdf/CitationPopover.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface CitationInfo {
  number: string;
  title: string;
  authors: string;
  year: string;
}

interface Props {
  references: CitationInfo[];
}

export default function CitationPopover({ references }: Props) {
  const [tooltip, setTooltip] = useState<{
    info: CitationInfo;
    x: number;
    y: number;
  } | null>(null);

  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const text = target.textContent || "";

      // Match citation patterns like [1], [2,3], [1-5]
      const citationMatch = text.match(/^\[(\d+)\]$/);
      if (!citationMatch) {
        setTooltip(null);
        return;
      }

      const num = citationMatch[1];
      const ref = references.find((r) => r.number === num);

      if (ref) {
        setTooltip({
          info: ref,
          x: e.clientX,
          y: e.clientY - 10,
        });
      }
    },
    [references]
  );

  const handleMouseOut = useCallback(() => {
    setTooltip(null);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [handleMouseOver, handleMouseOut]);

  if (!tooltip) return null;

  return (
    <div
      className="fixed z-50 bg-white shadow-lg border rounded-lg p-3 max-w-sm pointer-events-none"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="text-xs text-gray-500 mb-1">[{tooltip.info.number}]</div>
      <div className="text-sm font-medium">{tooltip.info.title}</div>
      <div className="text-xs text-gray-600 mt-1">
        {tooltip.info.authors} ({tooltip.info.year})
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/CitationPopover.tsx
git commit -m "feat: citation popover tooltip on hover"
```

---

## Task 10: Resizable Layout + Full Integration

**Files:**
- Create: `src/components/layout/ResizableLayout.tsx`
- Modify: `src/components/pdf/PdfViewer.tsx`, `src/app/paper/[id]/PaperView.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Update PdfViewer to accept highlight and navigation props**

Update `src/components/pdf/PdfViewer.tsx` — this is the full updated version with highlight support, goToPage, and CitationPopover integration:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import HighlightLayer from "./HighlightLayer";
import CitationPopover from "./CitationPopover";
import type { HighlightData } from "@/types";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  onTextSelect?: (text: string, page: number) => void;
  highlights?: HighlightData[];
  goToPage?: number | null;
  onAddHighlight?: (hl: {
    page: number;
    startOffset: number;
    endOffset: number;
    color: string;
  }) => void;
  onDeleteHighlight?: (id: string) => void;
  onUpdateMemo?: (id: string, memo: string) => void;
}

export default function PdfViewer({
  fileUrl,
  onTextSelect,
  highlights = [],
  goToPage,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateMemo,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);

  useEffect(() => {
    if (goToPage && goToPage >= 1 && goToPage <= numPages) {
      setCurrentPage(goToPage);
    }
  }, [goToPage, numPages]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onTextSelect?.(selection.toString().trim(), currentPage);
    }
  }, [currentPage, onTextSelect]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 shrink-0">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="px-2 py-1 text-sm border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-sm">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="px-2 py-1 text-sm border rounded disabled:opacity-50"
        >
          Next
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          className="px-2 py-1 text-sm border rounded"
        >
          -
        </button>
        <span className="text-sm">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.1))}
          className="px-2 py-1 text-sm border rounded"
        >
          +
        </button>
      </div>

      {/* PDF Content */}
      <div
        className="flex-1 overflow-auto bg-gray-200 p-4"
        onMouseUp={handleMouseUp}
      >
        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
          <div className="relative">
            <Page pageNumber={currentPage} scale={scale} />
            {onAddHighlight && onDeleteHighlight && onUpdateMemo && (
              <HighlightLayer
                highlights={highlights}
                page={currentPage}
                onAddHighlight={onAddHighlight}
                onDeleteHighlight={onDeleteHighlight}
                onUpdateMemo={onUpdateMemo}
              />
            )}
          </div>
        </Document>
      </div>

      {/* Citation popover — listens globally for hover on citation elements */}
      <CitationPopover references={[]} />
    </div>
  );
}
```

- [ ] **Step 2: Create resizable split pane component**

Create `src/components/layout/ResizableLayout.tsx`:

```tsx
"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  right: ReactNode;
  defaultRightWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
}

export default function ResizableLayout({
  left,
  right,
  defaultRightWidth = 384,
  minRightWidth = 280,
  maxRightWidth = 600,
}: Props) {
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setRightWidth(Math.min(maxRightWidth, Math.max(minRightWidth, newWidth)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [minRightWidth, maxRightWidth]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 min-w-0">{left}</div>
      <div
        onMouseDown={handleMouseDown}
        className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize shrink-0"
      />
      <div className="shrink-0 overflow-hidden" style={{ width: rightWidth }}>
        {right}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update PaperView to use resizable layout and integrate all components**

Update `src/app/paper/[id]/PaperView.tsx`:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import PdfViewer from "@/components/pdf/PdfViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import AnalysisStatus from "@/components/layout/AnalysisStatus";
import ResizableLayout from "@/components/layout/ResizableLayout";
import HighlightList from "@/components/highlights/HighlightList";
import type { PaperMeta, HighlightData } from "@/types";

interface Props {
  paper: PaperMeta;
}

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [goToPage, setGoToPage] = useState<number | null>(null);

  const fileUrl = paper.filePath ? `/api/papers/${paper.id}/pdf` : "";

  const clearSelection = useCallback(() => setSelectedText(null), []);

  useEffect(() => {
    fetch(`/api/highlights?paperId=${paper.id}`)
      .then((res) => res.json())
      .then(setHighlights)
      .catch(() => {});
  }, [paper.id]);

  async function handleAddHighlight(hl: {
    page: number;
    startOffset: number;
    endOffset: number;
    color: string;
  }) {
    const res = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, ...hl }),
    });
    const created = await res.json();
    setHighlights((prev) => [...prev, created]);
  }

  async function handleDeleteHighlight(id: string) {
    await fetch(`/api/highlights?id=${id}`, { method: "DELETE" });
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }

  async function handleUpdateMemo(id: string, memo: string) {
    await fetch("/api/highlights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, memo }),
    });
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, memo } : h))
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
      </div>

      {/* Analysis Status */}
      <AnalysisStatus paperId={paper.id} onComplete={() => {}} />

      {/* Main content */}
      <ResizableLayout
        left={
          fileUrl ? (
            <PdfViewer
              fileUrl={fileUrl}
              onTextSelect={(text) => setSelectedText(text)}
              highlights={highlights}
              goToPage={goToPage}
              onAddHighlight={handleAddHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              onUpdateMemo={handleUpdateMemo}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No PDF available. Analysis will use the paper URL.
            </div>
          )
        }
        right={
          <ChatPanel
            paperId={paper.id}
            selectedText={selectedText}
            onClearSelection={clearSelection}
          />
        }
      />

      {/* Highlight List */}
      <HighlightList
        highlights={highlights}
        onGoToPage={(page) => setGoToPage(page)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update root layout**

Update `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Review Tool",
  description: "Read papers with an AI research mate",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ResizableLayout.tsx src/components/pdf/PdfViewer.tsx src/app/paper/[id]/PaperView.tsx src/app/layout.tsx
git commit -m "feat: resizable layout with full component integration"
```

---

## Task 11: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 2: Full build and manual test**

```bash
npm run build && npm run dev
```

Manual verification:
1. Open `http://localhost:3000`
2. Upload a PDF or enter an arXiv URL
3. Verify PDF renders with page navigation and zoom
4. Click "Start Analysis" and verify SSE progress
5. Type a chat message and verify streaming response
6. Select text in PDF and verify it appears in chat context
7. Test highlighting with different colors
8. Test highlight list panel (open/close, filter, click-to-navigate)

- [ ] **Step 3: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes"
```

---

## Task Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project scaffolding, DB schema | package.json, prisma/schema.prisma |
| 2 | Paper management API | src/lib/papers.ts, src/app/api/papers/ |
| 3 | PDF viewer with navigation | src/components/pdf/PdfViewer.tsx |
| 4 | AI provider abstraction | src/lib/ai/provider.ts, claude-agent.ts |
| 5 | Skill system | src/lib/ai/skills.ts, skills/*.md |
| 6 | Analysis pipeline (SSE) | src/app/api/analyze/route.ts |
| 7 | Chat system | src/app/api/chat/, src/components/chat/ |
| 8 | Highlighting system | src/app/api/highlights/, HighlightLayer |
| 9 | Citation popover | src/components/pdf/CitationPopover.tsx |
| 10 | Resizable layout + full integration | PdfViewer, ResizableLayout, PaperView |
| 11 | End-to-end verification | Manual testing + fixes |
