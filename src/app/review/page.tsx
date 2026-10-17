"use client";

import { AlertTriangle, BadgeInfo, Hospital, Stethoscope } from "lucide-react";
import { PageShell } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import EvidenceChip from "@/components/Evidence";
import { useCareBridge } from "@/lib/store";
import { displayValue } from "@/lib/carebridge/util";
import type { InstructionCategory } from "@/lib/carebridge/types";

function Flags({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="text-xs font-semibold text-med-deep">clean parse</span>;
  return (
    <ul className="space-y-1">
      {flags.map((f, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[0.75rem] leading-snug text-warn-deep">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
          {f}
        </li>
      ))}
    </ul>
  );
}

function V({ v, mono = false }: { v: string | null; mono?: boolean }) {
  if (v == null || v === "")
    return <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[0.72rem] font-bold uppercase tracking-wide text-warn-deep">not stated</span>;
  return <span className={mono ? "doc-font" : ""}>{v}</span>;
}

const CAT_LABEL: Record<InstructionCategory, string> = {
  diet: "Diet",
  activity: "Activity & home care",
  home_care: "Home care",
  other: "Other instructions",
};

export default function ReviewPage() {
  const { result, hydrated } = useCareBridge();
  if (!hydrated) return null;
  if (!result) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <EmptyState title="Nothing to review yet" body="The extraction view shows every structured field the parser found — plus everything it refused to guess. Load a document in the workspace first." />
      </div>
    );
  }

  const e = result.extraction;
  const groups: InstructionCategory[] = ["diet", "activity", "other", "home_care"];

  return (
    <PageShell
      eyebrow="Step 2 · Structured extraction"
      title="Document review & extraction"
      body="Every field below is extracted deterministically and linked to its source line. Blank fields are preserved as “not stated” — never filled in by guessing. Flagged rows need human confirmation."
    >
      {/* header card */}
      <div className="cb-card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white">
              <Hospital size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy">{e.header.hospital ?? "Hospital not detected"}</p>
              <p className="text-xs text-mist">
                Patient ID <V v={e.header.patientId} mono /> · <V v={e.header.patientName} />
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="cb-pill border border-warn/50 bg-warn-soft text-warn-deep">{e.meta.synthetic ? "synthetic document" : "synthetic marker not detected"}</span>
            <span className="cb-pill bg-ivory-2 text-mist">{e.meta.detectedFormat ? "structured layout detected" : "unstructured layout"}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl bg-ivory p-4 text-[0.86rem] sm:grid-cols-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-wider text-mist">Admission</p>
            <V v={e.header.admissionDate} />
          </div>
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-wider text-mist">Discharge</p>
            <V v={e.header.dischargeDate} />
          </div>
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-wider text-mist">Emergency contact</p>
            <V v={e.header.emergencyContact} />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-white p-4">
          <Stethoscope size={17} className="mt-0.5 shrink-0 text-med" aria-hidden="true" />
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-wider text-mist">Diagnosis, as written in the source</p>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-navy">{e.header.diagnosis ?? "Not stated in the source (no Diagnosis: line found)."}</p>
          </div>
        </div>
      </div>

      {/* parser notes */}
      <div className="mb-6 rounded-2xl border border-med-line bg-med-soft px-4 py-3">
        <div className="flex items-start gap-2">
          <BadgeInfo size={16} className="mt-0.5 shrink-0 text-med-deep" aria-hidden="true" />
          <div className="space-y-1">
            {e.meta.parserNotes.map((n, i) => (
              <p key={i} className="text-[0.82rem] leading-relaxed text-med-deep">{n}</p>
            ))}
          </div>
        </div>
      </div>

      {/* medications */}
      <section className="cb-card mb-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[1.02rem] font-bold text-navy">Medications · {e.medications.length}</h2>
          <p className="text-[0.8rem] text-mist">Names, strengths, doses, routes, frequencies, durations — preserved exactly.</p>
        </div>
        <div className="cb-scroll overflow-x-auto">
          <table className="cb-table min-w-[960px]">
            <thead>
              <tr>
                <th>Medicine</th><th>Strength</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Special instructions</th><th>Parser flags</th><th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {e.medications.map((m) => (
                <tr key={m.id} className={m.flags.length ? "bg-warn-soft/40" : undefined}>
                  <td className="font-bold text-navy">
                    {m.formulation ? <span className="mr-1 text-mist">{m.formulation}</span> : null}
                    <V v={m.name} />
                  </td>
                  <td><V v={m.strength} mono /></td>
                  <td><V v={m.dose} /></td>
                  <td><V v={m.route} /></td>
                  <td><V v={m.frequency} /></td>
                  <td><V v={m.duration} /></td>
                  <td className="max-w-[220px]"><V v={m.special} /></td>
                  <td className="max-w-[240px]"><Flags flags={m.flags} /></td>
                  <td><EvidenceChip evidence={m.evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* follow-ups */}
        <section className="cb-card p-5">
          <h2 className="text-[1.02rem] font-bold text-navy">Follow-ups · {e.followUps.length}</h2>
          <div className="mt-4 space-y-3">
            {e.followUps.map((f) => (
              <div key={f.id} className={`rounded-xl border p-4 ${f.flags.length ? "border-warn/50 bg-warn-soft/40" : "border-line bg-ivory"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-navy"><V v={f.title} /></p>
                  <EvidenceChip evidence={f.evidence} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.83rem]">
                  <dt className="text-mist">Date</dt><dd><V v={f.date} mono /></dd>
                  <dt className="text-mist">Time</dt><dd><V v={f.time} mono /></dd>
                  <dt className="text-mist">Location</dt><dd><V v={f.location} /></dd>
                  <dt className="text-mist">Preparation</dt><dd><V v={f.preparation} /></dd>
                </dl>
                <div className="mt-2"><Flags flags={f.flags} /></div>
              </div>
            ))}
            {!e.followUps.length ? <p className="text-sm text-mist">No follow-up instructions found in a parseable form.</p> : null}
          </div>
        </section>

        {/* warning signs */}
        <section className="cb-card p-5">
          <h2 className="text-[1.02rem] font-bold text-navy">Warning signs &amp; stated actions · {e.warningSigns.length}</h2>
          <div className="mt-4 space-y-3">
            {e.warningSigns.map((w) => (
              <div key={w.id} className="rounded-xl border border-alert/30 bg-alert-soft/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-alert-deep"><V v={w.sign} /></p>
                  <EvidenceChip evidence={w.evidence} />
                </div>
                <p className="mt-1.5 text-[0.85rem] text-ink/80">
                  <span className="font-semibold text-alert-deep">Stated action:</span> <V v={w.action} />
                </p>
                <Flags flags={w.flags} />
              </div>
            ))}
            {!e.warningSigns.length ? <p className="text-sm text-mist">No warning-sign section found.</p> : null}
          </div>
        </section>
      </div>

      {/* instructions */}
      <section className="cb-card mt-6 p-5">
        <h2 className="text-[1.02rem] font-bold text-navy">Diet, activity &amp; other instructions · {e.instructions.length}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {groups.map((g) => {
            const items = e.instructions.filter((i) => i.category === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <p className="cb-eyebrow mb-2">{CAT_LABEL[g]}</p>
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="rounded-xl border border-line bg-ivory p-3 text-[0.85rem] leading-relaxed text-ink/85">
                      {i.text}
                      <div className="mt-1.5"><EvidenceChip evidence={i.evidence} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* unclear */}
      <section className="mt-6 rounded-2xl border border-warn/50 bg-warn-soft/60 p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle size={17} className="text-warn-deep" aria-hidden="true" />
          <h2 className="text-[1.02rem] font-bold text-warn-deep">Unclear, missing, conflicting or unreadable · {e.unclear.length}</h2>
        </div>
        {e.unclear.length ? (
          <ul className="mt-4 space-y-2.5">
            {e.unclear.map((u) => (
              <li key={u.id} className="rounded-xl border border-warn/40 bg-white/80 p-3.5">
                <p className="text-sm font-bold text-navy">{u.reason}</p>
                <p className="doc-font mt-1 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-ink/80">{u.text}</p>
                {u.evidence ? <div className="mt-1.5"><EvidenceChip evidence={u.evidence} /></div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.85rem] text-warn-deep">Nothing unclear was detected. The parser found every field it looked for.</p>
        )}
      </section>

      <p className="mt-6 text-[0.8rem] text-mist">
        Raw source preserved verbatim: <span className="doc-font">{displayValue(null)}</span> is shown wherever the source
        gives no value. Missing values are questions for the care team — not blanks to be creatively filled.
      </p>
    </PageShell>
  );
}
