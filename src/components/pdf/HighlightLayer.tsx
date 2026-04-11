"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { HighlightData, HighlightRect, HighlightColor } from "@/types";
import {
  HIGHLIGHT_COLORS,
  COLOR_MAP,
  COLOR_SWATCHES,
} from "@/constants/highlight";

// Floating toolbar positioning (percentage within page container)
const TOOLBAR_MAX_TOP = 92;
const TOOLBAR_MIN_LEFT = 2;
const TOOLBAR_MAX_LEFT = 65;
const TOOLBAR_OFFSET_TOP = 1;
const TOOLBAR_OFFSET_LEFT = 10;

interface Props {
  page: number;
  highlights: HighlightData[];
  onAddHighlight: (hl: { page: number; rects: HighlightRect[]; text: string; color: HighlightColor }) => void;
  onDeleteHighlight: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onAskAI?: (text: string) => void;
}

interface FloatingToolbarState {
  visible: boolean;
  top: number;
  left: number;
}

export default function HighlightLayer({
  page,
  highlights,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateMemo,
  onAskAI,
}: Props) {
  const [activeHighlight, setActiveHighlight] = useState<HighlightData | null>(null);
  const [memoText, setMemoText] = useState<string>("");
  const [showMemoInput, setShowMemoInput] = useState(false);
  const [toolbar, setToolbar] = useState<FloatingToolbarState>({ visible: false, top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const pageHighlights = highlights.filter((h) => h.page === page);

  // Find the sibling .react-pdf__Page element for coordinate calculation
  const getPageElement = useCallback((): Element | null => {
    return containerRef.current?.parentElement?.querySelector(".react-pdf__Page") ?? null;
  }, []);

  // Show floating toolbar on text selection via document mouseup
  useEffect(() => {
    function onMouseUp() {
      // Delay to let browser finalize selection
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

        const container = containerRef.current;
        const pageEl = getPageElement();
        if (!container || !pageEl) return;

        // Check that the selection is within this page's wrapper
        const range = selection.getRangeAt(0);
        const pageWrapper = container.parentElement;
        if (!pageWrapper || !pageWrapper.contains(range.commonAncestorContainer)) return;

        const clientRects = range.getClientRects();
        if (clientRects.length === 0) return;

        const lastRect = clientRects[clientRects.length - 1];
        const pageBounds = pageEl.getBoundingClientRect();

        const top = ((lastRect.bottom - pageBounds.top) / pageBounds.height) * 100;
        const left = ((lastRect.right - pageBounds.left) / pageBounds.width) * 100;

        setToolbar({
          visible: true,
          top: Math.min(top + TOOLBAR_OFFSET_TOP, TOOLBAR_MAX_TOP),
          left: Math.min(Math.max(left - TOOLBAR_OFFSET_LEFT, TOOLBAR_MIN_LEFT), TOOLBAR_MAX_LEFT),
        });
      });
    }

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [getPageElement]);

  // Hide toolbar when selection is cleared
  useEffect(() => {
    function onSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        // Don't hide if interacting with toolbar
        if (toolbarRef.current?.contains(document.activeElement)) return;
        setToolbar((prev) => ({ ...prev, visible: false }));
      }
    }

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function handleHighlightWithColor(color: HighlightColor) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const pageEl = getPageElement();
    if (!pageEl) return;
    const pageBounds = pageEl.getBoundingClientRect();

    const clientRects = range.getClientRects();
    const rects: HighlightRect[] = [];

    for (let i = 0; i < clientRects.length; i++) {
      const r = clientRects[i];
      rects.push({
        top: ((r.top - pageBounds.top) / pageBounds.height) * 100,
        left: ((r.left - pageBounds.left) / pageBounds.width) * 100,
        width: (r.width / pageBounds.width) * 100,
        height: (r.height / pageBounds.height) * 100,
      });
    }

    if (rects.length === 0) return;

    onAddHighlight({ page, rects, text: selectedText, color });
    selection.removeAllRanges();
    setToolbar({ visible: false, top: 0, left: 0 });
  }

  function handleAskAI() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (!selectedText || !onAskAI) return;

    onAskAI(selectedText);
    selection.removeAllRanges();
    setToolbar({ visible: false, top: 0, left: 0 });
  }

  function resetActiveHighlight() {
    setActiveHighlight(null);
    setMemoText("");
    setShowMemoInput(false);
  }

  function handleSaveMemo() {
    if (!activeHighlight) return;
    onUpdateMemo(activeHighlight.id, memoText);
    resetActiveHighlight();
  }

  function handleDelete(id: string) {
    onDeleteHighlight(id);
    resetActiveHighlight();
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
      {/* Floating action toolbar on text selection */}
      {toolbar.visible && (
        <div
          ref={toolbarRef}
          className="absolute z-30 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex items-center gap-1 pointer-events-auto"
          style={{ top: `${toolbar.top}%`, left: `${toolbar.left}%` }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleHighlightWithColor(color)}
              className={`w-6 h-6 rounded-full ${COLOR_SWATCHES[color]} hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-shadow`}
              title={`Highlight ${color}`}
            />
          ))}
          {onAskAI && (
            <>
              <div className="w-px h-5 bg-gray-300 mx-0.5" />
              <button
                onClick={handleAskAI}
                className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                title="Ask AI about this text"
              >
                Ask AI
              </button>
            </>
          )}
        </div>
      )}

      {/* Highlight overlays */}
      {pageHighlights.map((hl) =>
        hl.rects.map((rect, i) => (
          <div
            key={`${hl.id}-${i}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveHighlight((prev) => prev?.id === hl.id ? null : hl);
              setMemoText(hl.memo ?? "");
            }}
            className={`absolute pointer-events-auto cursor-pointer ${COLOR_MAP[hl.color] ?? "bg-yellow-200/50"}`}
            style={{
              top: `${rect.top}%`,
              left: `${rect.left}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`,
            }}
            title={hl.memo ?? hl.text ?? "Click for options"}
          />
        ))
      )}

      {/* Action popover on click */}
      {activeHighlight && activeHighlight.rects.length > 0 && (
        <div
          className="absolute z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2 pointer-events-auto"
          style={{
            top: `${activeHighlight.rects[0].top + activeHighlight.rects[0].height + 0.5}%`,
            left: `${activeHighlight.rects[0].left}%`,
          }}
        >
          {activeHighlight.text && (
            <p className="text-xs text-gray-500 mb-2 italic max-w-48 truncate">&ldquo;{activeHighlight.text}&rdquo;</p>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDelete(activeHighlight.id)}
              className="px-2 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => {/* keep popover open, show memo input */
                setShowMemoInput(true);
              }}
              className="px-2 py-1 text-xs text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              Memo
            </button>
            <button
              onClick={resetActiveHighlight}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
          {showMemoInput && (
            <div className="mt-2">
              <textarea
                className="w-full text-sm border border-gray-200 rounded p-1 resize-none"
                rows={2}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="Add a memo..."
              />
              <button
                onClick={() => { handleSaveMemo(); setShowMemoInput(false); }}
                className="mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
