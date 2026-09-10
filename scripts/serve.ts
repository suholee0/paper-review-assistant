#!/usr/bin/env node
/** Start a local viewer; opening a GUI browser is explicitly opt-in. */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const openBrowser = args.includes("--open");
const positional = args.filter((arg) => arg !== "--open");
const paperId = positional[0];
const port = Number(process.env.PORT || "3000");
if (positional.length > 1 || (paperId && !/^[0-9a-f-]{36}$/i.test(paperId)) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Usage: node --import tsx scripts/serve.ts [paper-id] [--open]; PORT must be 1–65535.");
  process.exit(1);
}
const url = `http://localhost:${port}${paperId ? `/paper/${encodeURIComponent(paperId)}` : ""}`;
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "-p", String(port)], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
});
let stopping = false;
let checking = false;
let announced = false;
let output = "";
const startupTimeout = setTimeout(() => {
  console.error("Web server did not become ready within 120 seconds.");
  stop(1);
}, 120_000);

function stop(code: number) {
  if (stopping) return;
  stopping = true;
  clearTimeout(startupTimeout);
  process.exitCode = code;
  server.kill("SIGTERM");
  const force = setTimeout(() => server.kill("SIGKILL"), 5_000);
  force.unref();
}

async function ready() {
  if (checking || stopping) return;
  checking = true;
  try {
    const response = await fetch(url.replace("localhost", "127.0.0.1"), { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Viewer returned HTTP ${response.status}: ${url}`);
    await response.body?.cancel();
    if (stopping) return;
    clearTimeout(startupTimeout);
    announced = true;
    console.log(`\nWEB UI READY: ${url}`);
    if (openBrowser) {
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open";
      const browserArgs = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
      const browser = spawn(command, browserArgs, { stdio: "ignore" });
      browser.on("error", () => console.log(`Open manually: ${url}`));
      browser.on("exit", (code) => { if (code) console.log(`Open manually: ${url}`); });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    stop(1);
  }
}

function onOutput(chunk: Buffer, stream: NodeJS.WriteStream) {
  stream.write(chunk);
  output = (output + chunk.toString()).slice(-4_000);
  // Next.js emits this after listening, before the first route compilation.
  if (/Ready in/.test(output)) void ready();
}
server.stdout.on("data", (chunk: Buffer) => onOutput(chunk, process.stdout));
server.stderr.on("data", (chunk: Buffer) => onOutput(chunk, process.stderr));
server.on("error", (error) => {
  clearTimeout(startupTimeout);
  console.error(error.message);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => {
  clearTimeout(startupTimeout);
  if (!stopping) {
    if (!announced) console.error("Web server exited before the viewer was ready. Check the startup log and local port permissions.");
    process.exitCode = !announced ? 1 : (code ?? (signal ? 1 : 0));
  }
});
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
