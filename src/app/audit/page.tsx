"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Filter, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import StatusPill from "@/components/StatusPill";
import VerifiedBanner from "@/components/VerifiedBanner";
import EvidenceChip from "@/components/Evidence";
import { useCareBridge } from "@/lib/store";
import type { ReviewStatus } from "@/lib/carebridge/types";
import { clsx } from "@/lib/carebridge/util";

export default function AuditPage() {
  const { result, hydrated } = useCareBridge();
  const [filter, setFilter] = useState<ReviewStatus | "all" | "attention">("attention");

  const grouped = useMemo(() => {
    if (!result) return [];
    const rows = result.report.rows.filter((r) =>
      filter === "all" ? true : filter === "attention" ? r.status !== "matched" : r.status === filter,
    );
    const m = new Map<string, typeof rows>();
    for (const r of rows) m.set(r.group, [...(m.get(r.group) ?? []), r]);
    return [...m.entries()];
  }, [result, filter]);

  if (!hydrated) return null;
  if (!result) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <EmptyState title="No audit to show yet" body="The evidence audit compares every extracted fact with the care plan, field by field. Process a document in the workspace first." />
      </div>
    );
  }

  const { report, plan } = result;
  const filters: Array<{ key: ReviewStatus | "all" | "attention"; label: string; count?: number }> = [
    { key: "attention", label: "Needs attention", count: report.counts.mismatch + report.counts.needs_review },
    { key: "all", label: "All checks", count: report.rows.length },
    { key: "matched", label: "Matched", count: report.counts.matched },
    { key: "needs_review", label: "Needs review", count: report.counts.needs_review },
    { key: "mismatch", label: "Mismatch", count: report.counts.mismatch },
    { key: "not_evaluated", label: "Not evaluated", count: report.counts.not_evaluated },
  ];

  return (
    <PageShell
      eyebrow="Step 4 · Faithfulness engine"
      title="Evidence audit"
      body="Deterministic, field-by-field comparison between the source extraction and the generated plan. No fuzzy dose matching: a value is preserved exactly, missing, or different."
      actions={
        <Link href="/judge" className="cb-btn cb-btn-primary cb-btn-sm">
          Prove it in Judge Mode
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      }
    >
      <div className="mb-6">
        <VerifiedBanner report={report} />
      </div>

      {/* summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["matched", report.counts.matched, "Defined comparisons passed"],
            ["needs_review", report.counts.needs_review, "Ambiguous, missing or conflicting"],
            ["mismatch", report.counts.mismatch, "Meaningful discrepancies"],
            ["not_evaluated", report.counts.not_evaluated, "Could not be checked"],
          ] as Array<[ReviewStatus, number, string]>
        ).map(([s, n, sub]) => (
          <div key={s} className="cb-card p-4">
            <StatusPill status={s} />
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-navy">{n}</p>
            <p className="text-[0.75rem] text-mist">{sub}</p>
          </div>
        ))}
      </div>

      {/* filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter audit rows">
        <Filter size={15} className="text-mist" aria-hidden="true" />
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
              filter === f.key ? "border-navy bg-navy text-white" : "border-line bg-white text-ink/70 hover:border-med hover:text-med-deep",
            )}
            aria-pressed={filter === f.key}
          >
            {f.label}
            {typeof f.count === "number" ? <span className="ml-1.5 opacity-70">{f.count}</span> : null}
          </button>
        ))}
      </div>

      {/* audit table */}
      <div className="space-y-4">
        {grouped.length === 0 ? (
          <div className="cb-card flex items-center gap-3 p-6">
            <ShieldCheck size={20} className="text-med" aria-hidden="true" />
            <p className="text-sm font-semibold text-navy">No rows in this view. Every check in the current filter passed.</p>
          </div>
        ) : (
          grouped.map(([group, rows]) => (
            <section key={group} className="cb-card overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold text-navy">{group}</h2>
              </div>
              <div className="cb-scroll overflow-x-auto">
                <table className="cb-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>Critical field</th>
                      <th>Source value</th>
                      <th>Care-plan value</th>
                      <th>Result</th>
                      <th>Evidence</th>
                      <th>Required action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={clsx(r.status === "mismatch" && "bg-alert-soft/40", r.status === "needs_review" && "bg-warn-soft/40")}>
                        <td className="min-w-[150px]">
                          <span className="font-bold text-navy">{r.label}</span>
                          {r.critical ? <span className="mt-1 block text-[0.65rem] font-extrabold uppercase tracking-wider text-alert">critical</span> : <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-mist">non-blocking</span>}
                        </td>
                        <td className="doc-font max-w-[240px] text-[0.78rem] leading-relaxed">{r.sourceValue}</td>
                        <td className="doc-font max-w-[240px] text-[0.78rem] leading-relaxed">{r.planValue}</td>
                        <td><StatusPill status={r.status} /></td>
                        <td><EvidenceChip evidence={r.evidence} /></td>
                        <td className="max-w-[280px] text-[0.8rem] leading-snug text-ink/80">{r.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>

      {/* EN ↔ TE rendering table */}
      <section className="cb-card mt-8 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[1.02rem] font-bold text-navy">English ↔ Telugu rendering</h2>
          <p className="text-[0.82rem] text-mist">
            Every plan line with its Telugu rendering. Lines preserved in English mean no verified Telugu rendering exists —
            a fluent guess would be worse than honest English.
          </p>
        </div>
        <div className="cb-scroll overflow-x-auto">
          <table className="cb-table min-w-[760px]">
            <thead>
              <tr>
                <th>Section</th>
                <th>English (as validated)</th>
                <th>తెలుగు rendering</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plan.whatHappened.en ? (
                <tr>
                  <td className="font-semibold text-navy">What happened</td>
                  <td className="max-w-[320px]">{plan.whatHappened.en}</td>
                  <td className="te max-w-[320px] leading-relaxed">{plan.whatHappened.te ?? <span className="font-sans text-[0.8rem] text-mist">— preserved in English —</span>}</td>
                  <td><StatusPill status={plan.whatHappened.te ? "matched" : "needs_review"} /></td>
                </tr>
              ) : null}
              {plan.medications.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold text-navy">Medicine · {m.name ?? "unreadable"}</td>
                  <td className="max-w-[320px]">{m.howEn}{m.specialEn ? ` ${m.specialEn}` : ""}</td>
                  <td className="te max-w-[320px] leading-relaxed">
                    {m.howTe}
                    {m.specialTe ? ` ${m.specialTe}` : m.specialEn ? <span className="font-sans text-[0.8rem] text-mist"> (special kept in English)</span> : null}
                  </td>
                  <td><StatusPill status={m.howTeReview || m.specialTeReview ? "needs_review" : "matched"} /></td>
                </tr>
              ))}
              {plan.home.map((h) => (
                <tr key={h.id}>
                  <td className="font-semibold text-navy">Home care</td>
                  <td className="max-w-[320px]">{h.en}</td>
                  <td className="te max-w-[320px] leading-relaxed">{h.te ?? <span className="font-sans text-[0.8rem] text-mist">— preserved in English —</span>}</td>
                  <td><StatusPill status={h.te ? "matched" : "needs_review"} /></td>
                </tr>
              ))}
              {plan.warnings.map((w) => (
                <tr key={w.id}>
                  <td className="font-semibold text-navy">Warning sign</td>
                  <td className="max-w-[320px]">{w.sign ?? ""} → {w.action ?? ""}</td>
                  <td className="te max-w-[320px] leading-relaxed">
                    {w.signTe || w.actionTe ? `${w.signTe ?? w.sign ?? ""} → ${w.actionTe ?? w.action ?? ""}` : <span className="font-sans text-[0.8rem] text-mist">— preserved in English —</span>}
                  </td>
                  <td><StatusPill status={w.signTe && w.actionTe ? "matched" : "needs_review"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
