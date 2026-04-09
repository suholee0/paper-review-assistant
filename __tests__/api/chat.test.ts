import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock AI provider
vi.mock("@/lib/ai/provider", () => ({
  getAIProvider: vi.fn(() => ({
    query: vi.fn(async function* () {
      yield { type: "text", content: "Hello " };
      yield { type: "text", content: "world" };
      yield { type: "done", sessionId: "new-session-123" };
    }),
  })),
}));

// Mock papers
vi.mock("@/lib/papers", () => ({
  getPaperDir: vi.fn(() => "/papers/test-paper"),
}));

import { prisma } from "@/lib/db";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams AI response as SSE for new conversation", async () => {
    const mockPaper = {
      id: "paper-1",
      title: "Test Paper",
      url: "https://arxiv.org/abs/1706.03762",
      filePath: "",
      chatSessionId: null,
      createdAt: new Date(),
    };

    (prisma.paper.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPaper);
    (prisma.paper.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockPaper, chatSessionId: "new-session-123" });

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperId: "paper-1",
        message: "What is this paper about?",
      }),
    });

    const response = await POST(request as any);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await response.text();
    expect(text).toContain("Hello ");
    expect(text).toContain("world");
    expect(text).toContain("new-session-123");
  });

  it("returns 404 for unknown paper", async () => {
    (prisma.paper.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: "nonexistent", message: "hi" }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(404);
  });

  it("includes dragged text context in prompt", async () => {
    const mockPaper = {
      id: "paper-2",
      title: "Test",
      url: null,
      filePath: "/papers/paper-2/original.pdf",
      chatSessionId: "existing-session",
      createdAt: new Date(),
    };

    (prisma.paper.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPaper);

    const { getAIProvider } = await import("@/lib/ai/provider");
    const mockQuery = vi.fn(async function* () {
      yield { type: "text" as const, content: "Response" };
      yield { type: "done" as const, sessionId: "existing-session" };
    });
    (getAIProvider as ReturnType<typeof vi.fn>).mockReturnValue({ query: mockQuery });

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperId: "paper-2",
        message: "Explain this",
        context: "The attention mechanism allows...",
      }),
    });

    const response = await POST(request as any);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    // Verify the AI was called with context included in prompt
    expect(mockQuery).toHaveBeenCalled();
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.prompt).toContain("The attention mechanism allows...");
    expect(callArgs.sessionId).toBe("existing-session");
  });
});
