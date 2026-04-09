export type { ReferenceInfo } from "@/lib/references";

export interface PaperMeta {
  id: string;
  title: string;
  url: string | null;
  filePath: string;
  chatSessionId: string | null;
  createdAt: Date;
}

export interface HighlightRect {
  top: number;    // percentage (0-100)
  left: number;   // percentage (0-100)
  width: number;  // percentage (0-100)
  height: number; // percentage (0-100)
}

export interface HighlightData {
  id: string;
  paperId: string;
  page: number;
  rects: HighlightRect[]; // parsed from JSON
  text: string;
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
