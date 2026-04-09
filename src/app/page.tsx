"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title: title || url }),
    });

    const paper = await res.json();
    router.push(`/paper/${paper.id}`);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(".pdf", ""));

    const res = await fetch("/api/papers", {
      method: "POST",
      body: formData,
    });

    const paper = await res.json();
    router.push(`/paper/${paper.id}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <h1 className="text-3xl font-bold">Paper Review Tool</h1>

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
    </main>
  );
}
