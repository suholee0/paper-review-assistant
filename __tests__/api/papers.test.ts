import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

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
