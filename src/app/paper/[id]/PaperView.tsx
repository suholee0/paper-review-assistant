"use client";

import { useState } from "react";
import PdfViewer from "@/components/pdf/PdfViewer";
import type { PaperMeta } from "@/types";

interface Props {
  paper: PaperMeta;
}

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  const fileUrl = paper.filePath
    ? `/api/papers/${paper.id}/pdf`
    : "";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 min-w-0">
          {fileUrl ? (
            <PdfViewer
              fileUrl={fileUrl}
              onTextSelect={(text) => setSelectedText(text)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No PDF available. Analysis will use the paper URL.
            </div>
          )}
        </div>

        {/* Chat Panel placeholder */}
        <div className="w-96 border-l bg-white flex flex-col">
          <div className="p-4 text-gray-500 text-sm">
            Chat panel (coming in Task 8)
          </div>
          {selectedText && (
            <div className="p-3 mx-3 mb-3 bg-blue-50 rounded text-xs">
              Selected: &ldquo;{selectedText.slice(0, 100)}...&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
