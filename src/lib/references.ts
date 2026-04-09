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

  // Check last 3 pages for references
  const startPage = Math.max(1, pdf.numPages - 2);

  for (let i = startPage; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => item.str ?? "")
      .join(" ");

    // Match patterns like [1] or [1] Author, "Title", etc.
    // This is a best-effort parser for common reference formats
    const refPattern = /\[(\d+)\]\s*([^[]*?)(?=\[\d+\]|$)/g;
    let match;

    while ((match = refPattern.exec(text)) !== null) {
      const num = match[1];
      const content = match[2].trim();

      if (!content) continue;

      // Try to extract year (4 digits near the end)
      const yearMatch = content.match(/((?:19|20)\d{2})/);
      const year = yearMatch ? yearMatch[1] : "";

      // Try to split authors and title
      // Common patterns: "Author et al., Title, ..." or "Author. Title. ..."
      const parts = content.split(/[.,"]\s*/);
      const authors = parts[0]?.trim() || "";
      const title =
        parts.length > 1
          ? parts.slice(1, -1).join(", ").trim()
          : content.slice(0, 80);

      refs.push({ number: num, title: title || content.slice(0, 100), authors, year });
    }
  }

  return refs;
}
