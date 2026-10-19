// Care-plan builder.
// Constructs the patient-facing plan deterministically from the extraction.
// Every plan item keeps a `sourceId` back to its extracted fact, so the
// validator can trace additions/omissions. Critical values are copied, never
// re-phrased by an unconstrained model. Telugu is composed from the validated
// phrase dictionary; missing coverage is preserved in English + flagged.

import type { CarePlan, Extraction, Medication, PlanFollowUp, PlanInstruction, PlanMed, PlanQuestion, PlanWarning } from "./types";
import {
  DIAGNOSIS_TE,
  FOLLOWUP_PREP_TE,
  FOLLOWUP_TITLE_TE,
  FREQ_TE,
  INSTRUCTION_TE,
  PLAN_TE,
  ROUTE_TE,
  SPECIAL_TE,
  teLookup,
  WARNING_ACTION_TE,
  WARNING_SIGN_TE,
  doseTe,
  durationTe,
} from "./telugu";
import { isBlank, normalize, uid } from "./util";

function verbFor(route: string | null): string {
  const r = (route ?? "").toLowerCase();
  if (r.includes("injection")) return "Receive";
  if (r.includes("applied") || r.includes("skin")) return "Apply";
  if (r.includes("inhalation")) return "Inhale";
  return "Take";
}

function composeHowEn(m: Medication, merged?: Medication[]): { en: string; conflict: boolean } {
  if (merged && merged.length > 1) {
    const versions = merged
      .map((v) => `${v.formulation ? v.formulation + " " : ""}${v.name ?? "?"} ${v.strength ?? "?"} (source line ${v.evidence.line ?? "?"})`)
      .join("; and ");
    return {
      en: `The source lists ${merged.length} CONFLICTING entries for this medicine: ${versions}. Do NOT assume either value — confirm the correct one with your care team before taking it.`,
      conflict: true,
    };
  }
  const verb = verbFor(m.route);
  const doseStr = m.dose ? `${m.dose}${m.route ? " " + m.route : ""}` : "the dose is NOT STATED in the source — confirm before taking";
  const freqStr = m.frequency ?? "how often is NOT STATED — confirm";
  const durStr = m.duration ? `for ${m.duration}` : "for how long is NOT STATED — confirm";
  return { en: `${verb} ${doseStr}, ${freqStr}, ${durStr}.`, conflict: false };
}

function composeHowTe(m: Medication, merged?: Medication[]): { te: string; review: boolean } {
  if (merged && merged.length > 1) {
    return {
      te: `${PLAN_TE.conflict} (${merged.map((v) => `${v.strength ?? "?"} — line ${v.evidence.line ?? "?"}`).join(" / ")})`,
      review: false,
    };
  }
  let review = false;
  const parts: string[] = [];
  if (m.dose) {
    const d = doseTe(m.dose);
    parts.push(d.text);
    if (d.review) review = true;
  } else {
    parts.push("మోతాదు మూల పత్రంలో పేర్కొనలేదు");
  }
  if (m.route) {
    const r = teLookup(ROUTE_TE, m.route);
    if (r) parts.push(r);
    else {
      parts.push(m.route);
      review = true;
    }
  }
  let howOften: string;
  if (m.frequency) {
    const f = teLookup(FREQ_TE, m.frequency);
    if (f) howOften = f;
    else {
      howOften = m.frequency;
      review = true;
    }
  } else howOften = "ఎన్నిసార్లు వాడాలో పేర్కొనలేదు — నిర్ధారించుకోండి";
  let howLong: string;
  if (m.duration) {
    const d = durationTe(m.duration);
    if (d) howLong = d;
    else {
      howLong = `for ${m.duration}`;
      review = true;
    }
  } else howLong = "ఎంతకాలం వాడాలో పేర్కొనలేదు — నిర్ధారించుకోండి";
  return { te: `${parts.join(" ")} తీసుకోండి — ${howOften}, ${howLong}.`, review };
}

export function buildPlan(extraction: Extraction): CarePlan {
  const meds: PlanMed[] = [];
  const used = new Set<string>();

  // group meds by name to merge conflicts into a single safe row
  const groups: Medication[][] = [];
  const index = new Map<string, number>();
  for (const m of extraction.medications) {
    const key = m.name ? normalize(m.name) : `__noname__${m.id}`;
    if (index.has(key)) groups[index.get(key)!].push(m);
    else {
      index.set(key, groups.length);
      groups.push([m]);
    }
  }

  groups.forEach((group, gi) => {
    const m = group[0];
    used.add(m.id);
    const conflict = group.length > 1;
    const howEn = m.provider === "gemini" && m.plainEn && !conflict ? { en: m.plainEn, conflict: false } : composeHowEn(m, conflict ? group : undefined);
    const howTe = m.provider === "gemini" && m.plainTe && !conflict ? { te: m.plainTe, review: false } : composeHowTe(m, conflict ? group : undefined);
    const specialEn = conflict
      ? group
          .map((g) => g.special)
          .filter(Boolean)
          .join(" | ") || null
      : m.special;
    let specialTe: string | null = null;
    let specialTeReview = false;
    if (specialEn) {
      specialTe = teLookup(SPECIAL_TE, conflict ? group[0].special ?? "" : specialEn);
      if (!specialTe) specialTeReview = !conflict;
    }
    const mergedFlags = group.flatMap((g) => g.flags);
    meds.push({
      id: uid("PM", gi + 1),
      sourceId: m.id,
      name: m.name ?? "Unreadable medicine name",
      strength: conflict ? group.map((g) => g.strength ?? "?").join("  /  ") : m.strength,
      dose: conflict ? group.map((g) => g.dose ?? "?").join("  /  ") : m.dose,
      route: conflict ? (group[0].route === group[1]?.route ? group[0].route : null) : m.route,
      frequency: conflict ? (group.every((g) => g.frequency === group[0].frequency) ? group[0].frequency : null) : m.frequency,
      duration: conflict ? (group.every((g) => g.duration === group[0].duration) ? group[0].duration : null) : m.duration,
      prescribedTimes: m.prescribedTimes,
      specialEn,
      specialTe,
      specialTeReview,
      howEn: howEn.en,
      howTe: howTe.te,
      howTeReview: howTe.review,
      flags: mergedFlags,
      evidence: m.evidence,
    });
  });

  const home: PlanInstruction[] = extraction.instructions.map((ins, i) => {
    const te = ins.te ?? teLookup(INSTRUCTION_TE, ins.text);
    return {
      id: uid("PI", i + 1),
      sourceId: ins.id,
      category: ins.category,
      en: ins.text,
      te,
      teReview: te == null,
      evidence: ins.evidence,
    };
  });

  const followUps: PlanFollowUp[] = extraction.followUps.map((f, i) => {
    const titleTe = teLookup(FOLLOWUP_TITLE_TE, f.title);
    const prepTe = teLookup(FOLLOWUP_PREP_TE, f.preparation);
    const summaryTe = f.te ?? null;
    return {
      id: uid("PF", i + 1),
      sourceId: f.id,
      title: f.title,
      date: f.date,
      time: f.time,
      location: f.location,
      preparation: f.preparation,
      titleTe,
      prepTe,
      summaryTe,
      teReview: summaryTe == null && ((f.title != null && titleTe == null) || (f.preparation != null && prepTe == null)),
      evidence: f.evidence,
    };
  });

  const warnings: PlanWarning[] = extraction.warningSigns.map((w, i) => {
    const signTe = w.signTe ?? teLookup(WARNING_SIGN_TE, w.sign);
    const actionTe = w.actionTe ?? teLookup(WARNING_ACTION_TE, w.action);
    return {
      id: uid("PW", i + 1),
      sourceId: w.id,
      sign: w.sign,
      action: w.action,
      signTe,
      actionTe,
      teReview: (w.sign != null && signTe == null) || (w.action != null && actionTe == null),
      evidence: w.evidence,
    };
  });

  const questions: PlanQuestion[] = [];
  const qPush = (en: string, te: string | null, relatedField: string, teReview = false) =>
    questions.push({ id: uid("Q", questions.length + 1), en, te, relatedField, teReview });

  const FIELD_TE: Record<string, string> = PLAN_TE.fieldNames as unknown as Record<string, string>;

  for (const pm of meds) {
    const label = pm.name ?? "one medicine";
    if (pm.flags.some((f) => f.startsWith("CONFLICT"))) {
      qPush(
        `The source lists conflicting versions for ${label}. Which exact version and strength should I take?`,
        `${label} గురించి మూల పత్రంలో విరుద్ధమైన వివరాలు ఉన్నాయి. సరైనది ఏ మోతాదో నిర్ధారించుకోవాలి?`,
        `${pm.sourceId}.conflict`,
      );
    }
    if (label === "Unreadable medicine name") {
      qPush(
        "One medicine name is unreadable in the source. What is this medicine?",
        PLAN_TE.illegible,
        `${pm.sourceId}.name`,
      );
    }
    const missing: string[] = [];
    if (isBlank(pm.strength) && !pm.strength) missing.push("strength");
    if (!pm.dose) missing.push("dose");
    if (!pm.frequency) missing.push("frequency");
    if (!pm.duration) missing.push("duration");
    for (const f of missing) {
      qPush(
        `For ${label}, the ${f} is not stated in the source. What is the correct ${f}?`,
        PLAN_TE.unclearMissing(FIELD_TE[f] ?? f),
        `${pm.sourceId}.${f}`,
      );
    }
  }
  for (const f of followUps) {
    if (!f.date)
      qPush(
        `For "${f.title ?? "a follow-up"}", the exact date is not stated in the source. When exactly should I come?`,
        `«${f.titleTe ?? f.title ?? "ఫాలో-అప్"}» కు ఖచ్చితమైన తేదీ పేర్కొనలేదు. నావు ఏ తేదీన రావాలి?`.replace("నావు", "నేను"),
        `${f.sourceId}.date`,
        f.titleTe == null,
      );
    if (!f.time)
      qPush(
        `For "${f.title ?? "a follow-up"}", the time is not stated. At what time should I come?`,
        `«${f.titleTe ?? f.title ?? "ఫాలో-అప్"}» కు సమయం పేర్కొనలేదు. ఎన్ని గంటలకు రావాలి?`,
        `${f.sourceId}.time`,
        f.titleTe == null,
      );
  }
  for (const u of extraction.unclear) {
    qPush(`Please confirm: ${u.text}`, `దయచేసి నిర్ధారించండి: ${u.text}`, "unclear", true);
  }

  const diagTe = extraction.diagnosisPlainTe ?? teLookup(DIAGNOSIS_TE, extraction.header.diagnosis);
  const teReviewCount =
    meds.reduce((a, m) => a + (m.howTeReview ? 1 : 0) + (m.specialTeReview ? 1 : 0), 0) +
    home.filter((h) => h.teReview).length +
    followUps.filter((f) => f.teReview).length +
    warnings.filter((w) => w.teReview).length +
    questions.filter((q) => q.teReview).length +
    (diagTe == null && extraction.header.diagnosis != null ? 1 : 0);

  return {
    id: `PLAN-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    whatHappened: {
      en: extraction.diagnosisPlainEn ?? extraction.header.diagnosis,
      te: diagTe,
      teReview: diagTe == null && extraction.header.diagnosis != null,
      evidence: extraction.header.diagnosis
        ? { section: "HEADER", line: null, snippet: extraction.header.diagnosis, locationAvailable: false }
        : null,
    },
    medications: meds,
    home,
    followUps,
    warnings,
    questions,
    teReviewCount,
  };
}

