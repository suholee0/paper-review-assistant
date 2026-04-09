import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { savePdf, createPaperDir } from "@/lib/papers";

/**
 * Try to derive a PDF download URL from a paper URL.
 * Supports arXiv and direct PDF links.
 */
function getPdfDownloadUrl(url: string): string | null {
  // arXiv abstract page → PDF
  // https://arxiv.org/abs/1706.03762 → https://arxiv.org/pdf/1706.03762
  const arxivAbsMatch = url.match(/arxiv\.org\/abs\/(.+?)(?:\?|$)/);
  if (arxivAbsMatch) {
    return `https://arxiv.org/pdf/${arxivAbsMatch[1]}`;
  }

  // Already a direct PDF link
  if (url.endsWith(".pdf")) {
    return url;
  }

  // arXiv PDF page (already correct)
  if (url.includes("arxiv.org/pdf/")) {
    return url;
  }

  return null;
}

async function downloadPdf(url: string): Promise<Buffer | null> {
  const pdfUrl = getPdfDownloadUrl(url);
  if (!pdfUrl) return null;

  try {
    console.log("[papers] Downloading PDF from:", pdfUrl);
    const res = await fetch(pdfUrl, {
      headers: { "User-Agent": "PaperReviewTool/1.0" },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error("[papers] PDF download failed:", res.status);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[papers] PDF download error:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const paper = await prisma.paper.create({
      data: { title, filePath: "" },
    });

    const filePath = savePdf(paper.id, buffer);
    const updated = await prisma.paper.update({
      where: { id: paper.id },
      data: { filePath },
    });

    return NextResponse.json(updated, { status: 201 });
  }

  const body = await request.json();
  const { url, title } = body;

  if (!url && !title) {
    return NextResponse.json(
      { error: "URL or title required" },
      { status: 400 }
    );
  }

  const paper = await prisma.paper.create({
    data: {
      title: title || "Untitled",
      url: url || null,
      filePath: "",
    },
  });

  createPaperDir(paper.id);

  // Try to download PDF from URL
  if (url) {
    const pdfBuffer = await downloadPdf(url);
    if (pdfBuffer) {
      const filePath = savePdf(paper.id, pdfBuffer);
      const updated = await prisma.paper.update({
        where: { id: paper.id },
        data: { filePath },
      });
      return NextResponse.json(updated, { status: 201 });
    }
  }

  return NextResponse.json(paper, { status: 201 });
}

export async function GET() {
  const papers = await prisma.paper.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(papers);
}
