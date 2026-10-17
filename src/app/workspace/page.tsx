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
  Radio,
  RotateCcw,
  ScanSearch,
  ScrollText,
  Wand2,
  FileCheck2,
} from "lucide-react";
import { PageShell } from "@/components/ui";
import { SAMPLES } from "@/lib/carebridge/samples";
import { useCareBridge } from "@/lib/store";
import { clsx } from "@/lib/carebridge/util";

type StepState = "pending" | "active" | "done";

const PIPELINE_STEPS = [
  { key: "read", label: "Reading source", icon: ScrollText, note: "Decode text, keep every character of the original." },
  { key: "extract", label: "Extracting critical details", icon: ScanSearch, note: "Deterministic parser: medicines, dates, warning signs, evidence lines." },
  { key: "simplify", label: "Creating patient-friendly wording", icon: Wand2, note: "Plain-language templates. Values are copied, never re-derived." },
  { key: "translate", label: "Preparing Telugu translation", icon: Languages, note: "Verified phrase rendering. Gaps stay English + flagged." },
  { key: "check", label: "Checking source-to-output consistency", icon: ListChecks, note: "Field-by-field comparison by the faithfulness engine." },
  { key: "prepare", label: "Preparing the care plan", icon: FileCheck2, note: "Assembling sections, questions and the audit trail." },
];

export default function WorkspacePage() {
  const { result, processDocument, reset, hydrated, liveStatus, setLiveStatus } = useCareBridge();
  const [paste, setPaste] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [steps, setSteps] = useState<Record<string, StepState> | null>(null);
  const [justProcessed, setJustProcessed] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // rehydrate source view from stored result
  useEffect(() => {
    if (hydrated && result && !sourceText) {
      setSourceText(result.sourceText);
      setSourceName(result.sourceName);
      setSampleId(result.sampleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const loadSource = useCallback((text: string, name: string, id: string | null) => {
    timers.current.forEach(clearTimeout);
    setSteps(null);
    setJustProcessed(false);
    setInputError(null);
    setSourceText(text);
    setSourceName(name);
    setSampleId(id);
  }, []);

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (s) loadSource(s.text, `${s.label} (${s.id})`, s.id);
  };

  const handleFile = async (file: File) => {
    setInputError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; text?: string; kind?: string; error?: string };
      if (!data.ok || typeof data.text !== "string") {
        setInputError(data.error ?? "The file could not be read.");
        return;
      }
      loadSource(data.text, file.name, null);
    } catch {
      setInputError("Upload failed (network). You can paste the document text instead.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runPipeline = () => {
    const text = sourceText.trim();
    if (!text) {
      setInputError("The workspace is empty. Load a sample, paste text, or upload a file first.");
      return;
    }
    if (text.length > 100_000) {
      setInputError("The document is too long for this demo (100,000 characters max).");
      return;
    }
    setInputError(null);
    setJustProcessed(false);
    const seq: Record<string, StepState> = {};
    PIPELINE_STEPS.forEach((s) => (seq[s.key] = "pending"));
    setSteps({ ...seq });
    // Simulated stage pacing for demo legibility. The actual work is the
    // deterministic parse + template build + validation, which runs instantly.
    PIPELINE_STEPS.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => {
          setSteps((cur) => ({ ...(cur ?? {}), [s.key]: "active" }));
        }, 350 + i * 520),
      );
      timers.current.push(
        setTimeout(() => {
          setSteps((cur) => ({ ...(cur ?? {}), [s.key]: "done" }));
          if (i === PIPELINE_STEPS.length - 1) {
            processDocument(text, sourceName || "Pasted document", sampleId, "demo");
            setJustProcessed(true);
          }
        }, 350 + i * 520 + 470),
      );
    });
  };

  const tryLive = async () => {
    const text = (sourceText || "").trim();
    if (!text) {
      setInputError("Load a document first, then try live mode.");
      return;
    }
    setLiveStatus({ kind: "idle", message: "" });
    try {
      const res = await fetch("/api/live-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { ok: boolean; mode?: string; error?: string };
      if (data.mode === "demo_unavailable") {
        setLiveStatus({ kind: "unavailable", message: data.error ?? "Live AI is not configured on this deployment." });
      } else if (!data.ok) {
        setLiveStatus({ kind: "error", message: data.error ?? "Live AI request failed." });
      } else {
        setLiveStatus({
          kind: "ok",
          message:
            "Live extraction returned. For safety, this demo build always re-parses with the deterministic pipeline before showing a plan — so what you see is the validated deterministic result.",
        });
      }
    } catch {
      setLiveStatus({ kind: "error", message: "Could not reach the live AI route. Demo mode is unaffected." });
    }
  };

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    setSteps(null);
    setJustProcessed(false);
    setPaste("");
    setSourceText("");
    setSourceName("");
    setSampleId(null);
    setInputError(null);
    reset();
  };

  return (
    <PageShell
      eyebrow="Step 1 · Source document"
      title="Care-plan workspace"
      body="Load a labelled synthetic sample, paste a discharge summary, or upload a PDF/TXT. Then run the pipeline — extraction, wording, Telugu rendering, and the faithfulness check."
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
            <p className="mt-1.5 text-[0.83rem] text-mist">Max 2 MB. Scanned image-PDFs have no extractable text and will be rejected with a clear message.</p>
            <label
              className={clsx(
                "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-ivory px-4 py-8 text-center transition-colors hover:border-med",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? <Loader2 className="animate-spin text-med" size={26} aria-hidden="true" /> : <FileText className="text-mist" size={26} aria-hidden="true" />}
              <span className="mt-2 text-sm font-semibold text-navy">{uploading ? "Extracting text…" : "Choose a file or drop it here"}</span>
              <span className="mt-1 text-xs text-mist">.pdf or .txt · server-side extraction · nothing stored</span>
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
              <h2 className="text-[1.02rem] font-bold text-navy">Paste discharge-summary text</h2>
            </div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={7}
              placeholder={"Paste the full discharge summary text here…\nTip: the pipeline understands the standard section layout (MEDICATIONS, FOLLOW-UP, WARNING SIGNS, DIET, ACTIVITY AND HOME CARE)."}
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
            <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-alert/40 bg-alert-soft px-4 py-3 text-sm text-alert-deep">
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
              {sourceText ? (
                <span className="rounded-full bg-ivory-2 px-2.5 py-1 text-[0.72rem] font-semibold text-mist">
                  {sourceName} · {sourceText.split("\n").length} lines
                </span>
              ) : null}
            </div>
            {sourceText ? (
              <pre className="doc-font cb-scroll mt-4 max-h-72 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-navy p-4 text-white/85">
                {sourceText}
              </pre>
            ) : (
              <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-ivory p-8 text-center">
                <FileText size={26} className="text-mist/60" aria-hidden="true" />
                <p className="mt-2 max-w-xs text-sm text-mist">No document loaded. Choose a synthetic sample, paste text, or upload a file.</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={runPipeline} disabled={!sourceText || steps !== null} className="cb-btn cb-btn-primary">
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
              <button type="button" onClick={() => void tryLive()} disabled={!sourceText} className="cb-btn cb-btn-ghost cb-btn-sm" title="Attempts the server-side Gemini route. Falls back to demo mode when unconfigured.">
                <Radio size={14} aria-hidden="true" />
                Try live AI (Gemini)
              </button>
              {sourceText ? (
                <button type="button" onClick={clearAll} className="cb-btn cb-btn-sm text-alert-deep" style={{ border: "1px solid rgba(200,62,77,0.35)", background: "#F9E8EA" }}>
                  <Eraser size={13} aria-hidden="true" />
                  Clear
                </button>
              ) : null}
            </div>
            {liveStatus.kind !== "idle" ? (
              <div
                role="status"
                className={clsx(
                  "mt-3 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[0.82rem] leading-relaxed",
                  liveStatus.kind === "ok" && "border-med-line bg-med-soft text-med-deep",
                  liveStatus.kind === "unavailable" && "border-warn/50 bg-warn-soft text-warn-deep",
                  liveStatus.kind === "error" && "border-alert/40 bg-alert-soft text-alert-deep",
                )}
              >
                {liveStatus.kind === "ok" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CloudOff size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
                {liveStatus.message}
              </div>
            ) : null}
          </div>

          {/* pipeline timeline */}
          {steps ? (
            <div className="cb-card p-5 animate-fade-in" aria-live="polite">
              <div className="flex items-center justify-between">
                <h2 className="text-[1.02rem] font-bold text-navy">Processing timeline</h2>
                <span className="cb-pill bg-ivory-2 text-mist">Demo mode · simulated pacing</span>
              </div>
              <p className="mt-1 text-[0.78rem] text-mist">
                Stage pacing is simulated for legibility. The extraction, Telugu rendering and validation are genuinely
                executed in this browser — the results are real, deterministic and reproducible.
              </p>
              <ol className="mt-4 space-y-2">
                {PIPELINE_STEPS.map((s, i) => {
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
                  {result.sourceName} · processed {new Date(result.processedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/plan" className="cb-btn cb-btn-primary cb-btn-sm">
                  View care plan
                </Link>
                <button type="button" onClick={runPipeline} className="cb-btn cb-btn-ghost cb-btn-sm">
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
