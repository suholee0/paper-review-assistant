#!/usr/bin/env npx tsx

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────

function getPdfDownloadUrl(url: string): string | null {
  const arxivAbsMatch = url.match(/arxiv\.org\/abs\/(.+?)(?:\?|$)/);
  if (arxivAbsMatch) return `https://arxiv.org/pdf/${arxivAbsMatch[1]}`;
  if (url.endsWith(".pdf")) return url;
  if (url.includes("arxiv.org/pdf/")) return url;
  return null;
}

async function downloadPdf(url: string, dest: string): Promise<boolean> {
  const pdfUrl = getPdfDownloadUrl(url);
  if (!pdfUrl) return false;

  console.log(`📥 Downloading PDF from ${pdfUrl}...`);
  try {
    const res = await fetch(pdfUrl, {
      headers: { "User-Agent": "PaperReviewTool/1.0" },
      redirect: "follow",
    });
    if (!res.ok) {
      console.error(`   Download failed: ${res.status}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    console.log(`   Saved (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    return true;
  } catch (err) {
    console.error(`   Download error:`, err);
    return false;
  }
}

function loadSkill(name: string): string {
  const skillPath = path.join(process.cwd(), "skills", `${name}.md`);
  return fs.readFileSync(skillPath, "utf-8");
}

function buildPrompt(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.log("Usage: npm run open <arxiv-url or pdf-path>");
    console.log("  npm run open https://arxiv.org/abs/1706.03762");
    console.log('  npm run open ./my-paper.pdf');
    process.exit(1);
  }

  const isUrl = input.startsWith("http");
  const isFile = !isUrl && fs.existsSync(input);

  if (!isUrl && !isFile) {
    console.error(`Error: "${input}" is not a valid URL or file path.`);
    process.exit(1);
  }

  // 1. Create paper in DB
  const title = isFile
    ? path.basename(input, ".pdf")
    : input.split("/").pop() || "Untitled";

  console.log(`\n📄 Opening paper: ${title}`);

  const paper = await prisma.paper.create({
    data: {
      title,
      url: isUrl ? input : null,
      filePath: "",
    },
  });

  // 2. Create paper directory
  const paperDir = path.join(process.cwd(), "papers", paper.id);
  fs.mkdirSync(path.join(paperDir, "background"), { recursive: true });

  // 3. Get PDF
  let pdfPath = "";
  if (isFile) {
    pdfPath = path.join(paperDir, "original.pdf");
    fs.copyFileSync(input, pdfPath);
    console.log(`📋 Copied PDF to ${pdfPath}`);
  } else if (isUrl) {
    const dest = path.join(paperDir, "original.pdf");
    const ok = await downloadPdf(input, dest);
    if (ok) pdfPath = dest;
  }

  if (pdfPath) {
    await prisma.paper.update({
      where: { id: paper.id },
      data: { filePath: pdfPath },
    });
  }

  // 4. Build analysis prompt and save to file (avoids shell escaping issues)
  const paperSource = isUrl ? input : pdfPath;
  const template = loadSkill("analyze");
  const prompt = buildPrompt(template, { paperSource, paperDir });
  const promptFile = path.join(paperDir, ".prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  // 5. Find claude binary
  const claudePath = execSync("which claude", { encoding: "utf-8" }).trim();
  if (!claudePath) {
    console.error("Error: claude not found. Install with: npm install -g @anthropic-ai/claude-code");
    process.exit(1);
  }

  console.log(`\n🔬 Starting analysis in Claude Code...`);
  console.log(`   Paper dir: ${paperDir}`);
  console.log(`   You can see and interact with Claude below.\n`);
  console.log("─".repeat(60));

  // 6. Run Claude with prompt piped via stdin (no shell escaping needed)
  const claudeProcess = spawn(claudePath, ["-p", "--verbose"], {
    cwd: paperDir,
    stdio: ["pipe", "inherit", "inherit"], // stdin: pipe, stdout/stderr: terminal
  });

  // Pipe prompt via stdin
  claudeProcess.stdin!.write(prompt);
  claudeProcess.stdin!.end();

  await new Promise<void>((resolve, reject) => {
    claudeProcess.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Claude exited with code ${code}`));
    });
    claudeProcess.on("error", reject);
  });

  // Clean up prompt file
  fs.unlinkSync(promptFile);

  console.log("\n" + "─".repeat(60));
  console.log(`✅ Analysis complete!`);

  // 6. Check what was created
  const hasAnalysis = fs.existsSync(path.join(paperDir, "analysis.md"));
  const bgFiles = fs.existsSync(path.join(paperDir, "background"))
    ? fs.readdirSync(path.join(paperDir, "background")).filter((f) => f.endsWith(".md"))
    : [];

  console.log(`   Analysis: ${hasAnalysis ? "✓" : "✗"}`);
  console.log(`   Background docs: ${bgFiles.length}`);
  if (bgFiles.length > 0) {
    bgFiles.forEach((f) => console.log(`     - ${f}`));
  }

  // 7. Start web server and open browser
  console.log(`\n🌐 Starting web server...`);

  const webUrl = `http://localhost:3000/paper/${paper.id}`;

  const nextProcess = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });

  // Wait a bit for the server to start, then open browser
  setTimeout(() => {
    console.log(`\n📖 Opening ${webUrl}`);
    try {
      execSync(`open "${webUrl}"`, { stdio: "ignore" });
    } catch {
      console.log(`   Open manually: ${webUrl}`);
    }
  }, 3000);

  // Keep running until user kills it
  await new Promise<void>((resolve) => {
    nextProcess.on("close", resolve);
    process.on("SIGINT", () => {
      nextProcess.kill();
      resolve();
    });
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
