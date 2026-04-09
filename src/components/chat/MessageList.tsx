"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  streamingContent: string;
}

export default function MessageList({ messages, streamingContent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-auto p-3 space-y-4">
      {messages.map((msg, i) => (
        <div key={i}>
          {msg.context && (
            <div className="mb-1 p-2 bg-blue-50 rounded text-xs text-gray-600 border-l-2 border-blue-300">
              &ldquo;{msg.context}&rdquo;
            </div>
          )}
          <div className={`text-sm ${msg.role === "user" ? "text-blue-900" : "text-gray-800"}`}>
            <span className="font-medium text-xs text-gray-500 block mb-0.5">
              {msg.role === "user" ? "You" : "AI"}
            </span>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        </div>
      ))}

      {streamingContent && (
        <div className="text-sm text-gray-800">
          <span className="font-medium text-xs text-gray-500 block mb-0.5">AI</span>
          <div className="whitespace-pre-wrap">{streamingContent}</div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
