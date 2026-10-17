// Server-side document text extraction.
// - Accepts .txt and .pdf (max 2 MB) as multipart form-data.
// - PDF text is extracted with pdf-parse; failures return a helpful error.
// - Nothing is written to disk, logged, or stored. The buffer is discarded
//   immediately after parsing.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the uploaded form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "The file is empty. Please choose a file with content." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File is too large. The demo accepts files up to 2 MB." },
      { status: 413 },
    );
  }

  const name = file.name || "document";
  const lower = name.toLowerCase();
  const isTxt = lower.endsWith(".txt") || file.type.startsWith("text/");
  const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";

  try {
    if (isTxt) {
      const text = await file.text();
      if (!text.trim()) {
        return NextResponse.json({ ok: false, error: "The text file contains no readable text." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, name, kind: "txt", text, pages: null });
    }
    if (isPdf) {
      const buf = Buffer.from(await file.arrayBuffer());
      // dynamic import keeps the demo bundle lean; parsing happens server-side only
      const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as {
        default: (b: Buffer, o?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>;
      };
      const result = await mod.default(buf, { max: 20 });
      const text = (result.text ?? "").trim();
      if (!text) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No extractable text was found in this PDF. It may be a scanned image. Please paste the text instead, or use a text-based PDF.",
          },
          { status: 422 },
        );
      }
      return NextResponse.json({ ok: true, name, kind: "pdf", text, pages: result.numpages ?? null });
    }
    return NextResponse.json(
      { ok: false, error: "Unsupported file type. Please upload a .txt or .pdf file, or paste the text directly." },
      { status: 415 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not extract text from that file. Please try a .txt file or paste the text directly." },
      { status: 422 },
    );
  }
}
