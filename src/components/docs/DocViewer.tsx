"use client";

import { useState, useEffect } from "react";
import MarkdownContent from "@/components/shared/MarkdownContent";

interface Props {
  paperId: string;
  docPath: string;
}

export default function DocViewer({ paperId, docPath }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    setError(null);
    fetch(`/api/papers/${paperId}/docs?path=${encodeURIComponent(docPath)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => setContent(d.content))
      .catch(() => setError("문서를 불러올 수 없습니다."));
  }, [paperId, docPath]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        {error}
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-6">
        <MarkdownContent content={content} size="base" />
      </div>
    </div>
  );
}
