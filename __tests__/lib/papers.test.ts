import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createPaperDir, getPaperDir, PAPERS_ROOT } from "@/lib/papers";

const TEST_PAPERS_ROOT = path.join(process.cwd(), "test-papers");

describe("papers", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_PAPERS_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_PAPERS_ROOT, { recursive: true, force: true });
  });

  it("creates paper directory with background subfolder", () => {
    const paperId = "test-123";
    const dir = createPaperDir(paperId, TEST_PAPERS_ROOT);

    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, "background"))).toBe(true);
  });

  it("returns correct paper directory path", () => {
    const paperId = "test-456";
    const dir = getPaperDir(paperId, TEST_PAPERS_ROOT);

    expect(dir).toBe(path.join(TEST_PAPERS_ROOT, paperId));
  });
});
