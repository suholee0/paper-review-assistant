/** Opt-in live SDK check. Uses temporary fixtures, never an existing paper. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CodexProvider } from "../src/lib/ai/codex";
import type { AIQueryOptions } from "../src/lib/ai/provider";

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "paper-codex-smoke-"));
  const provider = new CodexProvider();
  const marker = `CODEX_SMOKE_${randomUUID()}`;
  const analysisPath = path.join(directory, "analysis.md");
  await fs.writeFile(analysisPath, `# Test paper\n\n${marker}\n`);
  const run = async (options: AIQueryOptions) => {
    let text = "";
    let sessionId = "";
    for await (const event of provider.query({ cwd: directory, ...options })) {
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "text") text += event.content;
      if (event.type === "done") sessionId = event.sessionId;
    }
    if (!sessionId) throw new Error("Missing completion event");
    return { text, sessionId };
  };
  try {
    const first = await run({ prompt: "Read analysis.md. Reply with only the CODEX_SMOKE_ marker found inside it, verbatim.", access: "read-only" });
    if (!first.text.includes(marker)) throw new Error("Local file read check failed");
    console.log("PASS: Codex authentication, local file read, SSE adapter completion");
    const second = await run({ prompt: "Without using tools or reading files, repeat the exact marker from your previous response.", sessionId: first.sessionId, access: "read-only" });
    if (!second.text.includes(marker) || second.sessionId !== first.sessionId) throw new Error("Thread resumption check failed");
    console.log("PASS: persisted Codex thread resumption");
    await run({ prompt: "Update only analysis.md: preserve its existing text and append a section headed '## Discussion Notes' with the text 'Runtime write verified.' Save the file.", access: "workspace-write" });
    const updated = await fs.readFile(analysisPath, "utf8");
    if (!updated.includes(marker) || !updated.includes("Runtime write verified.")) throw new Error("Analysis update check failed");
    console.log("PASS: analysis update with existing content preserved");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
