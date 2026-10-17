"use client";

import { useEffect, useState } from "react";
import { Info, Printer } from "lucide-react";
import { PageShell } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import LangToggle from "@/components/LangToggle";
import { BridgeMark } from "@/components/Logo";
import { useCareBridge } from "@/lib/store";
import { PLAN_TE } from "@/lib/carebridge/telugu";
import type { CarePlan, Extraction, ValidationReport } from "@/lib/carebridge/types";

function FridgeSheet({ plan, extraction, report, lang, sourceName }: { plan: CarePlan; extraction: Extraction; report: ValidationReport; lang: "en" | "te"; sourceName: string }) {
  const te = lang === "te";
  const L = {
    title: te ? "రికవరీ ఫ్రిజ్ షీట్" : "Recovery Fridge Sheet",
    sub: te ? "ఇది మీ డిశ్చార్జ్ సారాంశం యొక్క సరళీకృత రూపం" : "A simplified view of your discharge summary",
    reason: te ? "ఏమి జరిగింది?" : "What happened?",
    meds: te ? PLAN_TE.headings.medicines : "Your medicines",
    follow: te ? PLAN_TE.headings.followUp : "Your follow-up",
    home: te ? PLAN_TE.headings.home : "What to do at home",
    warn: te ? PLAN_TE.headings.warnings : "When to seek help — act immediately",
    questions: te ? `${plan.questions.length} ప్రశ్నలు మీ వైద్య బృందాన్ని అడగాలి (కింద చూడండి)` : `${plan.questions.length} question(s) to ask your care team — these are genuinely unclear in the source and need confirmation.`,
    noQuestions: te ? "అన్ని ముఖ్య వివరాలు మూల పత్రంలో ఉన్నాయి." : "No unresolved details were detected.",
    reviewNote: te
      ? "గమనిక: పసుపు గుర్తులు ఉన్న విషయాలు ఖచ్చితంగా లేవు — ఆసుపత్రిలో నిర్ధారించుకోండి."
      : "Amber-marked items are NOT confirmed in the source — please verify them with the hospital.",
    footer: te
      ? "ఇది విద్యా సహాయక పత్రం మాత్రమే. ఎల్లప్పుడూ మీ అసలు డిశ్చార్జ్ సారాంశంలోని డాక్టర్ సూచనలనే అనుసరించండి."
      : "Educational aid only — always follow the original clinician instructions in your discharge summary.",
  };

  return (
    <article className="print-sheet mx-auto w-full max-w-[190mm] rounded-2xl bg-white p-7 shadow-card" style={{ fontSize: "11pt" }}>
      {/* header */}
      <header className="flex items-start justify-between border-b-2 border-navy pb-3">
        <div className="flex items-center gap-2.5">
          <BridgeMark size={40} />
          <div>
            <p className="text-[15pt] font-extrabold leading-tight tracking-tight text-navy">{L.title}</p>
            <p className="text-[8.5pt] text-mist">{L.sub} · {sourceName}</p>
          </div>
        </div>
        <div className="text-right text-[8.5pt] leading-relaxed text-mist">
          <p>Patient: <strong className="text-navy">{extraction.header.patientId ?? "—"}</strong></p>
          <p>Discharged: <strong className="text-navy">{extraction.header.dischargeDate ?? "not stated"}</strong></p>
          <p>{te ? "భాష" : "Language"}: <strong className="text-navy">{te ? "తెలుగు" : "English"}</strong></p>
        </div>
      </header>

      {/* verification strip */}
      <div className={`mt-2.5 rounded-lg px-3 py-1.5 text-[8.5pt] font-bold ${report.verified ? "bg-med-soft text-med-deep" : "bg-warn-soft text-warn-deep"}`}>
        {report.verified
          ? te
            ? "ఆటోమేటెడ్ తనిఖీలు పూర్తయ్యాయి — ఇది క్లినికల్ భద్రతకు హామీ కాదు."
            : "Automated field checks passed — this is not a guarantee of clinical safety."
          : `${L.reviewNote} (${report.criticalFailures + report.criticalReviews} item(s))`}
      </div>

      {/* reason */}
      <section className="mt-4 print-avoid-break">
        <h2 className="text-[10pt] font-extrabold uppercase tracking-[0.14em] text-navy">{L.reason}</h2>
        <p className={`mt-1 leading-relaxed ${te ? "te" : ""}`}>
          {(te ? plan.whatHappened.te : null) ?? plan.whatHappened.en ?? "Not stated in source."}
        </p>
      </section>

      {/* medicines */}
      <section className="mt-4 print-avoid-break">
        <h2 className="text-[10pt] font-extrabold uppercase tracking-[0.14em] text-navy">{L.meds}</h2>
        <table className="mt-1.5 w-full border-collapse text-[9.5pt]">
          <thead>
            <tr className="border-y-2 border-navy text-left">
              <th className="py-1.5 pr-2">{te ? "ఔషధం (బలం)" : "Medicine (strength)"}</th>
              <th className="py-1.5 pr-2">{te ? "ఎలా తీసుకోవాలి" : "How to take"}</th>
              <th className="py-1.5">{te ? "ప్రత్యేక సూచన" : "Special"}</th>
            </tr>
          </thead>
          <tbody>
            {plan.medications.map((m) => (
              <tr key={m.id} className="border-b border-line align-top">
                <td className="py-1.5 pr-2">
                  <strong className="text-navy">{m.name}</strong>
                  <span className="block text-[8.5pt] text-mist">{m.strength ?? (te ? "బలం లేదు — నిర్ధారించండి" : "strength not stated — confirm")}</span>
                </td>
                <td className={`py-1.5 pr-2 leading-relaxed ${te ? "te" : ""}`}>
                  {te ? m.howTe : m.howEn}
                  {!m.duration || !m.frequency ? (
                    <span className="ml-1 rounded bg-warn-soft px-1 py-0.5 text-[7.5pt] font-bold uppercase text-warn-deep">
                      {te ? "షెడ్యూల్ అసంపూర్ణం" : "schedule incomplete"}
                    </span>
                  ) : null}
                </td>
                <td className={`py-1.5 leading-relaxed ${te && m.specialTe ? "te" : ""}`}>
                  {(te ? m.specialTe ?? m.specialEn : m.specialEn) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[8pt] text-mist">
          {te
            ? "మూల పత్రం సమయాలు పేర్కొనకపోతే మేము సమయపట్టికను తయారు చేయము."
            : "No invented clock times: where the source does not state timing, no timetable is created — ask your care team."}
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-4 print-avoid-break">
        {/* follow-up */}
        <section>
          <h2 className="text-[10pt] font-extrabold uppercase tracking-[0.14em] text-navy">{L.follow}</h2>
          <div className="mt-1.5 space-y-1.5">
            {plan.followUps.map((f) => (
              <div key={f.id} className="rounded-lg bg-ivory p-2.5">
                <p className="font-bold text-navy">{(te ? f.titleTe : null) ?? f.title}</p>
                <p className="text-[9pt]">
                  <strong>{f.date ?? (te ? "తేదీ లేదు — నిర్ధారించండి" : "date NOT STATED — confirm")}</strong>
                  {f.time ? ` · ${f.time}` : ` · ${te ? "సమయం లేదు" : "time NOT STATED"}`}
                </p>
                {f.location ? <p className="text-[8.5pt] text-mist">{f.location}</p> : null}
                {f.preparation ? <p className="text-[8.5pt]">{(te ? f.prepTe : null) ?? f.preparation}</p> : null}
              </div>
            ))}
          </div>
        </section>
        {/* home care */}
        <section>
          <h2 className="text-[10pt] font-extrabold uppercase tracking-[0.14em] text-navy">{L.home}</h2>
          <ul className="mt-1.5 space-y-1">
            {plan.home.map((h) => (
              <li key={h.id} className={`flex gap-1.5 leading-snug ${te && h.te ? "te" : ""}`}>
                <span className="text-med">•</span>
                <span>{(te ? h.te : null) ?? h.en}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* warnings */}
      <section className="mt-4 rounded-xl border-2 border-alert print-avoid-break">
        <h2 className="rounded-t-lg bg-alert px-3 py-1.5 text-[10.5pt] font-extrabold uppercase tracking-[0.1em] text-white">{L.warn}</h2>
        <ul className="divide-y divide-alert/15">
          {plan.warnings.map((w) => (
            <li key={w.id} className="grid grid-cols-[1.25fr_1fr] gap-2 px-3 py-2">
              <span className={`font-bold text-alert-deep ${te && w.signTe ? "te" : ""}`}>{(te ? w.signTe : null) ?? w.sign ?? w.action}</span>
              <span className={`rounded bg-alert-soft px-2 py-1 font-semibold text-alert-deep ${te && w.actionTe ? "te" : ""}`}>
                {(te ? w.actionTe : null) ?? w.action ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {extraction.header.emergencyContact ? (
        <p className="mt-2.5 rounded-lg bg-navy px-3 py-1.5 text-[9.5pt] font-bold text-white print-avoid-break">
          {te ? "అత్యవసర సంప్రదింపు: " : "Emergency contact: "}
          {extraction.header.emergencyContact}
        </p>
      ) : null}

      {/* questions */}
      <section className="mt-3 rounded-xl border border-warn/70 bg-warn-soft p-3 print-avoid-break">
        <p className="text-[9.5pt] font-bold text-warn-deep">
          {plan.questions.length ? L.questions : L.noQuestions}
        </p>
        {plan.questions.slice(0, 5).map((q, i) => (
          <p key={q.id} className={`mt-1 text-[8.5pt] leading-snug ${te && q.te ? "te" : ""}`}>
            {i + 1}. {(te ? q.te : null) ?? q.en}
          </p>
        ))}
        {plan.questions.length > 5 ? <p className="mt-1 text-[8.5pt] text-warn-deep">+{plan.questions.length - 5} more — see the full care plan.</p> : null}
      </section>

      <footer className="mt-4 flex items-center justify-between border-t border-line pt-2 text-[7.5pt] text-mist">
        <p>{L.footer}</p>
        <p>CareBridge AI · {te ? "ప్రోటోటైప్" : "prototype"} · synthetic demo</p>
      </footer>
    </article>
  );
}

export default function PrintPage() {
  const { result, hydrated, lang } = useCareBridge();
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);

  if (!hydrated) return null;
  if (!result) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <EmptyState title="Nothing to print yet" body="Generate a care plan first — the fridge sheet derives strictly from the validated plan." />
      </div>
    );
  }

  return (
    <PageShell
      eyebrow="Step 7 · Printable output"
      title="A4 fridge sheet"
      body="A one-page, high-contrast sheet for the refrigerator door. If content cannot fit legibly, printing flows to a second page rather than shrinking the text."
      actions={
        <div className="no-print flex items-center gap-2">
          <LangToggle compact />
          <button type="button" onClick={() => window.print()} className="cb-btn cb-btn-primary">
            <Printer size={15} aria-hidden="true" />
            Print / Save as PDF
          </button>
        </div>
      }
    >
      <div className="no-print mb-5 flex items-start gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 text-[0.84rem] leading-relaxed text-mist">
        <Info size={15} className="mt-0.5 shrink-0 text-med" aria-hidden="true" />
        <p>
          Use your browser&apos;s <strong>Print → Save as PDF</strong> for a real PDF download. The sheet is laid out for A4 in the
          selected language, derives strictly from the validated plan, and labels incomplete schedules instead of inventing
          times.
        </p>
      </div>
      {shown ? <FridgeSheet plan={result.plan} extraction={result.extraction} report={result.report} lang={lang} sourceName={result.sourceName} /> : null}
    </PageShell>
  );
}
