"use client";

import { useState, useEffect } from "react";

interface Props {
  paperId: string;
}

interface Status {
  analyzed: boolean;
  backgroundTopics: string[];
}

export default function AnalysisStatus({ paperId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch(`/api/papers/${paperId}/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
  }, [paperId]);

  if (!status) return null;

  if (!status.analyzed && status.backgroundTopics.length === 0) {
    return (
      <div className="p-3 border-b bg-amber-50 text-sm text-amber-800">
        아직 같이 읽기를 하지 않았습니다. Claude Code 터미널에서 같이 읽기를 시작하세요.
      </div>
    );
  }

  return (
    <div className="p-3 border-b bg-green-50 text-sm">
      <span className="text-green-700 font-medium">같이 읽기 완료</span>
      {status.backgroundTopics.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {status.backgroundTopics.map((topic) => (
            <span
              key={topic}
              className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
