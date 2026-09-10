#!/usr/bin/env node
/** Extract every page; optionally render selected pages for visual inspection. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

async function main() {
  const [directory, flag, selection, ...extra] = process.argv.slice(2);
  if (!directory || (flag && flag !== "--render") || (flag && !selection) || extra.length) {
    throw new Error("Usage: node scripts/read-paper.mjs <paperDir> [--render 1,3,5]");
  }
  const renderPages = selection ? [...new Set(selection.split(",").map(Number))] : [];
  if (renderPages.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new Error("Render pages must be positive, comma-separated page numbers.");
  }
  const paperDir = path.resolve(directory);
  const pdfPath = path.join(paperDir, "original.pdf");
  const bytes = fs.readFileSync(pdfPath);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`Not a PDF: ${pdfPath}`);
  }
  const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const pdf = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: path.join(pdfjsRoot, "standard_fonts") + path.sep,
    cMapUrl: path.join(pdfjsRoot, "cmaps") + path.sep,
    cMapPacked: true,
    isEvalSupported: false,
  }).promise;
  try {
    if (renderPages.some((page) => page > pdf.numPages)) {
      throw new Error(`PDF has only ${pdf.numPages} pages.`);
    }
    const sourceDir = path.join(paperDir, "source");
    fs.mkdirSync(path.join(sourceDir, "pages"), { recursive: true });
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item) => "str" in item)
        .map((item) => item.str + (item.hasEOL ? "\n" : " "))
        .join("");
      const file = `pages/${String(number).padStart(4, "0")}.txt`;
      fs.writeFileSync(path.join(sourceDir, file), `Page ${number} / ${pdf.numPages}\n\n${text}\n`);
      pages.push({ page: number, file, characters: text.trim().length });
      page.cleanup();
    }
    const images = [];
    for (const number of renderPages) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const target = pdf.canvasFactory.create(viewport.width, viewport.height);
      try {
        await page.render({ canvasContext: target.context, viewport }).promise;
        fs.mkdirSync(path.join(sourceDir, "images"), { recursive: true });
        const file = `images/${String(number).padStart(4, "0")}.png`;
        fs.writeFileSync(path.join(sourceDir, file), target.canvas.toBuffer("image/png"));
        images.push({ page: number, file });
      } finally {
        pdf.canvasFactory.destroy(target);
        page.cleanup();
      }
    }
    const index = {
      pdfPath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      pageCount: pdf.numPages,
      pages,
      lowTextPages: pages.filter((page) => page.characters < 80).map((page) => page.page),
      images,
      note: "Extraction is not reading completion. Read every page and inspect figures, tables and equations visually. No OCR is performed. Images listed here were rendered in this run.",
    };
    const indexPath = path.join(sourceDir, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
    console.log(JSON.stringify({ indexPath, pageCount: index.pageCount, lowTextPages: index.lowTextPages, images }));
  } finally {
    await pdf.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
