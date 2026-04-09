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
