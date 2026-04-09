"use client";

import { useState } from "react";
import type { HighlightData } from "@/types";

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-200/50",
  green: "bg-green-200/50",
  blue: "bg-blue-200/50",
  pink: "bg-pink-200/50",
};

const COLORS = ["yellow", "green", "blue", "pink"] as const;

const COLOR_SWATCHES: Record<string, string> = {
  yellow: "bg-yellow-300",
  green: "bg-green-300",
  blue: "bg-blue-300",
  pink: "bg-pink-300",
};

interface Props {
  page: number;
  highlights: HighlightData[];
  onAddHighlight: (hl: { page: number; startOffset: number; endOffset: number; color: string }) => void;
  onDeleteHighlight: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
}

export default function HighlightLayer({
  page,
  highlights,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateMemo,
}: Props) {
  const [selectedColor, setSelectedColor] = useState<string>("yellow");
  const [activeHighlight, setActiveHighlight] = useState<HighlightData | null>(null);
  const [memoText, setMemoText] = useState<string>("");

  const pageHighlights = highlights.filter((h) => h.page === page);

  function handleHighlight() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    if (startOffset === endOffset) return;

    onAddHighlight({ page, startOffset, endOffset, color: selectedColor });

    selection.removeAllRanges();
  }

  function handleSaveMemo() {
    if (!activeHighlight) return;

    onUpdateMemo(activeHighlight.id, memoText);
    setActiveHighlight(null);
    setMemoText("");
  }

  function handleDelete(id: string) {
    onDeleteHighlight(id);
    setActiveHighlight(null);
    setMemoText("");
  }

  return (
    <div className="relative">
      {/* Color picker toolbar */}
      <div className="flex items-center gap-1 mb-1">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className={`w-5 h-5 rounded-full ${COLOR_SWATCHES[color]} ${
              selectedColor === color ? "ring-2 ring-offset-1 ring-gray-500" : ""
            }`}
            title={color}
          />
        ))}
        <button
          onClick={handleHighlight}
          className="ml-2 px-2 py-0.5 text-xs font-bold bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
          title="Highlight selected text"
        >
          H
        </button>
      </div>

      {/* Highlight overlays */}
      {pageHighlights.map((hl) => (
        <button
          key={hl.id}
          onClick={() => {
            setActiveHighlight(hl);
            setMemoText(hl.memo ?? "");
          }}
          className={`absolute cursor-pointer ${COLOR_MAP[hl.color] ?? "bg-yellow-200/50"} rounded`}
          style={{
            left: `${hl.startOffset}px`,
            top: 0,
            width: `${hl.endOffset - hl.startOffset}px`,
            height: "1.2em",
          }}
          title={hl.memo ?? "Click to add memo"}
        />
      ))}

      {/* Memo editor popup */}
      {activeHighlight && (
        <div className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64"
          style={{ top: "2rem", left: 0 }}
        >
          <textarea
            className="w-full text-sm border border-gray-200 rounded p-1 resize-none"
            rows={3}
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="Add a memo..."
          />
          <div className="flex justify-between mt-2">
            <button
              onClick={() => handleDelete(activeHighlight.id)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Delete
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => { setActiveHighlight(null); setMemoText(""); }}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMemo}
                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
