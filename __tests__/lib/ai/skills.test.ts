import { describe, it, expect } from "vitest";
import { loadSkill, buildPrompt } from "@/lib/ai/skills";
import path from "path";

const SKILLS_DIR = path.join(process.cwd(), "skills");

describe("skills", () => {
  it("loads a skill file and returns its content", () => {
    const content = loadSkill("skim", SKILLS_DIR);
    expect(content).toContain("Skim");
  });

  it("builds prompt by replacing variables", () => {
    const template = "Analyze {{paperUrl}} and save to {{outputDir}}";
    const result = buildPrompt(template, {
      paperUrl: "https://arxiv.org/abs/1706.03762",
      outputDir: "/papers/abc/background",
    });

    expect(result).toBe(
      "Analyze https://arxiv.org/abs/1706.03762 and save to /papers/abc/background"
    );
  });
});
