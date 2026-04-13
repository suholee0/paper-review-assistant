export interface ReferenceInfo {
  number: string;
  title: string;
  authors: string;
  year: string;
}

interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

interface PdfProxy {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

export async function extractReferences(pdf: PdfProxy): Promise<ReferenceInfo[]> {
  const refs: ReferenceInfo[] = [];
  const seen = new Set<string>();

  // Find the "References" section heading, then extract from that page onward.
  // Scan backwards to find the start — the heading is typically on a page
  // before the appendix (if any).
  let refStartPage = -1;

  for (let i = pdf.numPages; i >= 1; i--) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str ?? "").join(" ");

    if (/\bReferences\b/i.test(text) && /\[1\]\s*\w/.test(text)) {
      refStartPage = i;
      // Don't break — keep scanning backward in case the heading is earlier
    }
  }

  if (refStartPage === -1) {
    // Fallback: scan last 5 pages
    refStartPage = Math.max(1, pdf.numPages - 4);
  }

  // Extract references from refStartPage until we stop finding [N] patterns
  for (let i = refStartPage; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str ?? "").join(" ");

    const refPattern = /\[(\d+)\]\s*([^[]*?)(?=\[\d+\]|$)/g;
    let match;
    let foundOnPage = 0;

    while ((match = refPattern.exec(text)) !== null) {
      const num = match[1];
      const content = match[2].trim();
      if (!content || content.length < 10) continue;
      if (seen.has(num)) continue;
      seen.add(num);

      const yearMatch = content.match(/((?:19|20)\d{2})/);
      const year = yearMatch ? yearMatch[1] : "";

      const parts = content.split(/[.,"]\s*/);
      const authors = parts[0]?.trim() || "";
      const title =
        parts.length > 1
          ? parts.slice(1, -1).join(", ").trim()
          : content.slice(0, 80);

      refs.push({
        number: num,
        title: title || content.slice(0, 100),
        authors,
        year,
      });
      foundOnPage++;
    }

    // Stop if we passed the references section (page with no refs after ref pages)
    if (foundOnPage === 0 && refs.length > 0) break;
  }

  return refs;
}
