"use client";

import { useState, useCallback } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import DragContext from "./DragContext";
import type { ChatMessage } from "@/types";

interface Props {
  paperId: string;
  selectedText: string | null;
  onClearSelection: () => void;
}

export default function ChatPanel({ paperId, selectedText, onClearSelection }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(
    async (message: string) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        context: selectedText || undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");
      onClearSelection();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperId,
            message,
            context: selectedText || undefined,
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        let fullContent = "";
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
                if (data.type === "text") {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
              } catch {
                // skip malformed messages
              }
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullContent, timestamp: new Date() },
        ]);
        setStreamingContent("");
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Failed to get response.", timestamp: new Date() },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [paperId, selectedText, onClearSelection]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b font-medium text-sm">Chat</div>
      <MessageList messages={messages} streamingContent={streamingContent} />
      {selectedText && (
        <DragContext text={selectedText} onClear={onClearSelection} />
      )}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
