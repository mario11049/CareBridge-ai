"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Eraser,
  FlaskConical,
  Play,
  RotateCcw,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { PageShell } from "@/components/ui";
import StatusPill from "@/components/StatusPill";
import VerifiedBanner from "@/components/VerifiedBanner";
import { useCareBridge } from "@/lib/store";
import { validatePlan } from "@/lib/carebridge/validator";
import type { AuditRow, CarePlan } from "@/lib/carebridge/types";
import { clsx } from "@/lib/carebridge/util";

type ChallengeId = "dose" | "followup" | "warning" | "addition";

interface MutationInfo {
  id: ChallengeId;
  title: string;
  description: string;
  expectedRule: string;
  highlight?: { medId?: string; followUpId?: string; warningId?: string; injectedId?: string };
}

const CHALLENGES: Array<MutationInfo & { apply: (plan: CarePlan) => CarePlan; expect: (rows: AuditRow[]) => boolean }> = [
  {
    id: "dose",
    title: "Changed medication dose",
    description: "The plan's strength for the first medicine is silently halved (e.g. 650 mg → 325 mg). A faithful system must catch it.",
    expectedRule: "Rule: med.strength exact-match (source vs plan)",
    apply: (plan) => {
      const idx = plan.medications.findIndex((m) => m.strength && /\d/.test(m.strength));
      if (idx < 0) return plan;
      const m = plan.medications[idx];
      const orig = m.strength as string;
      const halved = orig.replace(/\d[\d,]*(?:\.\d+)?/, (n) => {
        const v = parseFloat(n.replace(/,/g, ""));
        const h = v / 2;
        return Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10);
      });
      plan.medications[idx] = { ...m, strength: halved, howEn: m.howEn.replace(orig, halved) };
      return plan;
    },
    expect: (rows) => rows.some((r) => r.field.endsWith(".strength") && r.status === "mismatch"),
  },
  {
    id: "followup",
    title: "Missing follow-up date",
    description: "One follow-up visit — including its exact date — is dropped from the care plan entirely.",
    expectedRule: "Rule: follow-up presence / omission detection",
    apply: (plan) => {
      const idx = plan.followUps.findIndex((f) => f.date);
      if (idx >= 0) plan.followUps.splice(idx, 1);
      return plan;
    },
    expect: (rows) => rows.some((r) => r.field.includes("FUP") && r.field.endsWith(".presence") && r.status === "mismatch"),
  },
  {
    id: "warning",
    title: "Omitted warning sign",
    description: "A safety-critical warning sign from the source is removed from the plan, silently.",
    expectedRule: "Rule: warning-sign preservation (safety-critical)",
    apply: (plan) => {
      if (plan.warnings.length) plan.warnings.pop();
      return plan;
    },
    expect: (rows) => rows.some((r) => r.group === "When to seek help" && r.field.endsWith(".presence") && r.status === "mismatch"),
  },
  {
    id: "addition",
    title: "Unsupported instruction added",
    description: "The plan gains an instruction that appears nowhere in the source: “You may drive and return to work immediately.”",
    expectedRule: "Rule: unsupported-addition detection (no source evidence)",
    apply: (plan) => {
      plan.home.push({
        id: "PI-INJECTED",
        sourceId: null,
        category: "other",
        en: "You may drive and return to work immediately.",
        te: null,
        teReview: false,
        evidence: null,
      });
      return plan;
    },
    expect: (rows) => rows.some((r) => r.group === "Unsupported additions" && r.status === "mismatch"),
  },
];

export default function JudgePage() {
  const { result, processDocument, hydrated, judgeRuns, addJudgeRun } = useCareBridge();
  const [challengeId, setChallengeId] = useState<ChallengeId>("dose");
  const [ran, setRan] = useState<null | {
    challenge: (typeof CHALLENGES)[number];
    report: ReturnType<typeof validatePlan>;
    mutated: CarePlan | null;
    detectionPassed: boolean;
    mode: "challenge" | "corrected";
  }>(null);
  const [loadingBase, setLoadingBase] = useState(false);

  const baseline = useMemo(() => result ?? null, [result]);

  const ensureBase = () => {
    if (!baseline) {
      setLoadingBase(true);
      import("@/lib/carebridge/samples").then(({ SAMPLES }) => {
        const s = SAMPLES[0];
        processDocument(s.text, `${s.label} (${s.id})`, s.id, "demo");
        setLoadingBase(false);
      });
      return false;
    }
    return true;
  };

  const runChallenge = (id: ChallengeId) => {
    if (!ensureBase() || !baseline) return;
    const challenge = CHALLENGES.find((c) => c.id === id)!;
    const mutated = challenge.apply(structuredClone(baseline.plan));
    const report = validatePlan(baseline.extraction, mutated);
    const detectionPassed = !report.verified && challenge.expect(report.rows);
    setRan({ challenge, report, mutated, detectionPassed, mode: "challenge" });
    addJudgeRun({
      id: `J-${Date.now().toString(36)}`,
      challenge: challenge.title,
      ranAt: new Date().toISOString(),
      detectionPassed,
      mismatchCount: report.counts.mismatch,
      summary: detectionPassed
        ? `Validator caught the injected error: ${report.counts.mismatch} mismatch row(s), verified state blocked.`
        : "Validator did NOT catch the injected error — this would be a real bug to fix, not a pass.",
    });
  };

  const showCorrected = () => {
    if (!baseline) return;
    const report = validatePlan(baseline.extraction, structuredClone(baseline.plan));
    setRan({
      challenge: CHALLENGES.find((c) => c.id === challengeId)!,
      report,
      mutated: null,
      detectionPassed: report.verified,
      mode: "corrected",
    });
  };

  const runAll = () => {
    if (!ensureBase() || !baseline) return;
    CHALLENGES.forEach((c, i) => {
      setTimeout(() => {
        const mutated = c.apply(structuredClone(baseline.plan));
        const report = validatePlan(baseline.extraction, mutated);
        const ok = !report.verified && c.expect(report.rows);
        addJudgeRun({
          id: `J-${Date.now().toString(36)}-${i}`,
          challenge: c.title,
          ranAt: new Date().toISOString(),
          detectionPassed: ok,
          mismatchCount: report.counts.mismatch,
          summary: ok ? "Detected and blocked." : "NOT detected — genuine failure.",
        });
      }, i * 60);
    });
  };

  if (!hydrated) return null;

  return (
    <PageShell
      eyebrow="Step 5 · Judge demonstration"
      title="Judge Mode — show, don't claim"
      body="Runs the actual faithfulness engine against pre-authored synthetic fixtures with one controlled error each. The displayed result is the validator's real output — there is no hardcoded pass animation."
      actions={
        <>
          <button type="button" onClick={runAll} className="cb-btn cb-btn-ghost cb-btn-sm" disabled={!baseline}>
            <Play size={13} aria-hidden="true" />
            Run all 4 challenges
          </button>
          <Link href="/evaluation" className="cb-btn cb-btn-dark cb-btn-sm">
            Evaluation dashboard
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </>
      }
    >
      {!baseline ? (
        <div className="cb-card mx-auto max-w-xl p-8 text-center">
          <FlaskConical size={28} className="mx-auto text-med" aria-hidden="true" />
          <h2 className="cb-h2 mt-3 font-display">Load the fixture first</h2>
          <p className="mt-2 text-[0.92rem] text-mist">
            Judge Mode uses the synthetic sample <strong>SYN-001</strong> as its known-good baseline. Load it now — one click.
          </p>
          <button type="button" onClick={ensureBase} disabled={loadingBase} className="cb-btn cb-btn-primary mt-5">
            {loadingBase ? "Loading…" : "Load SYN-001 demo fixture"}
          </button>
          <p className="mt-3 text-xs text-mist">Or load any sample in the <Link className="font-semibold text-med-deep underline" href="/workspace">workspace</Link> — Judge Mode will use whatever document is active.</p>
        </div>
      ) : (
        <>
          {/* challenge picker */}
          <div className="grid gap-3 md:grid-cols-4">
            {CHALLENGES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setChallengeId(c.id);
                  setRan(null);
                }}
                className={clsx(
                  "rounded-2xl border p-4 text-left transition-all",
                  challengeId === c.id ? "border-navy bg-navy text-white shadow-lift" : "cb-card-flat hover:border-med",
                )}
                aria-pressed={challengeId === c.id}
              >
                <p className={clsx("text-sm font-bold", challengeId === c.id ? "text-white" : "text-navy")}>{c.title}</p>
                <p className={clsx("mt-1.5 text-[0.76rem] leading-snug", challengeId === c.id ? "text-white/75" : "text-mist")}>{c.description}</p>
                <p className={clsx("doc-font mt-2 text-[0.66rem]", challengeId === c.id ? "text-warn" : "text-med-deep")}>{c.expectedRule}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => runChallenge(challengeId)} className="cb-btn cb-btn-primary">
              <Play size={15} aria-hidden="true" />
              Run challenge test
            </button>
            <button type="button" onClick={showCorrected} className="cb-btn cb-btn-ghost" disabled={!ran}>
              <Wand2 size={15} aria-hidden="true" />
              Show corrected demo output
            </button>
            {ran ? (
              <button type="button" onClick={() => setRan(null)} className="cb-btn cb-btn-ghost cb-btn-sm">
                <RotateCcw size={13} aria-hidden="true" />
                Clear result
              </button>
            ) : null}
            <span className="cb-pill border border-warn/50 bg-warn-soft text-warn-deep">pre-authored fixture · real validator</span>
          </div>

          {/* result */}
          {ran ? (
            <div className="mt-6 animate-fade-up">
              <div
                className={clsx(
                  "mb-5 flex items-start gap-3 rounded-2xl border px-5 py-4",
                  ran.mode === "corrected"
                    ? "border-med-line bg-med-soft"
                    : ran.detectionPassed
                      ? "border-med-line bg-med-soft"
                      : "border-alert/40 bg-alert-soft",
                )}
                role="status"
              >
                {ran.detectionPassed ? (
                  <CircleCheck size={22} className="mt-0.5 shrink-0 text-med-deep" aria-hidden="true" />
                ) : (
                  <CircleX size={22} className="mt-0.5 shrink-0 text-alert-deep" aria-hidden="true" />
                )}
                <div>
                  <p className={clsx("text-[0.98rem] font-extrabold", ran.detectionPassed ? "text-med-deep" : "text-alert-deep")}>
                    {ran.mode === "corrected"
                      ? ran.report.verified
                        ? "Corrected output — all critical checks pass."
                        : "Corrected output still has unresolved items — see below."
                      : ran.detectionPassed
                        ? `Detection test PASSED — the validator caught “${ran.challenge.title}”.`
                        : `Detection test FAILED — the validator missed “${ran.challenge.title}”. Report this as a bug.`}
                  </p>
                  <p className="mt-0.5 text-[0.84rem] leading-relaxed text-ink/80">
                    {ran.mode === "corrected"
                      ? "This is the unmodified plan generated from the source, validated by the same engine."
                      : "The verified state is blocked and the discrepancy is listed below with its source value, generated value, and the rule that fired."}
                  </p>
                </div>
              </div>

              <VerifiedBanner report={ran.report} />

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {/* source */}
                <div className="cb-card flex flex-col p-5">
                  <p className="cb-eyebrow mb-2">Original discharge summary</p>
                  <pre className="doc-font cb-scroll max-h-96 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-navy p-3.5 text-[0.72rem] leading-relaxed text-white/85">
                    {baseline.sourceText}
                  </pre>
                </div>

                {/* plan under test */}
                <div className="cb-card p-5">
                  <p className="cb-eyebrow mb-2">
                    {ran.mode === "corrected" ? "Care plan (corrected fixture)" : `Care plan (with injected error)`}
                  </p>
                  <div className="cb-scroll max-h-96 space-y-2.5 overflow-auto pr-1 text-[0.84rem]">
                    {(ran.mutated ?? baseline.plan).medications.map((m) => (
                      <div key={m.id} className="rounded-xl bg-ivory p-3">
                        <p className="font-bold text-navy">{m.name}</p>
                        <p className="mt-0.5">
                          Strength:{" "}
                          <span className={clsx("doc-font rounded px-1", ran.mutated && m.strength !== baseline.plan.medications.find((x) => x.id === m.id)?.strength && "bg-alert-soft font-extrabold text-alert-deep")}>
                            {m.strength ?? "not stated"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[0.78rem] text-mist">{m.howEn}</p>
                      </div>
                    ))}
                    <p className="cb-eyebrow pt-1">Follow-ups</p>
                    {(ran.mutated ?? baseline.plan).followUps.map((f) => (
                      <div key={f.id} className="rounded-xl bg-ivory p-3">
                        <p className="font-semibold text-navy">{f.title}</p>
                        <p className="doc-font text-[0.78rem]">{f.date ?? "date not stated"} · {f.time ?? "time not stated"}</p>
                      </div>
                    ))}
                    {baseline.plan.followUps
                      .filter((f) => !(ran.mutated ?? baseline.plan).followUps.some((x) => x.id === f.id))
                      .map((f) => (
                        <div key={f.id} className="rounded-xl border border-dashed border-alert/60 bg-alert-soft/60 p-3 opacity-80">
                          <p className="font-semibold text-alert-deep line-through">{f.title} — {f.date}</p>
                          <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-alert-deep">removed by challenge</p>
                        </div>
                      ))}
                    <p className="cb-eyebrow pt-1">Warning signs</p>
                    {(ran.mutated ?? baseline.plan).warnings.map((w) => (
                      <div key={w.id} className="rounded-xl bg-ivory p-3">
                        <p className="font-semibold text-alert-deep">{w.sign}</p>
                      </div>
                    ))}
                    {baseline.plan.warnings
                      .filter((w) => !(ran.mutated ?? baseline.plan).warnings.some((x) => x.id === w.id))
                      .map((w) => (
                        <div key={w.id} className="rounded-xl border border-dashed border-alert/60 bg-alert-soft/60 p-3 opacity-80">
                          <p className="font-semibold text-alert-deep line-through">{w.sign}</p>
                          <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-alert-deep">removed by challenge</p>
                        </div>
                      ))}
                    {(ran.mutated ?? baseline.plan).home
                      .filter((h) => !h.sourceId)
                      .map((h) => (
                        <div key={h.id} className="rounded-xl border border-alert/60 bg-alert-soft p-3">
                          <p className="font-bold text-alert-deep">“{h.en}”</p>
                          <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-alert-deep">no source evidence — injected</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* validation results */}
                <div className="cb-card flex flex-col p-5">
                  <p className="cb-eyebrow mb-2">Validation results</p>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                    {(["mismatch", "needs_review", "matched"] as const).map((s) => (
                      <div key={s} className="rounded-xl bg-ivory p-2">
                        <p className="text-lg font-extrabold text-navy">{ran.report.counts[s]}</p>
                        <StatusPill status={s} className="mt-1 !px-1.5 !py-0.5 !text-[0.6rem]" />
                      </div>
                    ))}
                  </div>
                  <div className="cb-scroll max-h-72 flex-1 space-y-2 overflow-auto pr-1">
                    {ran.report.rows
                      .filter((r) => r.status !== "matched")
                      .map((r) => (
                        <div key={r.id} className={clsx("rounded-xl border p-3 text-[0.8rem]", r.status === "mismatch" ? "border-alert/40 bg-alert-soft/60" : "border-warn/50 bg-warn-soft/60")}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-navy">{r.label}</p>
                            <StatusPill status={r.status} />
                          </div>
                          <p className="doc-font mt-1.5 text-[0.72rem] leading-relaxed">
                            source: {r.sourceValue}
                            <br />
                            plan: {r.planValue}
                          </p>
                          <p className="mt-1 text-[0.74rem] leading-snug text-ink/75">{r.action}</p>
                        </div>
                      ))}
                    {ran.report.rows.every((r) => r.status === "matched") ? (
                      <div className="flex items-center gap-2 rounded-xl bg-med-soft p-3 text-[0.82rem] font-semibold text-med-deep">
                        <ShieldCheck size={15} aria-hidden="true" />
                        Every defined comparison passed.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* run history */}
          {judgeRuns.length ? (
            <section className="cb-card mt-8 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold text-navy">Challenge run history (this session)</h2>
                <span className="text-[0.72rem] font-semibold text-mist">{judgeRuns.length} run(s)</span>
              </div>
              <div className="cb-scroll overflow-x-auto">
                <table className="cb-table min-w-[640px]">
                  <thead>
                    <tr><th>Time</th><th>Challenge</th><th>Detector result</th><th>Mismatch rows</th><th>Summary</th></tr>
                  </thead>
                  <tbody>
                    {judgeRuns.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-mist">{new Date(r.ranAt).toLocaleTimeString()}</td>
                        <td className="font-semibold text-navy">{r.challenge}</td>
                        <td>
                          {r.detectionPassed ? (
                            <span className="inline-flex items-center gap-1 font-bold text-med-deep"><CircleCheck size={14} aria-hidden="true" /> PASS — caught</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-alert-deep"><CircleX size={14} aria-hidden="true" /> FAIL — missed</span>
                          )}
                        </td>
                        <td className="doc-font">{r.mismatchCount}</td>
                        <td className="max-w-[340px] text-[0.8rem] leading-snug text-ink/75">{r.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <p className="mt-5 flex items-start gap-2 text-[0.8rem] leading-relaxed text-mist">
            <Eraser size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Judge Mode never mutates your loaded document — mutations exist only inside this page. “Corrected output” simply
            re-validates the genuine plan generated from the source.
          </p>
        </>
      )}
    </PageShell>
  );
}
