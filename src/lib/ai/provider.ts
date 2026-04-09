export type AIResponse =
  | { type: "text"; content: string }
  | { type: "progress"; message: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; message: string };

export interface AIQueryOptions {
  prompt: string;
  sessionId?: string;
  cwd?: string;
  allowedTools?: string[];
}

export interface AIProvider {
  query(options: AIQueryOptions): AsyncGenerator<AIResponse>;
}

let instance: ClaudeAgentProvider | null = null;

export function getAIProvider(): ClaudeAgentProvider {
  if (!instance) {
    instance = new ClaudeAgentProvider();
  }
  return instance;
}

// Import ClaudeAgentProvider lazily to keep this file clean
import { ClaudeAgentProvider } from "./claude-agent";
