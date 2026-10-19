"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Copy, Check, Printer, ShieldQuestion } from "lucide-react";
import { PageShell } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import VerifiedBanner from "@/components/VerifiedBanner";
import ListenButton from "@/components/ListenButton";
import { PlanFollowUps, PlanHome, PlanMedicines, PlanQuestions, PlanWarnings, PlanWhatHappened } from "@/components/PlanSections";
import { useCareBridge } from "@/lib/store";
import type { CarePlan } from "@/lib/carebridge/types";
import { normalize } from "@/lib/carebridge/util";

const DOSES_PER_DAY: Record<string, number | null> = {
  "once daily": 1,
  "twice daily": 2,
  "three times daily": 3,
  "four times daily": 4,
  "every 4 hours": 6,
  "every 6 hours": 4,
  "every 8 hours": 3,
  "every 12 hours": 2,
  "at bedtime": 1,
  "as needed (PRN)": null,
  "once a week": 7, // special: one dose in the week
  "twice a week": null,
};

function durationDays(duration: string | null): number | null {
  if (!duration) return null;
  const m = duration.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  return u.startsWith("day") ? n : u.startsWith("week") ? n * 7 : n * 30;
}

function planToSpeechText(plan: CarePlan, lang: "en" | "te"): string {
  const parts: string[] = [];
  if (lang === "en") {
    parts.push("CareBridge care plan. What happened? " + (plan.whatHappened.en ?? "Not stated."));
    parts.push("Your medicines.");
    for (const m of plan.medications) parts.push(`${m.name ?? "Unknown medicine"}, ${m.strength ?? "strength not stated"}. ${m.howEn}${m.specialEn ? " Note: " + m.specialEn : ""}`);
    if (plan.home.length) {
      parts.push("What to do at home.");
      for (const h of plan.home) parts.push(h.en);
    }
    parts.push("Your follow-up.");
    for (const f of plan.followUps) parts.push(`${f.title ?? "Follow-up"}. Date: ${f.date ?? "not stated"}. Time: ${f.time ?? "not stated"}. ${f.preparation ?? ""}`);
    parts.push("When to seek help.");
    for (const w of plan.warnings) parts.push(`${w.sign ?? ""}. Action: ${w.action ?? ""}.`);
    if (plan.questions.length) {
      parts.push("Questions for your care team.");
      for (const q of plan.questions) parts.push(q.en);
    }
  } else {
    parts.push("కేర్‌బ్రిడ్జ్ కేర్ ప్లాన్. ఏమి జరిగింది? " + (plan.whatHappened.te ?? plan.whatHappened.en ?? "పేర్కొనలేదు."));
    parts.push("మీ ఔషధాలు.");
    for (const m of plan.medications) parts.push(`${m.name ?? "తెలియని ఔషధం"}, ${m.strength ?? "బలం పేర్కొనలేదు"}. ${m.howTe}${m.specialTe ? " గమనిక: " + m.specialTe : m.specialEn ? " గమనిక: " + m.specialEn : ""}`);
    if (plan.home.length) {
      parts.push("ఇంట్లో ఏమి చేయాలి.");
      for (const h of plan.home) parts.push(h.te ?? h.en);
    }
    parts.push("మీ ఫాలో-అప్.");
    for (const f of plan.followUps) parts.push(`${f.titleTe ?? f.title ?? "ఫాలో-అప్"}. తేదీ: ${f.date ?? "పేర్కొనలేదు"}. సమయం: ${f.time ?? "పేర్కొనలేదు"}. ${f.prepTe ?? f.preparation ?? ""}`);
    parts.push("ఎప్పుడు వెంటనే సహాయం పొందాలి.");
    for (const w of plan.warnings) parts.push(`${w.signTe ?? w.sign ?? ""}. చర్య: ${w.actionTe ?? w.action ?? ""}.`);
    if (plan.questions.length) {
      parts.push("వైద్య బృందాన్ని అడగాల్సిన ప్రశ్నలు.");
      for (const q of plan.questions) parts.push(q.te ?? q.en);
    }
  }
  return parts.join(" ");
}

export default function PlanPage() {
  const { result, hydrated, lang } = useCareBridge();
  const [copied, setCopied] = useState(false);

  const sevenDay = useMemo(() => {
    if (!result) return null;
    const rows = result.plan.medications
      .map((m) => {
        const dpd = m.frequency ? (DOSES_PER_DAY[normalize(m.frequency)] ?? null) : null;
        const days = durationDays(m.duration);
        return { m, dpd, days, complete: dpd != null && days != null && m.frequency !== "as needed (PRN)" };
      })
      .filter((r) => r.complete || r.m.frequency || r.m.duration);
    return rows;
  }, [result]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 sm:px-6" aria-busy="true">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-28" />
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (!result) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <EmptyState title="No care plan yet" body="Generate a care plan in the workspace first — it will appear here with bilingual wording, TTS and its verification state." />
      </div>
    );
  }

  const { plan, report, extraction } = result;

  return (
    <PageShell
      eyebrow="Step 3 · Patient-facing plan"
      title="Your recovery care plan"
      body={`From: ${result.sourceName} · ${plan.medications.length} medicines · ${plan.followUps.length} follow-up(s) · ${plan.warnings.length} warning sign(s)`}
      actions={
        <>
          <button
            type="button"
            className="cb-btn cb-btn-ghost cb-btn-sm"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(planToSpeechText(plan, lang))
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
            }}
            aria-label="Copy the full care plan as text"
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "Copied" : "Copy plan"}
          </button>
          <ListenButton getText={() => planToSpeechText(plan, lang)} />
          <Link href="/print" className="cb-btn cb-btn-ghost cb-btn-sm">
            <Printer size={14} aria-hidden="true" />
            Fridge sheet
          </Link>
          <Link href="/audit" className="cb-btn cb-btn-dark cb-btn-sm">
            <ClipboardList size={14} aria-hidden="true" />
            Evidence audit
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <VerifiedBanner report={report} />
      </div>

      {extraction.header.emergencyContact ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-navy/15 bg-navy px-4 py-3 text-white" role="note">
          <ShieldQuestion size={17} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-[0.88rem] leading-relaxed">
            <span className="font-bold">{lang === "te" ? "అత్యవసర సంప్రదింపు: " : "Emergency contact from your source: "}</span>
            {extraction.header.emergencyContact}
          </p>
        </div>
      ) : null}

      <div className="space-y-5">
        <PlanWhatHappened plan={plan} />

        {/* clinical picture (symptoms / history / tests / allergies) — from source analysis */}
        {(extraction.provider === "gemini" &&
          ((extraction.symptoms?.length ?? 0) > 0 ||
            (extraction.medicalHistory?.length ?? 0) > 0 ||
            (extraction.testResults?.length ?? 0) > 0 ||
            (extraction.allergies?.length ?? 0) > 0)) ? (
          <section className="cb-card p-6" aria-labelledby="ph-clin">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-3 text-white"><ClipboardList size={17} aria-hidden="true" /></span>
              <h2 id="ph-clin" className="font-display text-xl font-semibold text-navy">From your document</h2>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {(extraction.symptoms?.length ?? 0) > 0 ? (
                <div>
                  <p className="cb-eyebrow mb-2">Symptoms noted</p>
                  <ul className="space-y-1.5 text-[0.9rem]">{extraction.symptoms!.map((s, i) => <li key={i} className="rounded-lg bg-ivory px-3 py-1.5">{s}</li>)}</ul>
                </div>
              ) : null}
              {(extraction.medicalHistory?.length ?? 0) > 0 ? (
                <div>
                  <p className="cb-eyebrow mb-2">Relevant history</p>
                  <ul className="space-y-1.5 text-[0.9rem]">{extraction.medicalHistory!.map((s, i) => <li key={i} className="rounded-lg bg-ivory px-3 py-1.5">{s}</li>)}</ul>
                </div>
              ) : null}
              {(extraction.allergies?.length ?? 0) > 0 ? (
                <div>
                  <p className="cb-eyebrow mb-2">Allergies &amp; precautions</p>
                  <ul className="space-y-1.5 text-[0.9rem]">
                    {extraction.allergies!.map((s, i) => (
                      <li key={i} className="rounded-lg border border-alert/30 bg-alert-soft/60 px-3 py-1.5 font-semibold text-alert-deep">{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(extraction.testResults?.length ?? 0) > 0 ? (
                <div>
                  <p className="cb-eyebrow mb-2">Test results (with units)</p>
                  <ul className="space-y-1.5 text-[0.9rem]">
                    {extraction.testResults!.map((t) => (
                      <li key={t.id} className="rounded-lg bg-ivory px-3 py-1.5">
                        <span className="font-semibold text-navy">{t.name}: </span>
                        <span className="doc-font">{t.value ?? "?"}{t.unit ? ` ${t.unit}` : ""}</span>
                        {t.referenceRange ? <span className="text-[0.78rem] text-mist"> (ref {t.referenceRange})</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <PlanMedicines plan={plan} />

        {/* seven-day view — only where frequency AND duration are both stated */}
        <section className="cb-card p-6" aria-labelledby="sdv">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-med-soft text-med-deep">
                <CalendarDays size={17} aria-hidden="true" />
              </span>
              <div>
                <h2 id="sdv" className="font-display text-xl font-semibold text-navy">Seven-day medicine view</h2>
                <p className="text-[0.78rem] text-mist">
                  Doses per day are derived only when <em>both</em> frequency and duration are stated in the source. Exact clock
                  times are <strong>not</strong> invented — the source does not specify them.
                </p>
              </div>
            </div>
          </div>
          <div className="cb-scroll mt-4 overflow-x-auto">
            <table className="cb-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Medicine</th>
                  {Array.from({ length: 7 }, (_, i) => (
                    <th key={i} className="text-center">Day {i + 1}</th>
                  ))}
                  <th className="text-center">Schedule status</th>
                </tr>
              </thead>
              <tbody>
                {sevenDay?.map(({ m, dpd, days, complete }) => (
                  <tr key={m.id}>
                    <td className="min-w-[180px]">
                      <span className="font-bold text-navy">{m.name}</span>
                      <span className="doc-font block text-[0.75rem] text-mist">{m.strength ?? "?"}</span>
                    </td>
                    {Array.from({ length: 7 }, (_, d) => {
                      const within = days != null && d < days;
                      const weekly = normalize(m.frequency ?? "") === "once a week";
                      const count = within ? (weekly ? (d === 0 ? 1 : 0) : dpd) : null;
                      return (
                        <td key={d} className="text-center">
                          {count == null ? (
                            <span className="text-mist/60">—</span>
                          ) : count === 0 ? (
                            <span className="text-mist/40">·</span>
                          ) : (
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-med-soft px-1 text-[0.78rem] font-extrabold text-med-deep">
                              {count}×
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center">
                      {complete ? (
                        <span className="text-[0.75rem] font-semibold text-med-deep">{dpd}/day · {days} days</span>
                      ) : (
                        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[0.7rem] font-bold uppercase text-warn-deep">
                          incomplete — confirm
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <PlanHome plan={plan} />
        <PlanFollowUps plan={plan} />
        <PlanWarnings plan={plan} />
        <PlanQuestions plan={plan} />
      </div>

      <p className="mt-6 max-w-3xl text-[0.8rem] leading-relaxed text-mist">
        Audio playback reads the validated plan text shown on this page — not a separate summary. This plan is an
        education aid based on {result.mode === "demo" ? "a deterministic demo pipeline" : "a live extraction re-checked by the deterministic pipeline"};
        always follow your original clinician instructions and ask your care team about anything unclear.
      </p>
    </PageShell>
  );
}
