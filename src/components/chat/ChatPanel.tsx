"use client";

import { useState, useCallback, useEffect } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import DragContext from "./DragContext";
import ExportButton from "./ExportButton";
import type { ChatMessage } from "@/types";
import { AVAILABLE_MODELS, DEFAULT_CHAT_MODEL, type ChatModelId } from "@/constants/models";

interface Props {
  paperId: string;
  selectedText: string | null;
  onClearSelection: () => void;
}

export default function ChatPanel({ paperId, selectedText, onClearSelection }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Restore messages from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`chat:${paperId}`);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, [paperId]);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat:${paperId}`, JSON.stringify(messages));
    }
  }, [messages, paperId]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [bgTopics, setBgTopics] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/papers/${paperId}/status`)
      .then((r) => r.json())
      .then((s: { backgroundTopics?: string[] }) => setBgTopics(s.backgroundTopics || []))
      .catch(() => {});
  }, [paperId]);

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
        <div className="flex items-center gap-2">
        <span data-onboarding="export"><ExportButton paperId={paperId} messages={messages} /></span>
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
      </div>
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isLoading={isLoading}
        toolActivity={toolActivity}
      />

      {/* Preset buttons — show when chat is empty and no text selected */}
      {!isLoading && messages.length === 0 && !selectedText && (
        <div data-onboarding="presets" className="px-3 pb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {[
              "이 논문의 핵심을 요약해줘",
              "이 논문의 주요 contribution이 뭐야?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          {bgTopics.length > 0 && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">배경지식</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {bgTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleSend(`${topic.replace(/-/g, " ")}에 대해 설명해줘`)}
                    className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    {topic.replace(/-/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedText && (
        <>
          <DragContext text={selectedText} onClear={onClearSelection} />
          <div className="flex gap-2 px-3 pb-2">
            <button
              onClick={() => handleSend("이 부분 설명해줘")}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              이 부분 설명해줘
            </button>
          </div>
        </>
      )}
      {!selectedText && messages.length > 0 && null}

      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
