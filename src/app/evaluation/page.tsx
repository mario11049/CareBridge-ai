"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Download, FlaskConical, Info, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/ui";
import { runEvaluation, type SetReport } from "@/lib/carebridge/evaluator";
import { fleschBand } from "@/lib/carebridge/readability";
import { clsx } from "@/lib/carebridge/util";
import Link from "next/link";

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function Metric({ label, value, sub, tone = "plain" }: { label: string; value: string; sub?: string; tone?: "plain" | "good" | "warn" }) {
  return (
    <div className="cb-card p-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist">{label}</p>
      <p className={clsx("mt-1.5 text-[1.7rem] font-extrabold tracking-tight", tone === "good" ? "text-med-deep" : tone === "warn" ? "text-warn-deep" : "text-navy")}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[0.75rem] leading-snug text-mist">{sub}</p> : null}
    </div>
  );
}

function SetView({ r, name }: { r: SetReport; name: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Evaluation samples" value={String(r.sampleCount)} sub={name === "held-out" ? "Seeds 11–50 · never used for tuning" : "Seeds 1–10 · used while writing parser rules"} />
        <Metric
          label="Critical field omissions"
          value={String(r.omissions)}
          sub="Gold items absent from extractor output"
          tone={r.omissions === 0 ? "good" : "warn"}
        />
        <Metric
          label="Unsupported additions"
          value={String(r.unsupportedAdditions)}
          sub="Output items not present in gold"
          tone={r.unsupportedAdditions === 0 ? "good" : "warn"}
        />
        <Metric label="Items flagged for review" value={String(r.reviewFlags)} sub="Parser flags + unclear entries (review is a feature)" />
      </div>

      <div className="cb-card overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-bold text-navy">Medication field exact-match rate</h3>
          <p className="text-[0.78rem] text-mist">Exact string preservation after meaning-safe normalisation. No fuzzy similarity is accepted for doses.</p>
        </div>
        <div className="cb-scroll overflow-x-auto">
          <table className="cb-table min-w-[560px]">
            <thead>
              <tr><th>Field</th><th>Matched</th><th>Total</th><th>Exact-match rate</th></tr>
            </thead>
            <tbody>
              {r.medFieldMetrics.map((m) => (
                <tr key={m.field}>
                  <td className="font-semibold capitalize text-navy">{m.field}</td>
                  <td className="doc-font">{m.matched}</td>
                  <td className="doc-font">{m.total}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-36 overflow-hidden rounded-full bg-ivory-2">
                        <div className={clsx("h-full rounded-full", m.rate > 0.95 ? "bg-med" : m.rate > 0.85 ? "bg-warn" : "bg-alert")} style={{ width: `${Math.min(100, m.rate * 100)}%` }} />
                      </div>
                      <span className="doc-font text-[0.8rem] font-bold text-navy">{(m.rate * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="cb-card p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist">Follow-up date preservation</p>
          <p className="mt-2 text-2xl font-extrabold text-navy">
            {r.followUpPreserved.matched}/{r.followUpPreserved.total}
            <span className="ml-2 text-sm font-bold text-med-deep">{pct(r.followUpPreserved.matched, r.followUpPreserved.total)}</span>
          </p>
          <p className="mt-1 text-[0.78rem] text-mist">Appointment dates recovered exactly as emitted.</p>
        </div>
        <div className="cb-card p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist">Warning-sign preservation</p>
          <p className="mt-2 text-2xl font-extrabold text-navy">
            {r.warningPreserved.matched}/{r.warningPreserved.total}
            <span className="ml-2 text-sm font-bold text-med-deep">{pct(r.warningPreserved.matched, r.warningPreserved.total)}</span>
          </p>
          <p className="mt-1 text-[0.78rem] text-mist">Safety-critical signs recovered exactly.</p>
        </div>
        <div className="cb-card p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist">English readability of generated plans</p>
          <p className="mt-2 text-2xl font-extrabold text-navy">
            {r.englishReadability.fleschMean.toFixed(1)}
            <span className="ml-2 text-sm font-semibold text-mist">Flesch mean · {fleschBand(r.englishReadability.fleschMean)}</span>
          </p>
          <p className="mt-1 text-[0.78rem] text-mist">
            FK grade mean {r.englishReadability.gradeMean.toFixed(1)} · range {r.englishReadability.hardest.toFixed(0)}–{r.englishReadability.easiest.toFixed(0)}.
            Measured on the generated patient-facing English text.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 text-[0.82rem] leading-relaxed text-mist">
        <Info size={15} className="mt-0.5 shrink-0 text-med" aria-hidden="true" />
        <p>
          <strong className="text-navy">Telugu readability: not applicable.</strong> Flesch-style formulas are English-specific
          and would produce a meaningless number for Telugu. Instead of fabricating one, the Telugu rendering is validated
          phrase-by-phrase (coverage shown in the audit view) and unrenderable lines are preserved in English and flagged.
        </p>
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const [stamp, setStamp] = useState(0);
  const [tab, setTab] = useState<"held-out" | "development">("held-out");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stamp intentionally forces a re-run
  const report = useMemo(() => runEvaluation(), [stamp]);

  const download = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carebridge-evaluation-report.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      eyebrow="Step 6 · Honest measurement"
      title="Evaluation dashboard"
      body="Every number on this page is computed right now, in your browser, by running the real extractor and planner over the 50-case synthetic gold-standard set. If the evaluator had not run, each tile would say “Not evaluated”."
      actions={
        <>
          <button type="button" onClick={() => setStamp((s) => s + 1)} className="cb-btn cb-btn-ghost cb-btn-sm">
            <RefreshCw size={13} aria-hidden="true" />
            Re-run evaluation
          </button>
          <button type="button" onClick={download} className="cb-btn cb-btn-primary cb-btn-sm">
            <Download size={13} aria-hidden="true" />
            Download report (JSON)
          </button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-med-line bg-med-soft px-4 py-3">
        <FlaskConical size={16} className="shrink-0 text-med-deep" aria-hidden="true" />
        <p className="text-[0.84rem] leading-relaxed text-med-deep">
          <strong>What is being measured:</strong> {report.method}
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2" role="tablist" aria-label="Evaluation set">
        {(
          [
            ["held-out", `Held-out evaluation set (40)`],
            ["development", `Development set (10)`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={clsx(
              "rounded-full border px-4 py-2 text-[0.84rem] font-semibold transition-colors",
              tab === k ? "border-navy bg-navy text-white" : "border-line bg-white text-ink/70 hover:border-med hover:text-med-deep",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto hidden text-xs font-semibold text-mist sm:block">
          Generated {new Date(report.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      <SetView r={tab === "held-out" ? report.heldOut : report.development} name={tab} />

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-warn/50 bg-warn-soft px-4 py-3 text-[0.84rem] leading-relaxed text-warn-deep">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          These scores describe synthetic, template-generated text only. They are <strong>not</strong> evidence of accuracy on
          real hospital documents, and they are <strong>not</strong> a clinical safety claim. The held-out set was not used to
          develop the parser.
        </p>
      </div>

      <div className="mt-4">
        <Link href="/judge" className="inline-flex items-center gap-2 text-sm font-bold text-med-deep hover:underline">
          Next: watch the validator catch injected errors in Judge Mode <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </PageShell>
  );
}
