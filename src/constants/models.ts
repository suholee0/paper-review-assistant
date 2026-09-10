export const AVAILABLE_MODELS = [
  { id: "default", label: "Codex (기본 모델)" },
] as const;

export type ChatModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// The server uses CODEX_MODEL when set, otherwise the local Codex configuration.
export const DEFAULT_CHAT_MODEL: ChatModelId = "default";
