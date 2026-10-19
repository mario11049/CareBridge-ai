"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  CircleAlert,
  ClipboardPaste,
  CloudOff,
  Eraser,
  FileText,
  FileUp,
  Languages,
  ListChecks,
  Loader2,
  RotateCcw,
  ScanSearch,
  ScrollText,
  Wand2,
  FileCheck2,
  Cpu,
} from "lucide-react";
import { PageShell } from "@/components/ui";
import { SAMPLES } from "@/lib/carebridge/samples";
import { useCareBridge } from "@/lib/store";
import { clsx } from "@/lib/carebridge/util";
import type { Extraction } from "@/lib/carebridge/types";

type StepState = "pending" | "active" | "done";
type Engine = "gemini" | "offline";

const OFFLINE_STEPS = [
  { key: "read", label: "Reading source", icon: ScrollText, note: "Decode text, keep every character of the original." },
  { key: "extract", label: "Extracting critical details", icon: ScanSearch, note: "Deterministic parser: medicines, dates, warning signs, evidence lines." },
  { key: "simplify", label: "Creating patient-friendly wording", icon: Wand2, note: "Plain-language templates. Values are copied, never re-derived." },
  { key: "translate", label: "Preparing Telugu translation", icon: Languages, note: "Verified phrase rendering. Gaps stay English + flagged." },
  { key: "check", label: "Checking source-to-output consistency", icon: ListChecks, note: "Field-by-field comparison by the faithfulness engine." },
  { key: "prepare", label: "Preparing the care plan", icon: FileCheck2, note: "Assembling sections, questions and the audit trail." },
];

const GEMINI_STEPS = [
  { key: "read", label: "Uploading and reading the document", icon: ScrollText, note: "The actual file bytes / text are sent to the secure server route — nothing is stored." },
  { key: "extract", label: "Analysing with the AI engine", icon: Cpu, note: "Structured extraction of medicines, tests, diagnosis, follow-ups, warning signs. Scanned PDFs are read visually where possible." },
  { key: "verify", label: "Verifying output against the source", icon: ListChecks, note: "Evidence quotes, units and times are checked in application code — fabricated values are rejected." },
  { key: "simplify", label: "Preparing bilingual wording", icon: Wand2, note: "Plain English + Telugu from the same validated facts." },
  { key: "check", label: "Faithfulness engine re-check", icon: ScanSearch, note: "The deterministic validator re-compares every critical field." },
  { key: "prepare", label: "Preparing the care plan", icon: FileCheck2, note: "Assembling sections, questions and the audit trail." },
];

export default function WorkspacePage() {
  const { result, processDocument, reset, hydrated } = useCareBridge();
  const [paste, setPaste] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [steps, setSteps] = useState<Record<string, StepState> | null>(null);
  const [justProcessed, setJustProcessed] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  
  const fileRef = useRef<HTMLInputElement | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // probe analysis capability (returns only booleans/model name — no secrets)
  useEffect(() => {
    let alive = true;
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        if (alive) {
          setGeminiConfigured(Boolean(d.configured));

        }
      })
      .catch(() => alive && setGeminiConfigured(false));
    return () => {
      alive = false;
    };
  }, []);

  // rehydrate source view from stored result
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (hydrated && result && !sourceText) {
        setSourceText(result.sourceText);
        setSourceName(result.sourceName);
        setSampleId(result.sampleId);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const loadSource = useCallback((text: string, name: string, id: string | null, file: File | null = null) => {
    timers.current.forEach(clearTimeout);
    setSteps(null);
    setEngine(null);
    setJustProcessed(false);
    setInputError(null);
    setAnalysisError(null);
    setSourceText(text);
    setSourceName(name);
    setSampleId(id);
    setUploadedFile(file);
  }, []);

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (s) loadSource(s.text, `${s.label} (${s.id})`, s.id);
  };

  const handleFile = async (file: File) => {
    setInputError(null);
    setAnalysisError(null);
    setUploading(true);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // keep the raw file for AI analysis; preview via server text extraction
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; text?: string; error?: string };
        if (data.ok && typeof data.text === "string") {
          loadSource(data.text, file.name, null, file);
        } else {
          // scanned PDF — still analysable by the AI engine visually
          loadSource("", file.name, null, file);
          setInputError(data.error ?? "No text layer found — the AI will try to read it visually.");
        }
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; text?: string; error?: string };
      if (!data.ok || typeof data.text !== "string") {
        setInputError(data.error ?? "The file could not be read.");
        return;
      }
      loadSource(data.text, file.name, null, file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt") ? file : null);
    } catch {
      setInputError("Upload failed (network). You can paste the document text instead.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const animateSteps = (defs: typeof OFFLINE_STEPS, onDone: () => void) => {
    const seq: Record<string, StepState> = {};
    defs.forEach((s) => (seq[s.key] = "pending"));
    setSteps({ ...seq });
    defs.forEach((s, i) => {
      timers.current.push(setTimeout(() => setSteps((cur) => ({ ...(cur ?? {}), [s.key]: "active" })), 250 + i * 420));
      timers.current.push(
        setTimeout(() => {
          setSteps((cur) => ({ ...(cur ?? {}), [s.key]: "done" }));
          if (i === defs.length - 1) onDone();
        }, 250 + i * 420 + 380),
      );
    });
  };

  // ---------- OFFLINE deterministic pipeline (real — parses text locally) ----------
  const runOffline = () => {
    const text = sourceText.trim();
    if (!text) {
      setInputError("No readable text is available for the offline parser. Pasted text or a text-based document is required.");
      return;
    }
    setInputError(null);
    setAnalysisError(null);
    setEngine("offline");
    animateSteps(OFFLINE_STEPS, () => {
      processDocument(text, sourceName || "Pasted document", sampleId, "demo");
      setJustProcessed(true);
    });
  };

  // ---------- GEMINI pipeline (real analysis of the actual document) ----------
  const runGemini = async () => {
    const text = sourceText.trim();
    if (!uploadedFile && !text) {
      setInputError("Load a document (PDF/TXT), paste text, or choose a sample first.");
      return;
    }
    setInputError(null);
    setAnalysisError(null);
    setEngine("gemini");
    setJustProcessed(false);

    const seq: Record<string, StepState> = {};
    GEMINI_STEPS.forEach((s) => (seq[s.key] = "pending"));
    setSteps({ ...seq });
    setSteps((cur) => ({ ...(cur ?? {}), read: "active" }));

    try {
      let res: Response;
      if (uploadedFile) {
        const form = new FormData();
        form.append("file", uploadedFile);
        res = await fetch("/api/analyze", { method: "POST", body: form });
      } else {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, name: sourceName || "Pasted document" }),
        });
      }
      setSteps((cur) => ({ ...(cur ?? {}), read: "done", extract: "active" }));
      const data = (await res.json()) as {
        ok: boolean;
        code?: string;
        message?: string;
        extraction?: Extraction;
        sourceText?: string;
        sourceName?: string;
        imageOnly?: boolean;
      };

      if (!data.ok || !data.extraction) {
        setSteps(null);
        setEngine(null);
        setAnalysisError(data.message ?? "Analysis failed unexpectedly. Please retry.");
        return;
      }
      setSteps((cur) => ({ ...(cur ?? {}), extract: "done", verify: "active" }));
      await new Promise((r) => setTimeout(r, 350));
      setSteps((cur) => ({ ...(cur ?? {}), verify: "done", simplify: "active" }));

      // plan + deterministic faithfulness re-check (runs in application code, always)
      const finalSource = data.sourceText || text || "No text preview available — the document was analysed from its file bytes.";
      processDocument(finalSource, data.sourceName ?? sourceName, sampleId, "live", data.extraction);
      setSteps((cur) => ({ ...(cur ?? {}), simplify: "done", check: "active" }));
      await new Promise((r) => setTimeout(r, 350));
      setSteps((cur) => ({ ...(cur ?? {}), check: "done", prepare: "done" }));
      setJustProcessed(true);
      if (data.imageOnly) {
        setInputError("This PDF had no extractable text layer and was read visually. Please verify critical values against the original document.");
      }
    } catch {
      setSteps(null);
      setEngine(null);
      setAnalysisError("Could not reach the analysis service (network error). Nothing was fabricated — please retry, or use the offline parser.");
    }
  };

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    setSteps(null);
    setEngine(null);
    setJustProcessed(false);
    setPaste("");
    setSourceText("");
    setSourceName("");
    setSampleId(null);
    setUploadedFile(null);
    setInputError(null);
    setAnalysisError(null);
    reset();
  };

  const activeSteps = engine === "gemini" ? GEMINI_STEPS : OFFLINE_STEPS;

  return (
    <PageShell
      eyebrow="Step 1 · Source document"
      title="Care-plan workspace"
      body="Load a labelled synthetic sample, paste a medical summary, or upload a PDF/TXT. Analysis runs through the secure AI engine when configured — otherwise the transparent offline parser."
      actions={
        <>
          <button type="button" onClick={clearAll} className="cb-btn cb-btn-ghost cb-btn-sm">
            <RotateCcw size={14} aria-hidden="true" />
            Reset workspace
          </button>
        </>
      }
    >
      {/* samples */}
      <section aria-labelledby="samples-h" className="mb-8">
        <h2 id="samples-h" className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-mist">
          Synthetic sample cases
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {SAMPLES.map((s) => (
            <div key={s.id} className={clsx("cb-card flex flex-col p-5 transition-all", sampleId === s.id && "ring-2 ring-med border-med")}>
              <div className="flex items-center justify-between">
                <span className="cb-pill border border-warn/50 bg-warn-soft text-warn-deep">
                  <Beaker size={11} aria-hidden="true" />
                  Synthetic
                </span>
                <span
                  className={clsx(
                    "cb-pill",
                    s.difficulty === "Routine" && "bg-med-soft text-med-deep",
                    s.difficulty === "Moderate" && "bg-ivory-2 text-mist",
                    s.difficulty === "Challenging" && "bg-alert-soft text-alert-deep",
                  )}
                >
                  {s.difficulty}
                </span>
              </div>
              <h3 className="mt-3 text-[1.02rem] font-bold text-navy">{s.label}</h3>
              <p className="mt-1.5 flex-1 text-[0.84rem] leading-relaxed text-mist">{s.blurb}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-mist">{s.id}</span>
                <button type="button" onClick={() => loadSample(s.id)} className="cb-btn cb-btn-primary cb-btn-sm">
                  Load sample
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* input methods */}
        <div className="space-y-4">
          <div className="cb-card p-5">
            <div className="flex items-center gap-2">
              <FileUp size={17} className="text-med" aria-hidden="true" />
              <h2 className="text-[1.02rem] font-bold text-navy">Upload PDF or TXT</h2>
            </div>
            <p className="mt-1.5 text-[0.83rem] text-mist">
              Max 2 MB. PDFs are analysed from the actual file — scanned image-PDFs are read visually by the AI where
              possible and flagged for verification.
            </p>
            <label
              className={clsx(
                "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-ivory px-4 py-8 text-center transition-colors hover:border-med",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? <Loader2 className="animate-spin text-med" size={26} aria-hidden="true" /> : <FileText className="text-mist" size={26} aria-hidden="true" />}
              <span className="mt-2 text-sm font-semibold text-navy">{uploading ? "Reading file…" : "Choose a file or drop it here"}</span>
              <span className="mt-1 text-xs text-mist">.pdf or .txt · processed server-side · nothing stored</span>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
          </div>

          <div className="cb-card p-5">
            <div className="flex items-center gap-2">
              <ClipboardPaste size={17} className="text-med" aria-hidden="true" />
              <h2 className="text-[1.02rem] font-bold text-navy">Paste medical text</h2>
            </div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={7}
              placeholder={"Paste a discharge summary or medical instructions here…"}
              className="cb-input doc-font mt-4 resize-y"
              aria-label="Paste discharge summary text"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-mist">{paste.trim() ? `${paste.trim().length.toLocaleString()} characters` : "Empty"}</span>
              <button type="button" disabled={!paste.trim()} onClick={() => loadSource(paste, "Pasted document", null)} className="cb-btn cb-btn-dark cb-btn-sm">
                Use pasted text
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {inputError ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-warn/50 bg-warn-soft px-4 py-3 text-sm text-warn-deep">
              <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{inputError}</p>
            </div>
          ) : null}
        </div>

        {/* preview + pipeline */}
        <div className="space-y-4">
          <div className="cb-card flex min-h-[300px] flex-col p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ScrollText size={17} className="text-med" aria-hidden="true" />
                <h2 className="text-[1.02rem] font-bold text-navy">Source preview</h2>
              </div>
              {sourceName ? (
                <span className="max-w-[60%] truncate rounded-full bg-ivory-2 px-2.5 py-1 text-[0.72rem] font-semibold text-mist">
                  {sourceName}
                  {uploadedFile ? ` · ${(uploadedFile.size / 1024).toFixed(0)} KB` : ""}
                </span>
              ) : null}
            </div>
            {sourceText ? (
              <pre className="doc-font cb-scroll mt-4 max-h-72 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-navy p-4 text-white/85">
                {sourceText}
              </pre>
            ) : sourceName ? (
              <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-ivory p-8 text-center">
                <FileText size={26} className="text-mist/60" aria-hidden="true" />
                <p className="mt-2 max-w-xs text-sm text-mist">
                  PDF loaded without a readable text layer (likely scanned). It can still be analysed visually by the AI.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-ivory p-8 text-center">
                <FileText size={26} className="text-mist/60" aria-hidden="true" />
                <p className="mt-2 max-w-xs text-sm text-mist">No document loaded. Choose a synthetic sample, paste text, or upload a file.</p>
              </div>
            )}

            {/* engine actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {geminiConfigured ? (
                <>
                  <button type="button" onClick={() => void runGemini()} disabled={(!sourceText && !uploadedFile) || steps !== null} className="cb-btn cb-btn-primary">
                    {steps && engine === "gemini" ? (
                      <>
                        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        Analysing…
                      </>
                    ) : (
                      <>
                        <Cpu size={15} aria-hidden="true" />
                        Analyse with AI
                      </>
                    )}
                  </button>
                  <button type="button" onClick={runOffline} disabled={!sourceText || steps !== null} className="cb-btn cb-btn-ghost">
                    <ScanSearch size={14} aria-hidden="true" />
                    Offline parser
                  </button>
                </>
              ) : (
                <button type="button" onClick={runOffline} disabled={!sourceText || steps !== null} className="cb-btn cb-btn-primary">
                  {steps ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                      Processing…
                    </>
                  ) : (
                    <>
                      Run the care-plan pipeline
                      <ArrowRight size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
              {sourceName ? (
                <button type="button" onClick={clearAll} className="cb-btn cb-btn-sm text-alert-deep" style={{ border: "1px solid rgba(200,62,77,0.35)", background: "#F9E8EA" }}>
                  <Eraser size={13} aria-hidden="true" />
                  Clear
                </button>
              ) : null}
            </div>

            {geminiConfigured === false ? (
              <div role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-warn/50 bg-warn-soft px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-warn-deep">
                <CloudOff size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                AI analysis is not configured on this deployment — the offline deterministic parser is fully available and produces
                real (non-AI) results.
              </div>
            ) : null}

            {analysisError ? (
              <div role="alert" className="mt-3 rounded-2xl border border-alert/40 bg-alert-soft p-4">
                <div className="flex items-start gap-2.5 text-sm text-alert-deep">
                  <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-bold">Analysis could not be completed</p>
                    <p className="mt-1 leading-relaxed">{analysisError}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void runGemini()} className="cb-btn cb-btn-sm cb-btn-dark">
                        <RotateCcw size={13} aria-hidden="true" />
                        Retry analysis
                      </button>
                      <button type="button" onClick={runOffline} className="cb-btn cb-btn-ghost cb-btn-sm" disabled={!sourceText}>
                        Try offline parser instead
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* pipeline timeline */}
          {steps ? (
            <div className="cb-card p-5 animate-fade-in" aria-live="polite">
              <div className="flex items-center justify-between">
                <h2 className="text-[1.02rem] font-bold text-navy">Processing timeline</h2>
                <span className={clsx("cb-pill", engine === "gemini" ? "bg-med-soft text-med-deep" : "bg-ivory-2 text-mist")}>
                  {engine === "gemini" ? "Live · AI analysis" : "Offline · deterministic parser"}
                </span>
              </div>
              <p className="mt-1 text-[0.78rem] text-mist">
                {engine === "gemini"
                  ? "The document is genuinely analysed by the secure AI engine; the output is then verified and re-checked by the deterministic faithfulness engine before anything is displayed."
                  : "Text is parsed locally by deterministic rules — extraction, Telugu rendering and validation are genuinely executed in this browser."}
              </p>
              <ol className="mt-4 space-y-2">
                {activeSteps.map((s, i) => {
                  const st = steps[s.key];
                  return (
                    <li key={s.key} className={clsx("flex items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-all", st === "done" ? "border-med-line bg-med-soft/60" : st === "active" ? "step-active border-med bg-white" : "border-line bg-ivory")}>
                      <span
                        className={clsx(
                          "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[0.68rem] font-extrabold",
                          st === "done" ? "bg-med text-white" : st === "active" ? "bg-navy text-white" : "bg-ivory-2 text-mist",
                        )}
                      >
                        {st === "done" ? <CheckCircle2 size={14} aria-hidden="true" /> : i + 1}
                      </span>
                      <div className="flex-1">
                        <p className={clsx("text-sm font-bold", st === "pending" ? "text-mist" : "text-navy")}>{s.label}</p>
                        <p className="text-[0.75rem] leading-snug text-mist">{s.note}</p>
                      </div>
                      <s.icon size={15} className={clsx("mt-1", st === "done" ? "text-med" : "text-mist/50")} aria-hidden="true" />
                    </li>
                  );
                })}
              </ol>
              {justProcessed && result ? (
                <div className="mt-4 rounded-xl border border-med-line bg-med-soft p-4 animate-fade-up">
                  <p className="text-sm font-bold text-med-deep">Care plan ready.</p>
                  <p className="mt-0.5 text-[0.8rem] text-med-deep/90">
                    {result.extraction.medications.length} medicines · {result.extraction.followUps.length} follow-ups ·{" "}
                    {result.extraction.warningSigns.length} warning signs · {result.report.counts.matched} checks matched ·{" "}
                    {result.report.counts.needs_review + result.report.counts.mismatch} need attention.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/plan" className="cb-btn cb-btn-primary cb-btn-sm">
                      View care plan
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                    <Link href="/review" className="cb-btn cb-btn-ghost cb-btn-sm">
                      Review extraction
                    </Link>
                    <Link href="/audit" className="cb-btn cb-btn-ghost cb-btn-sm">
                      Evidence audit
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : result ? (
            <div className="cb-card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-bold text-navy">A processed plan is already loaded</p>
                <p className="text-[0.8rem] text-mist">
                  {result.sourceName} · {result.mode === "live" ? "AI analysis" : "offline parser"} · {new Date(result.processedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/plan" className="cb-btn cb-btn-primary cb-btn-sm">
                  View care plan
                </Link>
                <button type="button" onClick={geminiConfigured ? () => void runGemini() : runOffline} className="cb-btn cb-btn-ghost cb-btn-sm">
                  Re-run pipeline
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
