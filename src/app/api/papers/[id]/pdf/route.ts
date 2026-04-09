import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const paper = await prisma.paper.findUnique({ where: { id } });

  if (!paper || !paper.filePath || !fs.existsSync(paper.filePath)) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(paper.filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="paper.pdf"`,
    },
  });
}
