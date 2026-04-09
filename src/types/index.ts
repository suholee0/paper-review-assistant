export interface PaperMeta {
  id: string;
  title: string;
  url: string | null;
  filePath: string;
  chatSessionId: string | null;
  createdAt: Date;
}

export interface HighlightData {
  id: string;
  paperId: string;
  page: number;
  startOffset: number;
  endOffset: number;
  color: string;
  memo: string | null;
  createdAt: Date;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  context?: string;
  timestamp: Date;
}

export interface AnalysisProgress {
  phase: "skimming" | "building" | "reading" | "complete" | "error";
  message: string;
  topics?: string[];
  completedTopics?: string[];
}

export interface BackgroundTopic {
  name: string;
  filename: string;
}
