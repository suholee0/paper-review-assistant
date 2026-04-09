import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { paperId, page, startOffset, endOffset, color, memo } = body;

  const highlight = await prisma.highlight.create({
    data: {
      paperId,
      page,
      startOffset,
      endOffset,
      color: color ?? "yellow",
      memo: memo ?? null,
    },
  });

  return NextResponse.json(highlight, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get("paperId");

  const highlights = await prisma.highlight.findMany({
    where: paperId ? { paperId } : undefined,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(highlights);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, memo, color } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (memo !== undefined) data.memo = memo;
  if (color !== undefined) data.color = color;

  const highlight = await prisma.highlight.update({
    where: { id },
    data,
  });

  return NextResponse.json(highlight);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.highlight.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
