"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ReferenceInfo } from "@/lib/references";

interface Props {
  references: ReferenceInfo[];
  pinnedCitation?: { info: ReferenceInfo; x: number; y: number } | null;
  onDismiss?: () => void;
}

export default function CitationPopover({
  references,
  pinnedCitation,
  onDismiss,
}: Props) {
  const [tooltip, setTooltip] = useState<{
    info: ReferenceInfo;
    x: number;
    y: number;
  } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // ---- Hover tooltip (existing behaviour) ----

  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const text = target.textContent || "";
      const citationMatch = text.match(/^\[(\d+)\]$/);
      if (!citationMatch) {
        setTooltip(null);
        return;
      }
      const num = citationMatch[1];
      const ref = references.find((r) => r.number === num);
      if (ref) {
        setTooltip({ info: ref, x: e.clientX, y: e.clientY - 10 });
      }
    },
    [references]
  );

  const handleMouseOut = useCallback(() => {
    setTooltip(null);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [handleMouseOver, handleMouseOut]);

  // ---- Pinned panel dismiss handlers ----

  // Click outside to dismiss
  useEffect(() => {
    if (!pinnedCitation) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onDismiss?.();
      }
    };
    // Delay so the click that opened the panel doesn't immediately close it.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [pinnedCitation, onDismiss]);

  // ESC to dismiss
  useEffect(() => {
    if (!pinnedCitation) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pinnedCitation, onDismiss]);

  return (
    <>
      {/* Hover tooltip — hidden while a pinned panel is open */}
      {tooltip && !pinnedCitation && (
        <div
          className="fixed z-50 bg-white shadow-lg border rounded-lg p-3 max-w-sm pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-xs text-gray-500 mb-1">
            [{tooltip.info.number}]
          </div>
          <div className="text-sm font-medium">{tooltip.info.title}</div>
          <div className="text-xs text-gray-600 mt-1">
            {tooltip.info.authors} ({tooltip.info.year})
          </div>
        </div>
      )}

      {/* Pinned citation panel */}
      {pinnedCitation && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-white shadow-xl border border-gray-200 rounded-lg p-4 max-w-sm"
          style={{
            left: Math.min(
              pinnedCitation.x + 16,
              typeof window !== "undefined" ? window.innerWidth - 380 : pinnedCitation.x
            ),
            top: Math.max(pinnedCitation.y - 20, 10),
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              [{pinnedCitation.info.number}]
            </span>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-3"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          {pinnedCitation.info.title && (
            <div className="text-sm font-medium mb-1">
              {pinnedCitation.info.title}
            </div>
          )}
          <div className="text-xs text-gray-600">
            {pinnedCitation.info.authors}
            {pinnedCitation.info.year && ` (${pinnedCitation.info.year})`}
          </div>
        </div>
      )}
    </>
  );
}
