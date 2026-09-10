import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ directory: "", query: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { paper: { findUnique: state.findUnique } } }));
vi.mock("@/lib/ai/provider", () => ({ getAIProvider: () => ({ query: state.query }) }));
vi.mock("@/lib/papers", () => ({ getPaperDir: () => state.directory }));
import { POST } from "@/app/api/papers/[id]/export/route";
const id = "12345678-1234-1234-1234-123456789abc";
const original = "# Existing analysis\nUser notes to preserve\n";
function request(messages: unknown = [{ role: "user", content: "Add our discussion" }]) {
  return new Request(`http://localhost/api/papers/${id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) }) as NextRequest;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-export-test-"));
  fs.writeFileSync(path.join(state.directory, "analysis.md"), original);
  state.findUnique.mockResolvedValue({ id });
});
afterEach(() => fs.rmSync(state.directory, { recursive: true, force: true }));

describe("analysis export SSE contract", () => {
  it("uses Codex write access and returns the updated document after successful completion", async () => {
    state.query.mockImplementation(async function* () {
      yield { type: "tool_use", name: "file_change", summary: "문서 수정" };
      fs.writeFileSync(path.join(state.directory, "analysis.md"), original + "\n## Discussion Notes\nNew insight\n");
      yield { type: "done", sessionId: `codex:${id}` };
    });
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    const body = await response.text();
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(state.query).toHaveBeenCalledWith(expect.objectContaining({ access: "workspace-write", webSearch: false, cwd: state.directory, signal: expect.anything() }));
    expect(body).toContain('"type":"done"');
    expect(body).toContain("User notes to preserve");
    expect(body).toContain("New insight");
  });
  it("does not report completion if the runtime leaves the file unchanged", async () => {
    state.query.mockImplementation(async function* () { yield { type: "done", sessionId: `codex:${id}` }; });
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    const body = await response.text();
    expect(body).toContain('"type":"error"');
    expect(body).not.toContain('"type":"done"');
    expect(fs.readFileSync(path.join(state.directory, "analysis.md"), "utf8")).toBe(original);
  });
  it("forwards SDK failure without a successful export", async () => {
    state.query.mockImplementation(async function* () { yield { type: "error", message: "Codex authentication failed" }; });
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    const body = await response.text();
    expect(body).toContain("Codex authentication failed");
    expect(body).not.toContain('"type":"done"');
  });
  it("rejects missing conversation before starting Codex", async () => {
    expect((await POST(request([]), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(state.query).not.toHaveBeenCalled();
  });
});
