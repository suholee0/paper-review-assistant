#!/usr/bin/env npx tsx
/**
 * Start the web UI and open a paper in the browser.
 *
 * Usage:
 *   npx tsx scripts/serve.ts [paper-id]
 *
 * If paper-id is given, opens that paper directly.
 * If omitted, opens the landing page.
 */

import { execSync, spawn } from "child_process";

const paperId = process.argv[2];
const port = process.env.PORT || "3000";
const url = paperId
  ? `http://localhost:${port}/paper/${paperId}`
  : `http://localhost:${port}`;

console.log(`Starting web server on port ${port}...`);

const next = spawn("npx", ["next", "dev", "-p", port], {
  cwd: process.cwd(),
  stdio: "inherit",
});

// Wait for server to start, then open browser
setTimeout(() => {
  console.log(`Opening ${url}`);
  try {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {
    console.log(`Open manually: ${url}`);
  }
}, 3000);

process.on("SIGINT", () => {
  next.kill();
  process.exit(0);
});
