import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { getPaperDir } from "@/lib/papers";
import { sseEncode } from "@/lib/sse";
import fs from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { messages } = body as {
    messages: { role: string; content: string; context?: string }[];
  };

  const paper = await prisma.paper.findUnique({ where: { id } });
  if (!paper) {
    return new Response(JSON.stringify({ error: "Paper not found" }), {
      status: 404,
    });
  }

  const paperDir = getPaperDir(paper.id);
  const analysisPath = path.join(paperDir, "analysis.md");

  if (!fs.existsSync(analysisPath)) {
    return new Response(
      JSON.stringify({ error: "No analysis.md found. Run read-together first." }),
      { status: 400 }
    );
  }

  const currentAnalysis = fs.readFileSync(analysisPath, "utf-8");

  // Format chat history for the prompt
  const chatLog = messages
    .map((m) => {
      let line = `**${m.role === "user" ? "사용자" : "AI"}**: ${m.content}`;
      if (m.context) line = `> 선택 텍스트: "${m.context}"\n${line}`;
      return line;
    })
    .join("\n\n");

  const prompt = `당신은 논문 분석 문서를 보강하는 전문가입니다.

## 작업

기존 분석 문서(analysis.md)를 사용자와의 채팅 내용을 바탕으로 보강하세요.

## 기존 분석 문서

\`\`\`markdown
${currentAnalysis}
\`\`\`

## 채팅 기록

${chatLog}

## 보강 규칙

1. 기존 분석 문서의 구조와 내용을 **유지**하세요
2. 채팅에서 나온 새로운 인사이트를 기존 섹션에 자연스럽게 통합하세요
3. 문서 끝에 **## Discussion Notes** 섹션을 추가하세요:
   - 채팅에서 나온 핵심 Q&A를 정리
   - 사용자가 특히 관심 가진 토픽 요약
4. 한국어로 작성하세요
5. 보강된 전체 문서를 ${analysisPath} 에 저장하세요

보강을 시작하세요.`;

  const provider = getAIProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.query({
          prompt,
          cwd: paperDir,
        })) {
          if (chunk.type === "text") {
            controller.enqueue(
              encoder.encode(sseEncode({ type: "text", content: chunk.content }))
            );
          }
          if (chunk.type === "tool_use") {
            controller.enqueue(
              encoder.encode(
                sseEncode({ type: "tool_use", name: chunk.name, summary: chunk.summary })
              )
            );
          }
          if (chunk.type === "done") {
            // Read the updated analysis.md
            const updated = fs.existsSync(analysisPath)
              ? fs.readFileSync(analysisPath, "utf-8")
              : "";
            controller.enqueue(
              encoder.encode(sseEncode({ type: "done", content: updated }))
            );
          }
          if (chunk.type === "error") {
            controller.enqueue(
              encoder.encode(sseEncode({ type: "error", message: chunk.message }))
            );
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: "error",
              message: error instanceof Error ? error.message : "Export failed",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
