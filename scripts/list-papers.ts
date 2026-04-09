#!/usr/bin/env npx tsx
/**
 * List all registered papers.
 *
 * Usage:
 *   npx tsx scripts/list-papers.ts
 *
 * Output: JSON array of papers with analysis status.
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const papers = await prisma.paper.findMany({ orderBy: { createdAt: "desc" } });

  const result = papers.map((p) => {
    const paperDir = path.join(process.cwd(), "papers", p.id);
    const hasAnalysis = fs.existsSync(path.join(paperDir, "analysis.md"));
    const bgDir = path.join(paperDir, "background");
    const bgTopics = fs.existsSync(bgDir)
      ? fs.readdirSync(bgDir).filter((f) => f.endsWith(".md"))
      : [];

    return {
      id: p.id,
      title: p.title,
      url: p.url,
      analyzed: hasAnalysis,
      backgroundTopics: bgTopics.length,
      createdAt: p.createdAt,
    };
  });

  await prisma.$disconnect();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
