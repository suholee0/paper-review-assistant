"use client";

import { useState, useCallback } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import DragContext from "./DragContext";
import type { ChatMessage } from "@/types";
import { AVAILABLE_MODELS, DEFAULT_CHAT_MODEL, type ChatModelId } from "@/constants/models";

interface Props {
  paperId: string;
  selectedText: string | null;
  onClearSelection: () => void;
}

export default function ChatPanel({ paperId, selectedText, onClearSelection }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);

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
      setToolActivity(null);
      onClearSelection();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperId,
            message,
            context: selectedText || undefined,
            model,
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
                  // Clear tool activity once text starts streaming
                  setToolActivity(null);
                } else if (data.type === "tool_use") {
                  setToolActivity(data.summary);
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
        setToolActivity(null);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: Failed to get response.", timestamp: new Date() },
        ]);
      } finally {
        setIsLoading(false);
        setToolActivity(null);
      }
    },
    [paperId, selectedText, onClearSelection, model]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="font-medium text-sm">Chat</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ChatModelId)}
          disabled={isLoading}
          className="text-xs border rounded px-2 py-1 bg-white text-gray-700 disabled:opacity-50"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isLoading={isLoading}
        toolActivity={toolActivity}
      />
      {selectedText && (
        <DragContext text={selectedText} onClear={onClearSelection} />
      )}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
