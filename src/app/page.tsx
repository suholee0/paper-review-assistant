"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PaperItem {
  id: string;
  title: string;
  authors: string | null;
  publishedDate: string | null;
  url: string | null;
  createdAt: string;
  hasAnalysis: boolean;
}

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [papers, setPapers] = useState<PaperItem[]>([]);

  useEffect(() => {
    fetch("/api/papers")
      .then((r) => r.json())
      .then(setPapers)
      .catch(() => {});
  }, []);

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title: title || url }),
      });

      if (!res.ok) {
        alert("Failed to open paper. Please try again.");
        return;
      }

      const paper = await res.json();
      router.push(`/paper/${paper.id}`);
    } catch {
      alert("Failed to open paper. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(".pdf", ""));

    try {
      const res = await fetch("/api/papers", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        alert("Failed to upload file. Please try again.");
        return;
      }

      const paper = await res.json();
      router.push(`/paper/${paper.id}`);
    } catch {
      alert("Failed to upload file. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 gap-8">
      <h1 className="text-3xl font-bold mt-12">Paper Review Tool</h1>

      <form onSubmit={handleUrlSubmit} className="flex flex-col gap-3 w-full max-w-md">
        <input
          type="text"
          placeholder="Paper title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="url"
          placeholder="arXiv URL (e.g. https://arxiv.org/abs/1706.03762)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={!url || loading}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          Open from URL
        </button>
      </form>

      <div className="text-gray-400">or</div>

      <label className="cursor-pointer bg-gray-100 border-2 border-dashed rounded-lg px-8 py-6 text-center hover:bg-gray-50">
        <span className="text-gray-600">Upload PDF file</span>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={loading}
        />
      </label>

      {loading && <p className="text-gray-500">Opening paper...</p>}

      {papers.length > 0 && (
        <section className="w-full max-w-2xl mt-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">My Papers</h2>
          <ul className="divide-y border rounded-lg bg-white">
            {papers.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/paper/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {p.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {[
                        p.authors?.split(",")[0]?.trim(),
                        p.publishedDate,
                      ]
                        .filter(Boolean)
                        .join(" · ") || new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {p.hasAnalysis && (
                    <span className="ml-3 shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      analyzed
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
