"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import PdfViewer from "@/components/pdf/PdfViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import AnalysisStatus from "@/components/layout/AnalysisStatus";
import ResizableLayout from "@/components/layout/ResizableLayout";
import HighlightList from "@/components/highlights/HighlightList";
import DocViewer from "@/components/docs/DocViewer";
import PaperOnboarding from "@/components/onboarding/PaperOnboarding";
import type { PaperMeta, HighlightData, HighlightRect, HighlightColor } from "@/types";

interface Props {
  paper: PaperMeta;
}

type TabId = "pdf" | "analysis" | string; // string for "bg:<topic>"

export default function PaperView({ paper }: Props) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [goToPage, setGoToPage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("pdf");
  const [bgTopics, setBgTopics] = useState<string[]>([]);
  const [hasAnalysis, setHasAnalysis] = useState(false);

  const fileUrl = paper.filePath ? `/api/papers/${paper.id}/pdf` : "";
  const clearSelection = useCallback(() => setSelectedText(null), []);

  useEffect(() => {
    fetch(`/api/papers/${paper.id}/status`)
      .then((r) => r.json())
      .then((s: { analyzed: boolean; backgroundTopics: string[] }) => {
        setHasAnalysis(s.analyzed);
        setBgTopics(s.backgroundTopics);
      })
      .catch(() => {});
  }, [paper.id]);

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

  function renderLeftPanel() {
    if (activeTab === "pdf") {
      return fileUrl ? (
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
          No PDF available.
        </div>
      );
    }

    if (activeTab === "analysis") {
      return <DocViewer paperId={paper.id} docPath="analysis.md" />;
    }

    if (activeTab.startsWith("bg:")) {
      const topic = activeTab.slice(3);
      return <DocViewer paperId={paper.id} docPath={`background/${topic}.md`} />;
    }

    return null;
  }

  const tabClass = (id: TabId) => {
    const isActive = activeTab === id;
    const isBg = id.startsWith("bg:");
    const base = "px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap";
    if (isActive) {
      if (id === "pdf") return `${base} bg-gray-800 text-white`;
      if (id === "analysis") return `${base} bg-blue-600 text-white`;
      if (isBg) return `${base} bg-green-600 text-white`;
    }
    return `${base} text-gray-500 hover:bg-gray-200`;
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
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

      {/* Tabs */}
      <div data-onboarding="tabs" className="flex items-center gap-0.5 px-3 py-1 bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0">
        <button className={tabClass("pdf")} onClick={() => setActiveTab("pdf")}>
          PDF
        </button>

        {hasAnalysis && (
          <>
            <div className="w-px h-4 bg-gray-300 mx-1.5 shrink-0" />
            <button className={tabClass("analysis")} onClick={() => setActiveTab("analysis")}>
              분석
            </button>
          </>
        )}

        {bgTopics.length > 0 && (
          <>
            <div className="w-px h-4 bg-gray-300 mx-1.5 shrink-0" />
            <span className="text-[10px] text-gray-400 mr-1 shrink-0">배경지식</span>
            {bgTopics.map((topic) => (
              <button
                key={topic}
                className={tabClass(`bg:${topic}`)}
                onClick={() => setActiveTab(`bg:${topic}`)}
              >
                {topic.replace(/-/g, " ")}
              </button>
            ))}
          </>
        )}
      </div>

      <ResizableLayout
        left={renderLeftPanel()}
        right={
          <ChatPanel
            paperId={paper.id}
            selectedText={selectedText}
            onClearSelection={clearSelection}
          />
        }
      />

      {activeTab === "pdf" && (
        <HighlightList
          highlights={highlights}
          onNavigate={(page) => setGoToPage(page)}
        />
      )}

      <PaperOnboarding />
    </div>
  );
}
