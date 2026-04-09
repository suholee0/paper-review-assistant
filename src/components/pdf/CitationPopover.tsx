"use client";

import { useState, useEffect, useCallback } from "react";

interface CitationInfo {
  number: string;
  title: string;
  authors: string;
  year: string;
}

interface Props {
  references: CitationInfo[];
}

export default function CitationPopover({ references }: Props) {
  const [tooltip, setTooltip] = useState<{
    info: CitationInfo;
    x: number;
    y: number;
  } | null>(null);

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

  if (!tooltip) return null;

  return (
    <div
      className="fixed z-50 bg-white shadow-lg border rounded-lg p-3 max-w-sm pointer-events-none"
      style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
    >
      <div className="text-xs text-gray-500 mb-1">[{tooltip.info.number}]</div>
      <div className="text-sm font-medium">{tooltip.info.title}</div>
      <div className="text-xs text-gray-600 mt-1">
        {tooltip.info.authors} ({tooltip.info.year})
      </div>
    </div>
  );
}
