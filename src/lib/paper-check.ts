import fs from "node:fs";
import path from "node:path";

/** Structural checks only: the agent must still verify coverage and correctness. */
export function checkPaper(paperDir: string, backgroundsOnly = false) {
  const issues: string[] = [];
  const read = (relative: string): string => {
    try {
      const content = fs.readFileSync(path.join(paperDir, relative), "utf8").trim();
      if (!content) issues.push(`Empty file: ${relative}`);
      return content;
    } catch {
      issues.push(`Cannot read: ${relative}`);
      return "";
    }
  };
  let topics: unknown;
  try {
    topics = JSON.parse(read("topics.json"));
  } catch {
    issues.push("topics.json must contain valid JSON.");
  }
  const names = new Set<string>();
  if (!Array.isArray(topics)) {
    issues.push("topics.json must be an array.");
  } else {
    for (const topic of topics) {
      if (!topic || typeof topic.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.name)) {
        issues.push("Each topic needs a safe lowercase filename slug.");
        continue;
      }
      if (names.has(topic.name)) issues.push(`Duplicate topic: ${topic.name}`);
      names.add(topic.name);
      if (typeof topic.description !== "string" || !topic.description.trim()) {
        issues.push(`Missing description: ${topic.name}`);
      }
      const relative = `background/${topic.name}.md`;
      const document = read(relative);
      if (document && !/\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(document)) {
        issues.push(`No source link: ${relative}`);
      }
    }
  }
  if (!backgroundsOnly) {
    const analysis = read("analysis.md");
    for (const heading of ["Summary", "Section-by-section analysis", "Key takeaways", "Open questions"]) {
      if (!new RegExp(`^##\\s+${heading}\\s*$`, "mi").test(analysis)) {
        issues.push(`Missing analysis heading: ${heading}`);
      }
    }
  }
  return { ok: issues.length === 0, topics: names.size, issues };
}
