"use client";

import { AlertOctagon, CalendarClock, HelpCircle, Home, Pill, Stethoscope } from "lucide-react";
import { useCareBridge } from "@/lib/store";
import { T } from "@/components/T";
import { PLAN_TE } from "@/lib/carebridge/telugu";
import type { CarePlan } from "@/lib/carebridge/types";

const H = PLAN_TE.headings;

export function PlanWhatHappened({ plan }: { plan: CarePlan }) {
  return (
    <section aria-labelledby="ph-what" className="cb-card p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white"><Stethoscope size={17} aria-hidden="true" /></span>
        <h2 id="ph-what" className="font-display text-xl font-semibold text-navy"><T en="What happened?" te={H.whatHappened} /></h2>
      </div>
      <div className="mt-4 text-[1rem] leading-relaxed text-ink/90">
        <T en={plan.whatHappened.en ?? "The source does not state a reason for admission in a readable way. Ask your care team to explain it."} te={plan.whatHappened.te} teReview={plan.whatHappened.teReview} />
      </div>
      {plan.whatHappened.en ? (
        <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-wider text-mist">
          Written in plain language from the source diagnosis — no new diagnosis has been added.
        </p>
      ) : null}
    </section>
  );
}

export function PlanMedicines({ plan, compact = false }: { plan: CarePlan; compact?: boolean }) {
  const { lang } = useCareBridge();
  return (
    <section aria-labelledby="ph-meds" className="cb-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line p-6 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-med text-white"><Pill size={17} aria-hidden="true" /></span>
        <div>
          <h2 id="ph-meds" className="font-display text-xl font-semibold text-navy"><T en="Your medicines" te={H.medicines} /></h2>
          {!compact ? (
            <p className="text-[0.78rem] text-mist">
              <T
                en="Every value below is copied exactly from your discharge summary. If anything says “not stated”, confirm it before taking that medicine."
                te="కింది విలువలన్నీ మీ డిశ్చార్జ్ సారాంశం నుండి అలాగే కాపీ చేయబడ్డాయి. ఏదైనా «పేర్కొనలేదు» అని ఉంటే, ఆ మందు వాడే ముందు తప్పకుండా నిర్ధారించుకోండి."
              />
            </p>
          ) : null}
        </div>
      </div>
      <div className="cb-scroll overflow-x-auto">
        <table className="cb-table min-w-[820px]">
          <thead>
            <tr>
              <th><T en="Medicine" te={PLAN_TE.medTable.medicine} markReview={false} /></th>
              <th><T en="Exact dose" te={PLAN_TE.medTable.dose} markReview={false} /></th>
              <th><T en="How it is taken" te={PLAN_TE.medTable.howTaken} markReview={false} /></th>
              <th><T en="How long" te={PLAN_TE.medTable.howLong} markReview={false} /></th>
              <th><T en="Special instructions" te={PLAN_TE.medTable.special} markReview={false} /></th>
            </tr>
          </thead>
          <tbody>
            {plan.medications.map((m) => (
              <tr key={m.id} className={m.flags.length ? "bg-warn-soft/40" : undefined}>
                <td className="min-w-[160px]">
                  <p className="font-bold text-navy">{m.name ?? "Unreadable medicine name"}</p>
                  <p className="doc-font mt-0.5 text-[0.78rem] text-mist">{m.strength ?? "strength not stated"}</p>
                  {m.flags.length ? (
                    <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-wide text-warn-deep">review needed</p>
                  ) : null}
                </td>
                <td className="min-w-[120px]">
                  <span className="font-semibold text-navy">{m.dose ?? "Not stated"}</span>
                  <span className="block text-[0.78rem] text-mist">{m.route ?? (m.dose ? "route not stated" : "")}</span>
                </td>
                <td className="max-w-[320px]">
                  <T en={m.howEn} te={m.howTe} teReview={m.howTeReview} className="text-[0.9rem] leading-relaxed" />
                </td>
                <td>
                  {lang === "te" ? (
                    <span className="te font-semibold text-navy">
                      {m.duration ? `${m.duration.replace(" days", " రోజులు").replace(" day", " రోజు").replace(" weeks", " వారాలు").replace(" week", " వారం").replace(" months", " నెలలు").replace(" month", " నెల")}` : "పేర్కొనలేదు"}
                    </span>
                  ) : (
                    <span className="font-semibold text-navy">{m.duration ?? "Not stated"}</span>
                  )}
                </td>
                <td className="max-w-[230px] text-[0.85rem]">
                  {m.specialEn ? (
                    <T en={m.specialEn} te={m.specialTe} teReview={m.specialTeReview} />
                  ) : (
                    <span className="text-mist">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlanHome({ plan }: { plan: CarePlan }) {
  const diet = plan.home.filter((h) => h.category === "diet");
  const act = plan.home.filter((h) => h.category === "activity");
  const oth = plan.home.filter((h) => h.category === "other" || h.category === "home_care");
  const groups = [
    { label: { en: "Food & drink", te: H.diet }, items: diet },
    { label: { en: "Activity & home care", te: H.activity }, items: act },
    { label: { en: "Other instructions", te: H.other }, items: oth },
  ].filter((g) => g.items.length);
  return (
    <section aria-labelledby="ph-home" className="cb-card p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-3 text-white"><Home size={17} aria-hidden="true" /></span>
        <h2 id="ph-home" className="font-display text-xl font-semibold text-navy"><T en="What to do at home" te={H.home} /></h2>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.label.en}>
            <p className="cb-eyebrow mb-2.5"><T en={g.label.en} te={g.label.te} markReview={false} /></p>
            <ul className="space-y-2.5">
              {g.items.map((i) => (
                <li key={i.id} className="rounded-xl bg-ivory p-3 text-[0.9rem] leading-relaxed text-ink/90">
                  <T en={i.en} te={i.te} teReview={i.teReview} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!groups.length ? <p className="text-sm text-mist">No home-care instructions were found in the source.</p> : null}
      </div>
    </section>
  );
}

export function PlanFollowUps({ plan }: { plan: CarePlan }) {
  const { lang } = useCareBridge();
  return (
    <section aria-labelledby="ph-fup" className="cb-card p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-med-deep text-white"><CalendarClock size={17} aria-hidden="true" /></span>
        <h2 id="ph-fup" className="font-display text-xl font-semibold text-navy"><T en="Your follow-up" te={H.followUp} /></h2>
      </div>
      <div className="mt-4 space-y-3">
        {plan.followUps.map((f) => (
          <div key={f.id} className="rounded-xl border border-line bg-ivory p-4">
            <p className="font-bold text-navy">
              {lang === "te" && f.titleTe ? <span className="te">{f.titleTe}</span> : f.title ?? "Follow-up visit"}
            </p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-[0.9rem] sm:grid-cols-[110px_1fr]">
              <dt className="text-mist">{lang === "te" ? <span className="te">తేదీ</span> : "Date"}</dt>
              <dd className="font-semibold text-navy">
                {f.date ?? <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[0.75rem] font-bold uppercase text-warn-deep">not stated — please confirm</span>}
              </dd>
              <dt className="text-mist">{lang === "te" ? <span className="te">సమయం</span> : "Time"}</dt>
              <dd className="font-semibold text-navy">
                {f.time ?? <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[0.75rem] font-bold uppercase text-warn-deep">not stated — please confirm</span>}
              </dd>
              {f.location ? (
                <>
                  <dt className="text-mist">{lang === "te" ? <span className="te">చోటు</span> : "Where"}</dt>
                  <dd>{f.location}</dd>
                </>
              ) : null}
              {f.preparation ? (
                <>
                  <dt className="text-mist">{lang === "te" ? <span className="te">సిద్ధం చేసుకోవడం</span> : "Prepare"}</dt>
                  <dd><T en={f.preparation} te={f.prepTe} teReview={f.teReview} /></dd>
                </>
              ) : null}
            </dl>
          </div>
        ))}
        {!plan.followUps.length ? <p className="text-sm text-mist">No follow-up was found in the source.</p> : null}
      </div>
    </section>
  );
}

export function PlanWarnings({ plan }: { plan: CarePlan }) {
  return (
    <section aria-labelledby="ph-warn" className="cb-card overflow-hidden border-alert/40">
      <div className="flex items-center gap-2.5 bg-alert-soft p-6 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-alert text-white"><AlertOctagon size={17} aria-hidden="true" /></span>
        <div>
          <h2 id="ph-warn" className="font-display text-xl font-semibold text-alert-deep"><T en="When to seek help" te={H.warnings} /></h2>
          <p className="text-[0.78rem] text-alert-deep/80">
            <T
              en="These warning signs and actions are copied from your source document. Do not wait to see if they go away."
              te="ఈ ప్రమాద సంకేతాలు, చర్యలు మీ మూల పత్రం నుండి అలాగే తీసుకోబడ్డాయి. ఇవి కనిపిస్తే ఆలస్యం చేయకండి."
            />
          </p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {plan.warnings.map((w) => (
          <li key={w.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_220px] sm:items-center">
            <p className="text-[0.98rem] font-semibold leading-relaxed text-alert-deep">
              <T en={w.sign ?? w.action ?? "Unreadable warning entry"} te={w.signTe} teReview={w.teReview} />
            </p>
            <p className="rounded-lg bg-alert-soft px-3 py-2 text-[0.85rem] font-semibold leading-snug text-alert-deep">
              <span className="mb-0.5 block text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">Do this</span>
              <T en={w.action ?? "as stated in source"} te={w.actionTe} teReview={w.teReview} />
            </p>
          </li>
        ))}
        {!plan.warnings.length ? <li className="p-5 text-sm text-mist">No warning signs were found in the source.</li> : null}
      </ul>
    </section>
  );
}

export function PlanQuestions({ plan }: { plan: CarePlan }) {
  if (!plan.questions.length) {
    return (
      <section className="cb-card border-med-line bg-med-soft/60 p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-med text-white"><HelpCircle size={17} aria-hidden="true" /></span>
          <h2 className="font-display text-xl font-semibold text-med-deep"><T en="Questions to ask your care team" te={H.questions} /></h2>
        </div>
        <p className="mt-3 text-[0.92rem] text-med-deep">
          <T
            en="No unresolved details were detected — every critical field was found in the source. You can still ask your care team anything you are unsure about."
            te="పరిష్కరించని వివరాలేమీ కనుగొనబడలేదు — అన్ని ముఖ్య వివరాలు మూల పత్రంలో ఉన్నాయి. అయినా సందేహాలు ఉంటే వైద్య బృందాన్ని అడగండి."
          />
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="ph-q" className="cb-card border-warn/50 p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn text-navy"><HelpCircle size={17} aria-hidden="true" /></span>
        <div>
          <h2 id="ph-q" className="font-display text-xl font-semibold text-navy"><T en="Questions to ask your care team" te={H.questions} /></h2>
          <p className="text-[0.78rem] text-mist">
            <T
              en="These come only from details that are genuinely missing or conflicting in the source — they are not advice."
              te="ఇవి మూల పత్రంలో నిజంగా లేని లేదా విరుద్ధమైన వివరాల నుండి మాత్రమే వచ్చాయి — ఇవి సలహాలు కావు."
            />
          </p>
        </div>
      </div>
      <ol className="mt-4 space-y-2.5">
        {plan.questions.map((q, i) => (
          <li key={q.id} className="flex gap-3 rounded-xl bg-ivory p-3.5 text-[0.92rem] leading-relaxed">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-soft text-[0.72rem] font-extrabold text-warn-deep">{i + 1}</span>
            <T en={q.en} te={q.te} teReview={q.teReview} />
          </li>
        ))}
      </ol>
    </section>
  );
}
