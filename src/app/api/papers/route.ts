import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { savePdf, createPaperDir } from "@/lib/papers";

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

  return NextResponse.json(paper, { status: 201 });
}

export async function GET() {
  const papers = await prisma.paper.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(papers);
}
