"use client";

import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import HighlightLayer from "./HighlightLayer";
import CitationPopover from "./CitationPopover";
import type { HighlightData, HighlightRect } from "@/types";
import { extractReferences } from "@/lib/references";
import type { ReferenceInfo } from "@/lib/references";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  onTextSelect?: (text: string, page: number) => void;
  highlights?: HighlightData[];
  goToPage?: number | null;
  onAddHighlight?: (hl: {
    page: number;
    rects: HighlightRect[];
    text: string;
    color: string;
  }) => void;
  onDeleteHighlight?: (id: string) => void;
  onUpdateMemo?: (id: string, memo: string) => void;
}

export default function PdfViewer({
  fileUrl,
  onTextSelect,
  highlights = [],
  goToPage,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateMemo,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [references, setReferences] = useState<ReferenceInfo[]>([]);

  useEffect(() => {
    if (goToPage != null && goToPage >= 1 && goToPage <= numPages) {
      setCurrentPage(goToPage);
    }
  }, [goToPage, numPages]);

  useEffect(() => {
    if (!fileUrl) return;
    pdfjs.getDocument(fileUrl).promise.then(async (pdf) => {
      // Cast to the minimal interface expected by extractReferences
      const refs = await extractReferences(pdf as Parameters<typeof extractReferences>[0]);
      setReferences(refs);
    }).catch(() => {});
  }, [fileUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onTextSelect?.(selection.toString().trim(), currentPage);
    }
  }, [currentPage, onTextSelect]);

  const showHighlightLayer = onAddHighlight || onDeleteHighlight || onUpdateMemo;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 shrink-0">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="px-2 py-1 text-sm border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-sm">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="px-2 py-1 text-sm border rounded disabled:opacity-50"
        >
          Next
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          className="px-2 py-1 text-sm border rounded"
        >
          -
        </button>
        <span className="text-sm">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.1))}
          className="px-2 py-1 text-sm border rounded"
        >
          +
        </button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-200 p-4" onMouseUp={handleMouseUp}>
        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
          <div className="relative">
            <Page pageNumber={currentPage} scale={scale} />
            {showHighlightLayer && (
              <HighlightLayer
                page={currentPage}
                highlights={highlights}
                onAddHighlight={(hl) => onAddHighlight?.(hl)}
                onDeleteHighlight={(id) => onDeleteHighlight?.(id)}
                onUpdateMemo={(id, memo) => onUpdateMemo?.(id, memo)}
              />
            )}
          </div>
        </Document>
      </div>

      <CitationPopover references={references} />
    </div>
  );
}
