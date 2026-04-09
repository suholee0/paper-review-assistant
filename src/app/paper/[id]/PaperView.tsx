"use client";

import { useState, useCallback, useEffect } from "react";
import PdfViewer from "@/components/pdf/PdfViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import AnalysisStatus from "@/components/layout/AnalysisStatus";
import ResizableLayout from "@/components/layout/ResizableLayout";
import HighlightList from "@/components/highlights/HighlightList";
import type { PaperMeta, HighlightData, HighlightRect } from "@/types";

interface Props {
  paper: PaperMeta;
}

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [goToPage, setGoToPage] = useState<number | null>(null);

  const fileUrl = paper.filePath ? `/api/papers/${paper.id}/pdf` : "";
  const clearSelection = useCallback(() => setSelectedText(null), []);

  useEffect(() => {
    fetch(`/api/highlights?paperId=${paper.id}`)
      .then((res) => res.json())
      .then(setHighlights)
      .catch(() => {});
  }, [paper.id]);

  async function handleAddHighlight(hl: {
    page: number;
    rects: HighlightRect[];
    text: string;
    color: string;
  }) {
    const res = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, ...hl, rects: JSON.stringify(hl.rects) }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setHighlights((prev) => [...prev, created]);
  }

  async function handleDeleteHighlight(id: string) {
    const res = await fetch(`/api/highlights?id=${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }

  async function handleUpdateMemo(id: string, memo: string) {
    const res = await fetch("/api/highlights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, memo }),
    });
    if (!res.ok) return;
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, memo } : h))
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
      </div>

      <AnalysisStatus paperId={paper.id} onComplete={() => {}} />

      <ResizableLayout
        left={
          fileUrl ? (
            <PdfViewer
              fileUrl={fileUrl}
              onTextSelect={(text) => setSelectedText(text)}
              highlights={highlights}
              goToPage={goToPage}
              onAddHighlight={handleAddHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              onUpdateMemo={handleUpdateMemo}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No PDF available. Analysis will use the paper URL.
            </div>
          )
        }
        right={
          <ChatPanel
            paperId={paper.id}
            selectedText={selectedText}
            onClearSelection={clearSelection}
          />
        }
      />

      <HighlightList
        highlights={highlights}
        onNavigate={(page) => setGoToPage(page)}
      />
    </div>
  );
}
