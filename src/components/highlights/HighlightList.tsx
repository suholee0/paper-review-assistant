"use client";

import { useState } from "react";
import type { HighlightData } from "@/types";

const COLOR_DOTS: Record<string, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  pink: "bg-pink-400",
};

const FILTER_OPTIONS = ["All", "yellow", "green", "blue", "pink"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

interface Props {
  highlights: HighlightData[];
  onNavigate: (page: number) => void;
}

export default function HighlightList({ highlights, onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [colorFilter, setColorFilter] = useState<FilterOption>("All");

  const filtered =
    colorFilter === "All"
      ? highlights
      : highlights.filter((h) => h.color === colorFilter);

  return (
    <div className="border-t bg-white">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span>{isOpen ? "▼" : "▲"} Highlights</span>
        <span className="ml-auto text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {highlights.length}
        </span>
      </button>

      {isOpen && (
        <div className="max-h-48 overflow-y-auto">
          {/* Color filter buttons */}
          <div className="flex gap-1 px-3 py-1 flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setColorFilter(opt)}
                className={`text-xs px-2 py-0.5 rounded border ${
                  colorFilter === opt
                    ? "bg-gray-700 text-white border-gray-700"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {opt === "All" ? (
                  "All"
                ) : (
                  <span className="flex items-center gap-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${COLOR_DOTS[opt]}`} />
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Highlight list items */}
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">No highlights.</p>
          ) : (
            <ul>
              {filtered.map((hl) => (
                <li key={hl.id}>
                  <button
                    onClick={() => onNavigate(hl.page)}
                    className="flex items-start gap-2 w-full px-3 py-1.5 text-left hover:bg-gray-50"
                  >
                    <span
                      className={`mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                        COLOR_DOTS[hl.color] ?? "bg-yellow-400"
                      }`}
                    />
                    <span className="text-xs text-gray-500 shrink-0">p.{hl.page}</span>
                    <span className="text-xs text-gray-700 truncate">
                      {hl.text || hl.memo || <span className="italic text-gray-400">No memo</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
