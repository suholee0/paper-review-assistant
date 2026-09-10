import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ChatPanel from "@/components/chat/ChatPanel";

vi.mock("@/components/chat/MessageList", () => ({ default: ({ messages }: { messages: { content: string }[] }) => <div>{messages.map((message, index) => <p key={index}>{message.content}</p>)}</div> }));
vi.mock("@/components/chat/MessageInput", () => ({ default: ({ onSend }: { onSend: (text: string) => void }) => <button onClick={() => onSend("질문")}>질문 보내기</button> }));
vi.mock("@/components/chat/ExportButton", () => ({ default: () => null }));
vi.mock("@/components/chat/DragContext", () => ({ default: () => null }));

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(events: unknown[]) {
  const content = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/status")
    ? new Response(JSON.stringify({ backgroundTopics: [] }))
    : new Response(content, { headers: { "Content-Type": "text/event-stream" } })));
  render(<ChatPanel paperId="test" selectedText={null} onClearSelection={() => {}} />);
  fireEvent.click(screen.getByText("질문 보내기"));
}

describe("Codex SSE frontend compatibility", () => {
  it("displays the completed streamed response", async () => {
    setup([{ type: "text", content: "Codex 답변" }, { type: "done", sessionId: "codex:test" }]);
    expect(await screen.findByText("Codex 답변")).toBeTruthy();
  });
  it("shows the runtime error instead of an empty successful response", async () => {
    setup([{ type: "error", message: "Codex login required" }]);
    expect(await screen.findByText("오류: Codex login required")).toBeTruthy();
  });
  it("does not treat a disconnected stream as a completed conversation", async () => {
    setup([{ type: "text", content: "partial" }]);
    expect(await screen.findByText("오류: 응답이 완료되기 전에 연결이 종료되었습니다.")).toBeTruthy();
  });
});
