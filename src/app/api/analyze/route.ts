import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/provider";
import { buildSkillPrompt } from "@/lib/ai/skills";
import { getPaperDir } from "@/lib/papers";
import path from "path";

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { paperId } = await request.json();
  const paper = await prisma.paper.findUnique({ where: { id: paperId } });

  if (!paper) {
    return new Response(JSON.stringify({ error: "Paper not found" }), {
      status: 404,
    });
  }

  const paperDir = getPaperDir(paper.id);
  const paperSource = paper.url || paper.filePath;
  const provider = getAIProvider();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Phase 1: Skim
        console.log("[analyze] Starting analysis for paper:", paper.id);
        console.log("[analyze] Paper source:", paperSource);
        console.log("[analyze] Paper dir:", paperDir);

        controller.enqueue(
          encoder.encode(sseEncode({ phase: "skimming", message: "Skimming paper..." }))
        );

        const skimPrompt = buildSkillPrompt("skim", { paperSource });
        let skimResult = "";

        console.log("[analyze] Calling AI for skim...");
        for await (const chunk of provider.query({
          prompt: skimPrompt,
          cwd: paperDir,
        })) {
          console.log("[analyze] Skim chunk:", chunk.type, chunk.type === "text" ? chunk.content.slice(0, 100) : "");
          if (chunk.type === "text") {
            skimResult += chunk.content;
          }
          if (chunk.type === "error") {
            console.error("[analyze] Skim error:", chunk.message);
          }
        }
        console.log("[analyze] Skim result length:", skimResult.length);

        let topics: Array<{ name: string; description: string }>;
        try {
          const jsonMatch = skimResult.match(/\[[\s\S]*\]/);
          topics = JSON.parse(jsonMatch?.[0] || "[]");
        } catch {
          topics = [];
          controller.enqueue(
            encoder.encode(sseEncode({
              phase: "error",
              message: "Failed to parse skim results",
            }))
          );
          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(sseEncode({
            phase: "building",
            message: `Building background for ${topics.length} topics...`,
            topics: topics.map((t) => t.name),
          }))
        );

        // Phase 2: Build background (parallel)
        const bgDir = path.join(paperDir, "background");
        const buildPromises = topics.map(async (topic) => {
          const outputPath = path.join(bgDir, `${topic.name}.md`);
          const prompt = buildSkillPrompt("build-background", {
            topicName: topic.name,
            topicDescription: topic.description,
            paperSource,
            outputPath,
          });

          for await (const chunk of provider.query({
            prompt,
            cwd: paperDir,
          })) {
            if (chunk.type === "done") {
              controller.enqueue(
                encoder.encode(sseEncode({
                  phase: "building",
                  message: `Completed: ${topic.name}`,
                  completedTopic: topic.name,
                }))
              );
            }
          }
        });

        await Promise.all(buildPromises);

        // Phase 3: Deep read
        controller.enqueue(
          encoder.encode(sseEncode({ phase: "reading", message: "Deep reading paper..." }))
        );

        const deepReadPrompt = buildSkillPrompt("deep-read", {
          paperSource,
          backgroundDir: bgDir,
          outputPath: path.join(paperDir, "analysis.md"),
        });

        for await (const chunk of provider.query({
          prompt: deepReadPrompt,
          cwd: paperDir,
        })) {
          if (chunk.type === "text") {
            controller.enqueue(
              encoder.encode(sseEncode({ phase: "reading", message: chunk.content }))
            );
          }
        }

        controller.enqueue(
          encoder.encode(sseEncode({ phase: "complete", message: "Analysis complete" }))
        );
      } catch (error) {
        console.error("[analyze] Fatal error:", error);
        controller.enqueue(
          encoder.encode(sseEncode({
            phase: "error",
            message:
              error instanceof Error ? error.message : "Analysis failed",
          }))
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
