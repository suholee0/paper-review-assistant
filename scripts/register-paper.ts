#!/usr/bin/env npx tsx
/**
 * Register a paper: download PDF (if URL), create DB entry, create paper directory.
 *
 * Usage:
 *   npx tsx scripts/register-paper.ts <url-or-filepath> [title]
 *
 * Output (JSON):
 *   { "id": "...", "title": "...", "paperDir": "...", "pdfPath": "..." }
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getPdfDownloadUrl(url: string): string | null {
  const arxivAbsMatch = url.match(/arxiv\.org\/abs\/(.+?)(?:\?|$)/);
  if (arxivAbsMatch) return `https://arxiv.org/pdf/${arxivAbsMatch[1]}`;
  if (url.endsWith(".pdf")) return url;
  if (url.includes("arxiv.org/pdf/")) return url;
  return null;
}

async function main() {
  const input = process.argv[2];
  const titleArg = process.argv[3];

  if (!input) {
    console.error("Usage: npx tsx scripts/register-paper.ts <url-or-filepath> [title]");
    process.exit(1);
  }

  const isUrl = input.startsWith("http");
  const isFile = !isUrl && fs.existsSync(input);

  if (!isUrl && !isFile) {
    console.error(`Error: "${input}" is not a valid URL or file path.`);
    process.exit(1);
  }

  const title = titleArg || (isFile ? path.basename(input, ".pdf") : input.split("/").pop() || "Untitled");

  // Create DB entry
  const paper = await prisma.paper.create({
    data: { title, url: isUrl ? input : null, filePath: "" },
  });

  // Create paper directory
  const paperDir = path.join(process.cwd(), "papers", paper.id);
  fs.mkdirSync(path.join(paperDir, "background"), { recursive: true });

  // Get PDF
  let pdfPath = "";

  if (isFile) {
    pdfPath = path.join(paperDir, "original.pdf");
    fs.copyFileSync(input, pdfPath);
  } else if (isUrl) {
    const pdfUrl = getPdfDownloadUrl(input);
    if (pdfUrl) {
      const res = await fetch(pdfUrl, {
        headers: { "User-Agent": "PaperReviewTool/1.0" },
        redirect: "follow",
      });
      if (res.ok) {
        pdfPath = path.join(paperDir, "original.pdf");
        fs.writeFileSync(pdfPath, Buffer.from(await res.arrayBuffer()));
      }
    }
  }

  if (pdfPath) {
    await prisma.paper.update({ where: { id: paper.id }, data: { filePath: pdfPath } });
  }

  await prisma.$disconnect();

  // Output structured result
  const result = { id: paper.id, title, paperDir, pdfPath };
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
