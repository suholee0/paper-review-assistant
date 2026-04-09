import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { getPaperDir } from "@/lib/papers";

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { paperId, message, context } = await request.json();
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });

  if (!paper) {
    return new Response(JSON.stringify({ error: "Paper not found" }), { status: 404 });
  }

  const paperDir = getPaperDir(paper.id);
  const provider = getAIProvider();

  let prompt = "";

  if (!paper.chatSessionId) {
    const paperSource = paper.url || paper.filePath;
    prompt += `You are a knowledgeable research assistant helping a user understand a paper.\n\n`;
    prompt += `Paper: ${paperSource}\n`;
    prompt += `Background knowledge and analysis are in: ${paperDir}\n`;
    prompt += `Read the background/ directory and analysis.md if they exist to understand the paper deeply.\n\n`;
  }

  if (context) {
    prompt += `The user selected this text from the paper:\n> ${context}\n\n`;
  }

  prompt += `User question: ${message}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.query({
          prompt,
          sessionId: paper.chatSessionId || undefined,
          cwd: paperDir,
        })) {
          if (chunk.type === "text") {
            controller.enqueue(encoder.encode(sseEncode({ type: "text", content: chunk.content })));
          }
          if (chunk.type === "done" && chunk.sessionId) {
            if (!paper.chatSessionId) {
              await prisma.paper.update({
                where: { id: paper.id },
                data: { chatSessionId: chunk.sessionId },
              });
            }
            controller.enqueue(encoder.encode(sseEncode({ type: "done", sessionId: chunk.sessionId })));
          }
          if (chunk.type === "error") {
            controller.enqueue(encoder.encode(sseEncode({ type: "error", message: chunk.message })));
          }
        }
      } catch (error) {
        controller.enqueue(encoder.encode(sseEncode({
          type: "error",
          message: error instanceof Error ? error.message : "Chat failed",
        })));
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
