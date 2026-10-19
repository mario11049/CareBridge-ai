// Shared PDF text extraction (pdf-parse v2 API — PDFParse class).
// Server-side only; buffers are processed in memory and discarded.

export interface PdfTextResult {
  text: string;
  pages: number;
}

export async function extractPdfText(buf: Buffer): Promise<PdfTextResult> {
  const mod = await import("pdf-parse");
  const parser = new mod.PDFParse({ data: new Uint8Array(buf) });
  try {
    const r = await parser.getText();
    return { text: r.text ?? "", pages: r.total ?? 0 };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
