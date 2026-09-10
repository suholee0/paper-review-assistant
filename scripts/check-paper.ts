#!/usr/bin/env node
import path from "node:path";
import { checkPaper } from "../src/lib/paper-check";

const [directory, flag, ...extra] = process.argv.slice(2);
if (!directory || (flag && flag !== "--backgrounds") || extra.length) {
  console.error("Usage: node --import tsx scripts/check-paper.ts <paperDir> [--backgrounds]");
  process.exitCode = 1;
} else {
  const result = checkPaper(path.resolve(directory), flag === "--backgrounds");
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
