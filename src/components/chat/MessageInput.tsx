"use client";

import { useState, type KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="p-3 border-t">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the paper..."
          disabled={disabled}
          rows={2}
          className="flex-1 border rounded px-3 py-2 text-sm resize-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="bg-blue-600 text-white text-sm rounded px-4 disabled:opacity-50 self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}
