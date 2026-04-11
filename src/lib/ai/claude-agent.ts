import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "path";
import type { AIProvider, AIQueryOptions, AIResponse } from "./provider";

/**
 * Convert a tool_use block into a user-friendly progress message.
 * Shown in the chat UI to indicate what the AI is currently doing.
 */
function summarizeToolUse(name: string, input: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;

  switch (name) {
    case "Read": {
      const filePath = typeof inp.file_path === "string" ? inp.file_path : "";
      const base = filePath ? path.basename(filePath) : "파일";
      return `📖 ${base} 읽는 중`;
    }
    case "Glob": {
      const pattern = typeof inp.pattern === "string" ? inp.pattern : "";
      return `🔍 파일 검색 중: ${pattern}`;
    }
    case "Grep": {
      const pattern = typeof inp.pattern === "string" ? inp.pattern : "";
      return `🔍 내용 검색 중: ${pattern}`;
    }
    case "WebSearch": {
      const q = typeof inp.query === "string" ? inp.query : "";
      return `🌐 웹 검색 중: ${q}`;
    }
    case "WebFetch": {
      const url = typeof inp.url === "string" ? inp.url : "";
      return `🌐 페이지 가져오는 중: ${url}`;
    }
    case "Bash": {
      const cmd = typeof inp.command === "string" ? inp.command : "";
      return `⚙️ 명령 실행 중: ${cmd.slice(0, 60)}`;
    }
    default:
      return `🔧 ${name} 실행 중`;
  }
}

/**
 * ClaudeAgentProvider wraps @anthropic-ai/claude-agent-sdk.
 *
 * Uses the user's existing Claude Code authentication — no separate API key needed.
 * Session resumption is handled natively by the SDK via the `resume` option.
 */
export class ClaudeAgentProvider implements AIProvider {
  async *query(options: AIQueryOptions): AsyncGenerator<AIResponse> {
    const { prompt, sessionId, cwd, allowedTools, model } = options;

    try {
      let currentSessionId = "";

      console.log("[claude-agent] Starting query, prompt length:", prompt.length);
      console.log("[claude-agent] cwd:", cwd, "sessionId:", sessionId);

      // Default tools needed for paper analysis: file ops + web access
      const defaultAllowedTools = [
        "Read", "Write", "Edit",
        "Bash", "Glob", "Grep",
        "WebSearch", "WebFetch",
      ];

      const sdkOptions: Record<string, unknown> = {
        cwd: cwd || process.cwd(),
        allowedTools: allowedTools || defaultAllowedTools,
      };

      if (model) {
        sdkOptions.model = model;
      }

      if (sessionId) {
        sdkOptions.resume = sessionId;
      }

      for await (const message of query({
        prompt,
        options: sdkOptions,
      })) {
        // Capture session ID from any message that has it
        if ("session_id" in message && message.session_id) {
          currentSessionId = message.session_id;
        }

        // Handle assistant messages: log text content and emit tool_use progress
        if (message.type === "assistant" && "message" in message) {
          const msg = message.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
          for (const block of msg.content || []) {
            if (block.type === "text" && block.text) {
              console.log("[claude]", block.text.slice(0, 200));
            } else if (block.type === "tool_use" && block.name) {
              console.log("[claude] Tool:", block.name, JSON.stringify(block.input).slice(0, 150));
              yield {
                type: "tool_use",
                name: block.name,
                summary: summarizeToolUse(block.name, block.input),
              };
            }
          }
        }

        // Log tool results
        if (message.type === "user") {
          // user messages in SDK are typically tool results
        }

        // Real-time streaming text deltas
        if (message.type === "stream_event") {
          const event = message.event;
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            yield { type: "text", content: event.delta.text };
          }
        }

        // Final result
        if (message.type === "result") {
          if (message.subtype === "success") {
            // If no streaming deltas were received, yield the full result
            if (message.result) {
              yield { type: "text", content: message.result };
            }
          } else {
            // Error result
            const errors =
              "errors" in message ? (message.errors as string[]) : [];
            yield {
              type: "error",
              message: errors.join("; ") || "Query failed",
            };
          }
          yield { type: "done", sessionId: currentSessionId };
        }
      }
    } catch (err) {
      console.error("[claude-agent] Error:", err);
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", message };
    }
  }
}
