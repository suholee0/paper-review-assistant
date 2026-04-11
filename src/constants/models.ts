export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet" },
  { id: "claude-opus-4-6", label: "Opus" },
] as const;

export type ChatModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_CHAT_MODEL: ChatModelId = "claude-sonnet-4-6";
