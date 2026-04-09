"use client";

import { useState, useCallback } from "react";
import PdfViewer from "@/components/pdf/PdfViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import AnalysisStatus from "@/components/layout/AnalysisStatus";
import type { PaperMeta } from "@/types";

interface Props {
  paper: PaperMeta;
}

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  const fileUrl = paper.filePath ? `/api/papers/${paper.id}/pdf` : "";
  const clearSelection = useCallback(() => setSelectedText(null), []);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
      </div>

      <AnalysisStatus paperId={paper.id} onComplete={() => {}} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          {fileUrl ? (
            <PdfViewer fileUrl={fileUrl} onTextSelect={(text) => setSelectedText(text)} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No PDF available. Analysis will use the paper URL.
            </div>
          )}
        </div>
        <div className="w-96 border-l bg-white flex flex-col">
          <ChatPanel paperId={paper.id} selectedText={selectedText} onClearSelection={clearSelection} />
        </div>
      </div>
    </div>
  );
}
