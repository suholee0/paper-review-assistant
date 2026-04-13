"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import PdfViewer from "@/components/pdf/PdfViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import AnalysisStatus from "@/components/layout/AnalysisStatus";
import ResizableLayout from "@/components/layout/ResizableLayout";
import HighlightList from "@/components/highlights/HighlightList";
import type { PaperMeta, HighlightData, HighlightRect, HighlightColor } from "@/types";

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
    color: HighlightColor;
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
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{paper.title}</h1>
            {paper.authors && (
              <p className="text-xs text-gray-500 truncate">
                {paper.authors}
                {paper.publishedDate && ` · ${paper.publishedDate}`}
              </p>
            )}
          </div>
        </div>
      </div>

      <AnalysisStatus paperId={paper.id} />

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
              onAskAI={(text) => setSelectedText(text)}
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
