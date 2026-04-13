"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import HighlightLayer from "./HighlightLayer";
import CitationPopover from "./CitationPopover";
import type { HighlightData, HighlightRect, HighlightColor } from "@/types";
import { extractReferences } from "@/lib/references";
import type { ReferenceInfo } from "@/lib/references";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Filter out harmless AbortException warnings that pdfjs logs directly
// to the console when text/annotation layer tasks are cancelled during
// rapid scale changes.
if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  const originalError = console.error;
  const shouldSuppress = (args: unknown[]): boolean => {
    const first = args[0];
    if (typeof first === "string" && first.includes("AbortException")) return true;
    if (first && typeof first === "object" && "name" in first && (first as { name?: string }).name === "AbortException") return true;
    return false;
  };
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalWarn.apply(console, args);
  };
  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalError.apply(console, args);
  };
}

const PDF_SCALE_INITIAL = 1.2;
const PDF_SCALE_MIN = 0.5;
const PDF_SCALE_MAX = 3;
const PDF_SCALE_STEP = 0.1;
const SCALE_DEBOUNCE_MS = 150;

// Silently ignore expected cancellations from pdfjs when scale changes rapidly.
// These are not errors — pdfjs throws AbortException when an in-progress
// text layer render is cancelled in favor of a newer one.
function isPdfAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return e.name === "AbortException" || (e.message?.includes("TextLayer task cancelled") ?? false);
}

function handlePdfLayerError(err: unknown): void {
  if (!isPdfAbortError(err)) {
    console.error("[pdf] Layer render error:", err);
  }
}

/**
 * Find the citation number (e.g. "1" from "[1]") associated with an
 * annotation-layer link that was clicked.  We try two strategies:
 *
 * 1. The link element's own textContent (some PDFs render text inside the <a>).
 * 2. Concatenating the textContent of all text-layer <span>s whose bounding
 *    rects overlap with the link's bounding rect.
 */
function findCitationNumber(link: HTMLAnchorElement): string | null {
  // Strategy 1 — link text
  const linkText = link.textContent?.trim() || "";
  const m1 = linkText.match(/\[?(\d+)\]?/);
  if (m1) return m1[1];

  // Strategy 2 — overlapping text-layer spans
  const rect = link.getBoundingClientRect();
  const pageWrapper = link.closest("[data-page]");
  if (!pageWrapper) return null;

  let combined = "";
  const spans = pageWrapper.querySelectorAll(
    ".react-pdf__Page__textContent span"
  );
  for (const span of spans) {
    const sr = span.getBoundingClientRect();
    if (
      sr.right > rect.left &&
      sr.left < rect.right &&
      sr.bottom > rect.top &&
      sr.top < rect.bottom
    ) {
      combined += span.textContent || "";
    }
  }

  const m2 = combined.match(/\[(\d+)\]/);
  if (m2) return m2[1];

  const m3 = combined.trim().match(/^(\d+)$/);
  if (m3) return m3[1];

  return null;
}

interface PdfViewerProps {
  fileUrl: string;
  onTextSelect?: (text: string, page: number) => void;
  highlights?: HighlightData[];
  goToPage?: number | null;
  onAddHighlight?: (hl: {
    page: number;
    rects: HighlightRect[];
    text: string;
    color: HighlightColor;
  }) => void;
  onDeleteHighlight?: (id: string) => void;
  onUpdateMemo?: (id: string, memo: string) => void;
  onAskAI?: (text: string) => void;
}

export default function PdfViewer({
  fileUrl,
  onTextSelect,
  highlights = [],
  goToPage,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateMemo,
  onAskAI,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scaleInput, setScaleInput] = useState<number>(PDF_SCALE_INITIAL);
  const [scale, setScale] = useState<number>(PDF_SCALE_INITIAL);
  const [references, setReferences] = useState<ReferenceInfo[]>([]);
  const [pinnedCitation, setPinnedCitation] = useState<{
    info: ReferenceInfo;
    x: number;
    y: number;
  } | null>(null);

  // Keep a ref so the capture-phase listener never goes stale.
  const refsRef = useRef<ReferenceInfo[]>([]);
  refsRef.current = references;

  // Debounce scale changes so rapid button clicks coalesce into a single render.
  useEffect(() => {
    if (scaleInput === scale) return;
    const timer = setTimeout(() => setScale(scaleInput), SCALE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [scaleInput, scale]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  // Track current page via IntersectionObserver
  useEffect(() => {
    if (numPages === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisiblePage = 0;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pageNum = Number(
              (entry.target as HTMLElement).dataset.page
            );
            if (!isNaN(pageNum)) {
              mostVisiblePage = pageNum;
            }
          }
        });

        if (mostVisiblePage > 0) {
          setCurrentPage(mostVisiblePage);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    pageRefsMap.current.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [numPages, scale]);

  // goToPage: scroll to that page
  useEffect(() => {
    if (goToPage != null && goToPage >= 1 && goToPage <= numPages) {
      const pageEl = pageRefsMap.current.get(goToPage);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [goToPage, numPages]);

  useEffect(() => {
    if (!fileUrl) return;
    pdfjs
      .getDocument(fileUrl)
      .promise.then(async (pdf) => {
        const refs = await extractReferences(
          pdf as Parameters<typeof extractReferences>[0]
        );
        setReferences(refs);
      })
      .catch(() => {});
  }, [fileUrl]);

  // Intercept clicks on annotation-layer internal links that correspond to
  // citations ([N]).  Instead of scrolling to the references page we show a
  // pinned panel with the reference info.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest(
        ".annotationLayer a"
      ) as HTMLAnchorElement | null;
      if (!link) return;

      // Let external links through.
      const href = link.getAttribute("href") || "";
      if (href.startsWith("http")) return;

      const citationNum = findCitationNumber(link);
      if (!citationNum) return;

      const ref = refsRef.current.find((r) => r.number === citationNum);
      if (!ref) return;

      e.preventDefault();
      e.stopPropagation();

      setPinnedCitation({ info: ref, x: e.clientX, y: e.clientY });
    };

    // Capture phase so we fire before pdfjs's own link handler.
    container.addEventListener("click", handler, true);
    return () => container.removeEventListener("click", handler, true);
  }, []);

  const dismissPinnedCitation = useCallback(() => setPinnedCitation(null), []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;

    // Find which page the selection is on via data-page attribute
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;

    const anchorElement =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : anchorNode.parentElement;

    const pageWrapper = anchorElement?.closest("[data-page]");
    const pageNum = pageWrapper
      ? Number(pageWrapper.getAttribute("data-page"))
      : currentPage;

    onTextSelect?.(selection.toString().trim(), pageNum);
  }, [currentPage, onTextSelect]);

  const setPageRef = useCallback(
    (pageNumber: number, el: HTMLDivElement | null) => {
      if (el) {
        pageRefsMap.current.set(pageNumber, el);
      } else {
        pageRefsMap.current.delete(pageNumber);
      }
    },
    []
  );

  const showHighlightLayer =
    onAddHighlight || onDeleteHighlight || onUpdateMemo;

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 shrink-0">
        <span className="text-sm">
          {currentPage} / {numPages}
        </span>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          onClick={() => setScaleInput((s) => Math.max(PDF_SCALE_MIN, +(s - PDF_SCALE_STEP).toFixed(1)))}
          className="px-2 py-1 text-sm border rounded"
        >
          -
        </button>
        <span className="text-sm">{Math.round(scaleInput * 100)}%</span>
        <button
          onClick={() => setScaleInput((s) => Math.min(PDF_SCALE_MAX, +(s + PDF_SCALE_STEP).toFixed(1)))}
          className="px-2 py-1 text-sm border rounded"
        >
          +
        </button>
      </div>

      {/* PDF Content — continuous scroll */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-gray-200 p-4"
        onMouseUp={handleMouseUp}
      >
        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
          <div className="flex flex-col items-center gap-4">
            {pages.map((pageNumber) => (
              <div
                key={pageNumber}
                data-page={pageNumber}
                ref={(el) => setPageRef(pageNumber, el)}
                className="relative"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  onRenderTextLayerError={handlePdfLayerError}
                  onRenderAnnotationLayerError={handlePdfLayerError}
                  onRenderError={handlePdfLayerError}
                />
                {showHighlightLayer && (
                  <HighlightLayer
                    page={pageNumber}
                    highlights={highlights}
                    onAddHighlight={(hl) => onAddHighlight?.(hl)}
                    onDeleteHighlight={(id) => onDeleteHighlight?.(id)}
                    onUpdateMemo={(id, memo) => onUpdateMemo?.(id, memo)}
                    onAskAI={onAskAI}
                  />
                )}
              </div>
            ))}
          </div>
        </Document>
      </div>

      <CitationPopover
        references={references}
        pinnedCitation={pinnedCitation}
        onDismiss={dismissPinnedCitation}
      />
    </div>
  );
}
