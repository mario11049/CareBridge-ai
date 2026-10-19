// CareBridge analysis pipeline — real Gemini-backed document processing.
// Accepts a PDF/TXT file upload (multipart) or pasted text (JSON), analyses it
// with Gemini (PDFs are sent as real document bytes, including scanned PDFs),
// validates the structured output, verifies it against the source, and returns
// an Extraction the existing app renders end-to-end.
//
// No mocks, no hardcoded results. Nothing is stored or logged.

import { NextResponse } from "next/server";
import { callGeminiAnalysis } from "@/lib/carebridge/gemini-analysis";
import { mapGenToExtraction, validateGenAnalysis } from "@/lib/carebridge/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_BYTES = 2 * 1024 * 1024; // safe for serverless request limits
const MAX_TEXT_CHARS = 60_000;

// Medical content must never be cached anywhere. Light per-client rate limit
// also bounds API cost.
const NO_STORE = { "Cache-Control": "no-store" };
const buckets = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
function rateLimited(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    if (buckets.size > 5000) buckets.clear();
    return false;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW;
}

function err(code: string, message: string, status = 200) {
  return NextResponse.json({ ok: false, code, message }, { status, headers: NO_STORE });
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.GEMINI_API_KEY) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return err(
      "no_key",
      "AI analysis is not configured on this deployment. You can still run the offline deterministic parser.",
    );
  }

  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(client)) {
    return err("quota", "Too many analyses in a short time. Please wait a few minutes and try again.");
  }

  const contentType = req.headers.get("content-type") ?? "";
  let kind: "pdf" | "text";
  let sourceText = "";
  let sourceName = "document";
  let pdfBuffer: Buffer | null = null;
  let pages: number | null = null;
  let imageOnly = false;

  // ---------- input acquisition & validation ----------
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return err("bad_request", "Could not read the uploaded form data.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return err("bad_request", "No file was provided.", 400);
    sourceName = file.name || "document";
    if (file.size === 0) return err("empty", "The file is empty. Please choose a file with content.");
    if (file.size > MAX_FILE_BYTES) {
      return err("too_large", "File is too large. This demo accepts documents up to 2 MB so they can be processed reliably.", 413);
    }
    const lower = sourceName.toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());

    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      kind = "pdf";
      // validate PDF structure
      if (!bytes.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
        return err("invalid_pdf", "This file is not a valid PDF (missing PDF header). It may be corrupted or misnamed.");
      }
      if (bytes.includes(Buffer.from("/Encrypt"))) {
        return err("encrypted_pdf", "This PDF is encrypted/password-protected. Please remove the password and upload again.");
      }
      pdfBuffer = bytes;
      // quick text extraction for source verification (scanned PDFs have none)
      try {
        const { extractPdfText } = await import("@/lib/carebridge/pdf-text");
        const r = await extractPdfText(bytes);
        sourceText = (r.text ?? "").trim();
        pages = r.pages ?? null;
      } catch {
        sourceText = "";
      }
      if (!sourceText) imageOnly = true;
    } else if (lower.endsWith(".txt") || file.type.startsWith("text/")) {
      kind = "text";
      sourceText = bytes.toString("utf-8").trim();
      if (!sourceText) return err("empty", "The text file contains no readable text.");
    } else {
      return err("unsupported", "Unsupported file type. Upload a .pdf or .txt file, or paste the text directly.", 415);
    }
  } else {
    let body: { text?: unknown; name?: unknown };
    try {
      body = (await req.json()) as { text?: unknown; name?: unknown };
    } catch {
      return err("bad_request", "Could not read the request body.", 400);
    }
    sourceText = typeof body.text === "string" ? body.text.trim() : "";
    sourceName = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Pasted document";
    if (!sourceText) return err("empty", "The pasted text is empty — paste a discharge summary first.");
    kind = "text";
  }

  if (sourceText.length > MAX_TEXT_CHARS) {
    return err("too_large", "The document is too long for one analysis (60,000 characters max). Please analyse it in parts.", 413);
  }

  // ---------- Gemini analysis ----------
  const call =
    kind === "pdf"
      ? await callGeminiAnalysis({ kind: "pdf", base64: (pdfBuffer as Buffer).toString("base64") })
      : await callGeminiAnalysis({ kind: "text", text: sourceText });

  if (!call.ok) {
    const m = call.message;
    if (/timeout/i.test(m)) {
      return err("timeout", "The analysis service did not respond in time. Please retry — documents are not stored, so nothing was lost.");
    }
    if (m === "empty_response" || /blocked/i.test(m)) {
      return err("bad_response", "The analysis service returned an empty response. Please retry; if it persists, the document may be unreadable.");
    }
    if (call.status === 400 || call.status === 401 || call.status === 403) {
      return err("invalid_key", "The analysis service rejected the configured credentials or request format. Check the server-side AI configuration.");
    }
    if (call.status === 429) {
      return err("quota", "The analysis service is rate-limited right now. Wait a minute and retry.");
    }
    if (call.status === 404) {
      return err("invalid_key", "The configured AI model is currently unavailable for this key. Update the server-side model configuration.");
    }
    return err("offline", "The analysis service could not be reached. No plan was fabricated — please retry.");
  }

  // ---------- response validation ----------
  let parsed: unknown;
  try {
    parsed = JSON.parse(call.raw);
  } catch {
    // repair attempt: models occasionally add prose around the JSON object
    const start = call.raw.indexOf("{");
    const end = call.raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(call.raw.slice(start, end + 1));
      } catch {
        parsed = undefined;
      }
    }
    if (parsed === undefined) {
      return err("bad_response", "The analysis service returned malformed JSON. The result was not displayed.");
    }
  }
  const gen = validateGenAnalysis(parsed);
  if (!gen) {
    return err("bad_response", "The analysis output did not match the required schema. The result was not displayed.");
  }
  if (!gen.medications.length && !gen.warningSigns.length && !gen.followUps.length && !gen.diagnosis.verbatim) {
    return err(
      "no_medical_content",
      "No discharge-summary content (medications, follow-ups, warning signs or diagnosis) could be found in this document. Check that you uploaded the right document.",
    );
  }

  // for PDFs with a text layer, verify against the extracted text;
  // for scanned/image PDFs, verify against the model's own read (flagged as such)
  const verificationSource = sourceText || JSON.stringify({ meds: gen.medications, followUps: gen.followUps, warnings: gen.warningSigns });
  const extraction = mapGenToExtraction(gen, { sourceText: verificationSource, imageOnly, model: call.model });

  return NextResponse.json({
    ok: true,
    mode: "live",
    sourceName,
    kind,
    pages,
    imageOnly,
    sourceText: sourceText || "",
    extraction,
  }, { headers: NO_STORE });
}
