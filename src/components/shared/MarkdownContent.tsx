"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
  /** "sm" for chat, "base" for full-page doc viewer */
  size?: "sm" | "base";
}

export default function MarkdownContent({ content, size = "sm" }: Props) {
  const isBase = size === "base";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <h1 className={`font-bold mt-6 mb-2 ${isBase ? "text-2xl" : "text-lg mt-3 mb-1"}`}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className={`font-bold ${isBase ? "text-xl mt-5 mb-2 pb-1 border-b border-gray-200" : "text-base mt-2 mb-1"}`}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className={`font-bold ${isBase ? "text-base mt-4 mb-1" : "text-sm mt-2 mb-0.5"}`}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className={`leading-relaxed ${isBase ? "mb-3 text-[14px] text-gray-800" : "mb-2"}`}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className={`list-disc pl-5 space-y-1 ${isBase ? "mb-3 text-[14px] text-gray-800" : "mb-2"}`}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={`list-decimal pl-5 space-y-1 ${isBase ? "mb-3 text-[14px] text-gray-800" : "mb-2"}`}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          return <code className={className || ""} {...props}>{children}</code>;
        },
        pre: ({ children }) => (
          <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 my-3 overflow-x-auto text-xs font-mono leading-relaxed">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className={`border-l-4 border-blue-200 bg-blue-50/50 pl-4 pr-2 py-1 my-3 text-gray-600 ${isBase ? "text-sm" : "text-xs"}`}>
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className={`min-w-full border-collapse ${isBase ? "text-sm" : "text-xs"}`}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-bold text-gray-900">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 px-3 py-2">{children}</td>
        ),
        hr: () => <hr className="my-4 border-gray-200" />,
        strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
