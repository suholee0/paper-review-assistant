import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIQueryOptions, AIResponse } from "./provider";

/**
 * ClaudeAgentProvider wraps @anthropic-ai/sdk as a fallback implementation.
 *
 * This uses the standard Anthropic Messages API with streaming to produce the
 * same AIResponse interface that a real Claude Agent SDK would provide.
 * The interface is identical so it can be swapped for @anthropic-ai/claude-agent-sdk
 * (or @anthropic-ai/claude-code) once that package becomes available.
 *
 * Session resumption is approximated by storing conversation history in memory
 * keyed by sessionId.
 */

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const sessions = new Map<string, ConversationTurn[]>();

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ClaudeAgentProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async *query(options: AIQueryOptions): AsyncGenerator<AIResponse> {
    const { prompt, sessionId, allowedTools } = options;

    // Resolve or create session
    const currentSessionId = sessionId ?? generateSessionId();
    const history = sessions.get(currentSessionId) ?? [];

    // Add the new user turn
    history.push({ role: "user", content: prompt });

    // Build message params
    const messages: Anthropic.MessageParam[] = history.slice(0, -1).map((t) => ({
      role: t.role,
      content: t.content,
    }));
    messages.push({ role: "user", content: prompt });

    yield { type: "progress", message: "Querying Claude..." };

    try {
      let fullText = "";

      const stream = await this.client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 8192,
        messages,
        stream: true,
        ...(allowedTools && allowedTools.length > 0
          ? {
              tools: allowedTools.map((name) => ({
                name,
                description: `Tool: ${name}`,
                input_schema: { type: "object" as const, properties: {} },
              })),
            }
          : {}),
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullText += event.delta.text;
          yield { type: "text", content: event.delta.text };
        }
      }

      // Store assistant reply in session history
      history.push({ role: "assistant", content: fullText });
      sessions.set(currentSessionId, history);

      yield { type: "done", sessionId: currentSessionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", message };
    }
  }
}
