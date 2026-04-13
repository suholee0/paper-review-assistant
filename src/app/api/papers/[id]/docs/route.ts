import { NextRequest, NextResponse } from "next/server";
import { getPaperDir } from "@/lib/papers";
import fs from "fs";
import path from "path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  // Prevent path traversal
  const normalized = path.normalize(filePath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const paperDir = getPaperDir(id);
  const fullPath = path.join(paperDir, normalized);

  if (!fullPath.startsWith(paperDir)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  return NextResponse.json({ content });
}
