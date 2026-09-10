import { CodexProvider } from "./codex";

export type AIResponse =
  | { type: "text"; content: string }
  | { type: "progress"; message: string }
  | { type: "tool_use"; name: string; summary: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; message: string };

export interface AIQueryOptions {
  prompt: string;
  sessionId?: string;
  cwd?: string;
  access?: "read-only" | "workspace-write";
  webSearch?: boolean;
  signal?: AbortSignal;
  model?: string;
}

export interface AIProvider {
  query(options: AIQueryOptions): AsyncGenerator<AIResponse>;
}

let instance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!instance) {
    instance = new CodexProvider();
  }
  return instance;
}
