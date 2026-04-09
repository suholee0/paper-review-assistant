"use client";

import { useState } from "react";
import type { AnalysisProgress } from "@/types";

interface Props {
  paperId: string;
  onComplete: () => void;
}

export default function AnalysisStatus({ paperId, onComplete }: Props) {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  function startAnalysis() {
    setIsRunning(true);
    setCompletedTopics([]);

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId }),
    }).then(async (response) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              setProgress(data);

              if (data.completedTopic) {
                setCompletedTopics((prev) => [...prev, data.completedTopic]);
              }

              if (data.phase === "complete") {
                setIsRunning(false);
                onComplete();
              }

              if (data.phase === "error") {
                setIsRunning(false);
              }
            } catch {
              // skip malformed messages
            }
          }
        }
      }
    }).catch(() => {
      setIsRunning(false);
    });
  }

  const phaseLabels: Record<string, string> = {
    skimming: "Skimming paper...",
    building: "Building background knowledge...",
    reading: "Deep reading...",
    complete: "Analysis complete",
    error: "Error",
  };

  return (
    <div className="p-3 border-b bg-gray-50">
      {!isRunning && !progress?.phase ? (
        <button
          onClick={startAnalysis}
          className="bg-blue-600 text-white text-sm rounded px-3 py-1.5"
        >
          Start Analysis
        </button>
      ) : (
        <div className="text-sm">
          <div className="font-medium">
            {progress ? phaseLabels[progress.phase] || progress.message : ""}
          </div>
          {progress?.topics && (
            <div className="mt-1 flex flex-wrap gap-1">
              {progress.topics.map((topic) => (
                <span
                  key={topic}
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    completedTopics.includes(topic)
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
