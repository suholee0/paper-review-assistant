import { NextRequest, NextResponse } from "next/server";
import { paperHasAnalysis, listBackgroundTopics } from "@/lib/papers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const hasAnalysis = paperHasAnalysis(id);
  const topics = listBackgroundTopics(id);

  return NextResponse.json({
    analyzed: hasAnalysis,
    backgroundTopics: topics,
  });
}
