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
      id: "hl-1", paperId: "paper-1", page: 3,
      startOffset: 100, endOffset: 200, color: "yellow",
      memo: null, createdAt: new Date(),
    };

    (prisma.highlight.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockHighlight);

    const { POST } = await import("@/app/api/highlights/route");

    const request = new Request("http://localhost/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperId: "paper-1", page: 3, startOffset: 100, endOffset: 200, color: "yellow",
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
    const request = new Request("http://localhost/api/highlights?paperId=paper-1");
    const response = await GET(request);
    const data = await response.json();
    expect(data).toHaveLength(1);
  });
});
