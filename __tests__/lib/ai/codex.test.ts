import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadEvent } from "@openai/codex-sdk";
import { CodexProvider } from "@/lib/ai/codex";
import type { AIQueryOptions } from "@/lib/ai/provider";

const sdk = vi.hoisted(() => ({ startThread: vi.fn(), resumeThread: vi.fn(), runStreamed: vi.fn(), constructor: vi.fn() }));
vi.mock("@openai/codex-sdk", () => ({ Codex: class {
  constructor(options: unknown) { sdk.constructor(options); }
  startThread = sdk.startThread;
  resumeThread = sdk.resumeThread;
} }));
const id = "12345678-1234-1234-1234-123456789abc";
const completed: ThreadEvent = { type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 } };
function events(sequence: ThreadEvent[], failure?: Error) {
  sdk.runStreamed.mockImplementation(async () => ({ events: (async function* () {
    yield* sequence;
    if (failure) throw failure;
  })() }));
}
async function collect(options: AIQueryOptions = { prompt: "질문" }, provider = new CodexProvider()) {
  const chunks = [];
  for await (const chunk of provider.query(options)) chunks.push(chunk);
  return chunks;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  sdk.startThread.mockReturnValue({ runStreamed: sdk.runStreamed });
  sdk.resumeThread.mockReturnValue({ runStreamed: sdk.runStreamed });
  events([{ type: "thread.started", thread_id: id }, completed]);
});

describe("CodexProvider", () => {
  it("uses read-only defaults and local model configuration, returning a namespaced session", async () => {
    const chunks = await collect({ prompt: "질문", model: "default", cwd: "/papers/test", webSearch: true });
    expect(sdk.startThread).toHaveBeenCalledWith(expect.objectContaining({ workingDirectory: "/papers/test", sandboxMode: "read-only", approvalPolicy: "never", networkAccessEnabled: false, webSearchMode: "live", model: undefined }));
    expect(chunks).toEqual([{ type: "done", sessionId: `codex:${id}` }]);
  });
  it("resumes only IDs created by this provider and reapplies access and model", async () => {
    vi.stubEnv("CODEX_MODEL", "configured-model");
    await collect({ prompt: "보강", sessionId: `codex:${id}`, access: "workspace-write" });
    expect(sdk.resumeThread).toHaveBeenCalledWith(id, expect.objectContaining({ sandboxMode: "workspace-write", webSearchMode: "disabled", model: "configured-model" }));
    sdk.resumeThread.mockClear();
    await collect({ prompt: "질문", sessionId: id });
    expect(sdk.resumeThread).not.toHaveBeenCalled();
    expect(sdk.startThread).toHaveBeenCalled();
  });
  it("emits completed message snapshots once and translates command, search and file events", async () => {
    const message = { id: "m", type: "agent_message" as const, text: "답변" };
    const command = { id: "c", type: "command_execution" as const, command: "cat analysis.md", aggregated_output: "", status: "in_progress" as const };
    events([
      { type: "thread.started", thread_id: id },
      { type: "item.started", item: command }, { type: "item.updated", item: command },
      { type: "item.completed", item: { id: "w", type: "web_search", query: "paper" } },
      { type: "item.completed", item: { id: "f", type: "file_change", changes: [{ path: "/papers/test/analysis.md", kind: "update" }], status: "completed" } },
      { type: "item.updated", item: message }, { type: "item.completed", item: message }, { type: "item.completed", item: message }, completed,
    ]);
    const chunks = await collect();
    expect(chunks.filter((chunk) => chunk.type === "text")).toEqual([{ type: "text", content: "답변" }]);
    expect(chunks.filter((chunk) => chunk.type === "tool_use")).toHaveLength(3);
    expect(chunks.at(-1)?.type).toBe("done");
  });
  it.each([
    [{ type: "turn.failed", error: { message: "Authentication failed" } }],
    [{ type: "error", message: "transport failed" }],
    [{ type: "thread.started", thread_id: id }],
  ])("does not emit success for failed or truncated streams", async (...sequence) => {
    events(sequence as ThreadEvent[]);
    const chunks = await collect();
    expect(chunks.some((chunk) => chunk.type === "error")).toBe(true);
    expect(chunks.some((chunk) => chunk.type === "done")).toBe(false);
  });
  it("waits for clean SDK exit even after turn.completed", async () => {
    events([{ type: "thread.started", thread_id: id }, completed], new Error("process exited 1"));
    expect(await collect()).toEqual([{ type: "error", message: "process exited 1" }]);
  });
  it("does not start a process for an already cancelled request", async () => {
    const abort = new AbortController(); abort.abort(new Error("cancelled"));
    expect(await collect({ prompt: "test", signal: abort.signal })).toEqual([{ type: "error", message: "cancelled" }]);
    expect(sdk.startThread).not.toHaveBeenCalled();
  });
  it("releases the paper lock and cancels SDK work when the consumer closes the stream", async () => {
    events([{ type: "thread.started", thread_id: id }, { type: "item.completed", item: { id: "m", type: "agent_message", text: "text" } }, completed]);
    const provider = new CodexProvider();
    const stream = provider.query({ prompt: "first", cwd: "/papers/test" });
    await stream.next();
    expect((await collect({ prompt: "second", cwd: "/papers/test" }, provider))[0].type).toBe("error");
    const signal = sdk.runStreamed.mock.calls[0][1].signal as AbortSignal;
    await stream.return(undefined);
    expect(signal.aborted).toBe(true);
    expect((await collect({ prompt: "third", cwd: "/papers/test" }, provider)).at(-1)?.type).toBe("done");
  });
});
