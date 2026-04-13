"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/types";

interface Props {
  paperId: string;
  messages: ChatMessage[];
}

export default function ExportButton({ paperId, messages }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleExport = useCallback(async () => {
    if (messages.length === 0) return;
    setShowConfirm(false);
    setExporting(true);
    setProgress("분석 문서 보강 중...");
    setDone(false);

    try {
      const res = await fetch(`/api/papers/${paperId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            context: m.context,
          })),
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "tool_use") {
              setProgress(data.summary);
            } else if (data.type === "done") {
              setDone(true);
            } else if (data.type === "error") {
              setProgress(`오류: ${data.message}`);
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      setProgress("보강 실패");
    } finally {
      setExporting(false);
      setProgress(null);
      // Auto-dismiss success after 3s
      if (done) setTimeout(() => setDone(false), 3000);
    }
  }, [paperId, messages, done]);

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={exporting || messages.length === 0}
        title={messages.length === 0 ? "채팅 내역이 필요합니다" : "채팅 기반으로 분석 문서 보강"}
        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {exporting ? "보강 중..." : "분석 보강"}
      </button>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full">
            <p className="text-sm text-gray-800 font-medium mb-1">분석 문서 보강</p>
            <p className="text-xs text-gray-500 mb-4">
              지금까지의 대화 내용({messages.length}개 메시지)을 바탕으로
              분석 문서(analysis.md)를 보강합니다. 완료 후 &ldquo;분석&rdquo; 탭에서 확인할 수 있습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleExport}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                보강하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress overlay */}
      {exporting && progress && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-700">{progress}</span>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {done && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          분석 문서가 업데이트되었습니다. &ldquo;분석&rdquo; 탭에서 확인하세요.
        </div>
      )}
    </>
  );
}
