"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
  toolActivity?: string | null;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // Headings
        h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-0.5">{children}</h3>,
        // Paragraphs
        p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
        // Lists
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Code
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={`${className || ""}`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-gray-100 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">
            {children}
          </pre>
        ),
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-gray-300 pl-3 my-2 text-gray-600 italic">
            {children}
          </blockquote>
        ),
        // Links
        a: ({ href, children }) => (
          <a href={href} className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        // Table
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 px-2 py-1">{children}</td>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-gray-200" />,
        // Strong / emphasis
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
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
