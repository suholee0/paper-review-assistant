import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkPaper } from "@/lib/paper-check";

let directory: string;
const write = (name: string, content: string) => fs.writeFileSync(path.join(directory, name), content);

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "paper-check-"));
  fs.mkdirSync(path.join(directory, "background"));
  write("topics.json", JSON.stringify([{ name: "attention", description: "필요한 배경" }]));
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

describe("workflow artifact checks", () => {
  it("does not accept an analysis file when a delegated topic is missing", () => {
    write("analysis.md", "## Summary\n요약\n## Section-by-section analysis\n분석\n## Key takeaways\n핵심\n## Open questions\n질문");
    expect(checkPaper(directory).issues).toContain("Cannot read: background/attention.md");
  });

  it("allows background review before analysis but requires source links", () => {
    write("background/attention.md", "출처 없는 설명");
    expect(checkPaper(directory, true).ok).toBe(false);
    write("background/attention.md", "설명 [원 논문](https://arxiv.org/abs/1706.03762)");
    expect(checkPaper(directory, true).ok).toBe(true);
    expect(checkPaper(directory).ok).toBe(false);
  });

  it("rejects malformed topics, duplicate file ownership and unsafe paths", () => {
    write("topics.json", "{}");
    expect(checkPaper(directory, true).ok).toBe(false);
    write("topics.json", JSON.stringify([
      { name: "../outside", description: "invalid" },
      { name: "attention", description: "one" },
      { name: "attention", description: "two" },
    ]));
    const { issues } = checkPaper(directory, true);
    expect(issues).toContain("Each topic needs a safe lowercase filename slug.");
    expect(issues).toContain("Duplicate topic: attention");
    expect(issues.join(" ")).not.toContain("Cannot read: background/../outside");
  });

  it("accepts the complete document contract", () => {
    write("background/attention.md", "설명 [원 논문](https://arxiv.org/abs/1706.03762)");
    write("analysis.md", "## Summary\n요약\n## Section-by-section analysis\n분석\n## Key takeaways\n핵심\n## Open questions\n질문");
    expect(checkPaper(directory)).toEqual({ ok: true, topics: 1, issues: [] });
  });
});
