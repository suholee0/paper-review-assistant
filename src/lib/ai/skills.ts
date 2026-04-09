import fs from "fs";
import path from "path";

const DEFAULT_SKILLS_DIR = path.join(process.cwd(), "skills");

export function loadSkill(
  name: string,
  skillsDir: string = DEFAULT_SKILLS_DIR
): string {
  const filePath = path.join(skillsDir, `${name}.md`);
  return fs.readFileSync(filePath, "utf-8");
}

export function buildPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function buildSkillPrompt(
  skillName: string,
  variables: Record<string, string>,
  skillsDir: string = DEFAULT_SKILLS_DIR
): string {
  const template = loadSkill(skillName, skillsDir);
  return buildPrompt(template, variables);
}
