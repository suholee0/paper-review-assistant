"use client";

import { useEffect, useRef } from "react";
import MarkdownContent from "@/components/shared/MarkdownContent";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
  toolActivity?: string | null;
}

export default function MessageList({ messages, streamingContent, isLoading, toolActivity }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, toolActivity]);

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
            {msg.role === "user" ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <MarkdownContent content={msg.content} />
            )}
          </div>
        </div>
      ))}

      {streamingContent && (
        <div className="text-sm text-gray-800">
          <span className="font-medium text-xs text-gray-500 block mb-0.5">AI</span>
          <MarkdownContent content={streamingContent} />
        </div>
      )}

      {isLoading && !streamingContent && (
        <div className="text-sm text-gray-500">
          <span className="font-medium text-xs text-gray-500 block mb-1">AI</span>
          {toolActivity ? (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shrink-0" />
              <span className="truncate">{toolActivity}</span>
            </div>
          ) : (
            <div className="flex gap-1 ml-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
