import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AIProvider, AIQueryOptions, AIResponse } from "./provider";

/**
 * ClaudeAgentProvider wraps @anthropic-ai/claude-agent-sdk.
 *
 * Uses the user's existing Claude Code authentication — no separate API key needed.
 * Session resumption is handled natively by the SDK via the `resume` option.
 */
export class ClaudeAgentProvider implements AIProvider {
  async *query(options: AIQueryOptions): AsyncGenerator<AIResponse> {
    const { prompt, sessionId, cwd, allowedTools } = options;

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

        // Log assistant messages with actual content
        if (message.type === "assistant" && "message" in message) {
          const msg = message.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
          for (const block of msg.content || []) {
            if (block.type === "text" && block.text) {
              console.log("[claude]", block.text.slice(0, 200));
            } else if (block.type === "tool_use") {
              console.log("[claude] Tool:", block.name, JSON.stringify(block.input).slice(0, 150));
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
