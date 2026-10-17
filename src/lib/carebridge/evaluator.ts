// Evaluation engine — runs the REAL extractor + planner + readability code over
// the gold-standard set and measures. Nothing here is hardcoded; every number
// is computed at run time from the same code paths the app uses.

import { extractFromText } from "./extractor";
import { generateCase, GOLD_SEEDS_DEV, GOLD_SEEDS_EVAL, type GoldCase } from "./goldset";
import { buildPlan } from "./planner";
import { readability } from "./readability";
import { exactValue, normalize } from "./util";

export interface FieldMetric {
  field: string;
  matched: number;
  total: number;
  rate: number; // 0..1
}

export interface SetReport {
  sampleCount: number;
  medFieldMetrics: FieldMetric[];
  omissions: number; // gold items absent from extraction output
  unsupportedAdditions: number; // extracted items not present in gold
  followUpPreserved: { matched: number; total: number };
  warningPreserved: { matched: number; total: number };
  reviewFlags: number; // items needing review (parser flags + unclear entries)
  englishReadability: { fleschMean: number; gradeMean: number; easiest: number; hardest: number };
  teluguReadability: "not_applicable";
}

export interface EvalReport {
  generatedAt: string;
  method: string;
  development: SetReport;
  heldOut: SetReport;
}

const MED_FIELDS: Array<{ key: string; get: (m: { name: string | null; strength: string | null; dose: string | null; route: string | null; frequency: string | null; duration: string | null }) => string | null; gold: (m: GoldCase["gold"]["medications"][number]) => string | null }> = [
  { key: "name", get: (m) => m.name, gold: (g) => g.name },
  { key: "strength", get: (m) => m.strength, gold: (g) => g.strength },
  { key: "dose", get: (m) => m.dose, gold: (g) => g.dose },
  { key: "route", get: (m) => m.route, gold: (g) => g.route },
  { key: "frequency", get: (m) => m.frequency, gold: (g) => g.frequency },
  { key: "duration", get: (m) => m.duration, gold: (g) => g.duration },
];

function evaluateSet(seeds: number[]): SetReport {
  const fieldAgg = new Map<string, { matched: number; total: number }>();
  MED_FIELDS.forEach((f) => fieldAgg.set(f.key, { matched: 0, total: 0 }));
  let omissions = 0;
  let unsupported = 0;
  let fupMatched = 0,
    fupTotal = 0,
    warnMatched = 0,
    warnTotal = 0,
    reviewFlags = 0;
  const flesch: number[] = [];
  const grade: number[] = [];

  for (const seed of seeds) {
    const gc: GoldCase = generateCase(seed);
    const ext = extractFromText(gc.text);

    // --- medication fields (multiset matching by name: a parsed med can satisfy one gold med) ---
    const pool = ext.medications.map((m) => ({ m, used: false }));
    for (const gm of gc.gold.medications) {
      // prefer exact full match first, then first remaining same-name
      let idx = pool.findIndex((p) => !p.used && p.m.name && normalize(p.m.name) === normalize(gm.name) && exactValue(p.m.strength, gm.strength));
      if (idx < 0) idx = pool.findIndex((p) => !p.used && p.m.name && normalize(p.m.name) === normalize(gm.name));
      if (idx < 0) {
        omissions += 1;
        for (const f of MED_FIELDS) fieldAgg.get(f.key)!.total += 1; // counts as missed
        continue;
      }
      const pm = pool[idx].m;
      pool[idx].used = true;
      reviewFlags += pm.flags.length > 0 ? 1 : 0;
      for (const f of MED_FIELDS) {
        const agg = fieldAgg.get(f.key)!;
        agg.total += 1;
        const g = f.gold(gm);
        const p = f.get(pm);
        if (g == null && p == null) agg.matched += 1;
        else if (g != null && p != null && exactValue(g, p)) agg.matched += 1;
      }
    }
    // unsupported meds (parsed but left unused)
    for (const p of pool) {
      if (!p.used && p.m.name) unsupported += 1;
      else if (!p.used && !p.m.name) reviewFlags += 1;
    }

    // --- follow ups: date preservation ---
    for (const gf of gc.gold.followUps) {
      fupTotal += 1;
      const hit = ext.followUps.find((f) => f.date && gf.date && exactValue(f.date, gf.date));
      if (hit) fupMatched += 1;
      else omissions += 1;
    }
    reviewFlags += ext.followUps.filter((f) => f.flags.length > 0).length;

    // --- warnings: preservation by sign ---
    for (const gw of gc.gold.warnings) {
      warnTotal += 1;
      const hit = ext.warningSigns.find((w) => w.sign && exactValue(w.sign, gw.sign));
      if (hit) warnMatched += 1;
      else omissions += 1;
    }
    reviewFlags += ext.warningSigns.filter((w) => w.flags.length > 0).length;
    const goldSigns = new Set(gc.gold.warnings.map((w) => normalize(w.sign)));
    for (const w of ext.warningSigns) {
      if (w.sign && !goldSigns.has(normalize(w.sign))) unsupported += 1;
    }

    // --- instruction coverage ---
    const goldIns = new Set(gc.gold.instructions.map((t) => normalize(t)));
    for (const gi of gc.gold.instructions) {
      const hit = ext.instructions.find((i) => exactValue(i.text, gi));
      if (!hit) omissions += 1;
    }
    for (const i of ext.instructions) {
      if (!goldIns.has(normalize(i.text))) unsupported += 1;
    }

    reviewFlags += ext.unclear.length;

    // --- readability of the generated ENGLISH plan ---
    const plan = buildPlan(ext);
    const planText = [
      plan.whatHappened.en ?? "",
      ...plan.medications.map((m) => `${m.name ?? ""} ${m.strength ?? ""}. ${m.howEn} ${m.specialEn ?? ""}`),
      ...plan.home.map((h) => h.en),
      ...plan.followUps.map((f) => `${f.title ?? ""} on ${f.date ?? "date not stated"} at ${f.time ?? "time not stated"}. ${f.preparation ?? ""}`),
      ...plan.warnings.map((w) => `${w.sign ?? ""}: ${w.action ?? ""}.`),
      ...plan.questions.map((q) => q.en),
    ].join(" ");
    const r = readability(planText);
    if (r.words > 20) {
      flesch.push(r.fleschReadingEase);
      grade.push(r.fleschKincaidGrade);
    }
  }

  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    sampleCount: seeds.length,
    medFieldMetrics: MED_FIELDS.map((f) => {
      const a = fieldAgg.get(f.key)!;
      return { field: f.key, matched: a.matched, total: a.total, rate: a.total ? Math.round((a.matched / a.total) * 1000) / 1000 : 0 };
    }),
    omissions,
    unsupportedAdditions: unsupported,
    followUpPreserved: { matched: fupMatched, total: fupTotal },
    warningPreserved: { matched: warnMatched, total: warnTotal },
    reviewFlags,
    englishReadability: {
      fleschMean: Math.round(mean(flesch) * 10) / 10,
      gradeMean: Math.round(mean(grade) * 10) / 10,
      easiest: flesch.length ? Math.max(...flesch) : 0,
      hardest: flesch.length ? Math.min(...flesch) : 0,
    },
    teluguReadability: "not_applicable",
  };
}

export function runEvaluation(): EvalReport {
  return {
    generatedAt: new Date().toISOString(),
    method:
      "Deterministic rule-based extraction + template planner + field-level exact-match comparison. " +
      "Readability: Flesch Reading Ease / Flesch-Kincaid Grade (English only). " +
      "Development seeds 1–10 were used while writing parser rules; held-out seeds 11–50 were not. " +
      "Scores describe synthetic text only and are not a clinical accuracy claim.",
    development: evaluateSet(GOLD_SEEDS_DEV),
    heldOut: evaluateSet(GOLD_SEEDS_EVAL),
  };
}
