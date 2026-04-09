import fs from "fs";
import path from "path";

export const PAPERS_ROOT = path.join(process.cwd(), "papers");

export function createPaperDir(
  paperId: string,
  root: string = PAPERS_ROOT
): string {
  const dir = path.join(root, paperId);
  fs.mkdirSync(path.join(dir, "background"), { recursive: true });
  return dir;
}

export function getPaperDir(
  paperId: string,
  root: string = PAPERS_ROOT
): string {
  return path.join(root, paperId);
}

export function savePdf(
  paperId: string,
  buffer: Buffer,
  root: string = PAPERS_ROOT
): string {
  const dir = createPaperDir(paperId, root);
  const filePath = path.join(dir, "original.pdf");
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function paperHasAnalysis(
  paperId: string,
  root: string = PAPERS_ROOT
): boolean {
  const analysisPath = path.join(root, paperId, "analysis.md");
  return fs.existsSync(analysisPath);
}

export function listBackgroundTopics(
  paperId: string,
  root: string = PAPERS_ROOT
): string[] {
  const bgDir = path.join(root, paperId, "background");
  if (!fs.existsSync(bgDir)) return [];
  return fs
    .readdirSync(bgDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""));
}
