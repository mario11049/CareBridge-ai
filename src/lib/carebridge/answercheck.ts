// Answer faithfulness checks — application-level verification of model answers
// against structured source facts. The model's own claim of compliance is NEVER
// trusted; these checks run in application code before display.

import type { AssistantContext } from "./assistant";
import { normalize } from "./util";

export interface AnswerCheckResult {
  ok: boolean;
  reasons: string[];
}

const CLOCK_TIME_RE = /\b\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?)\b|\b\d{1,2}:\d{2}\b/gi;
const NUMBER_UNIT_RE = /\b\d[\d,]*(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml|tablets?|capsules?|vials?|puffs?|units?|drops?)\b/gi;
const DOSE_ENDORSE_RE =
  /\b(you can|you may|it'?s ok(ay)? to|safe to|go ahead and)\b[^.?!]{0,50}\b(double|increase|decrease|stop|skip|take more|take less|reduce)\b/i;

/** Build the searchable corpus of every value validated from the source. */
export function buildFactCorpus(ctx: AssistantContext | null): {
  units: Set<string>;
  times: Set<string>;
  medNames: string[];
} {
  const units = new Set<string>();
  const times = new Set<string>();
  const medNames: string[] = [];
  if (!ctx) return { units, times, medNames };
  const addNum = (s: string | null, unitPattern: RegExp) => {
    if (!s) return;
    const m = s.match(unitPattern);
    if (m) units.add(normalize(m[0]));
  };
  for (const m of ctx.facts.medications) {
    if (m.name) medNames.push(normalize(m.name));
    addNum(m.strength, /\d[\d,]*(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml)(?:\/\d+\s?ml)?/gi);
    addNum(m.dose, /\d+(?:\.\d+)?\s?(?:tablets?|capsules?|ml|vials?|puffs?|units?|drops?)/gi);
  }
  for (const f of ctx.facts.followUps) {
    if (f.time) {
      const t = f.time.match(/\d{1,2}:\d{2}\s?(?:AM|PM)/i);
      if (t) times.add(normalize(t[0].replace(/\s+/g, " ")));
    }
    if (f.date) {
      const d = f.date.match(/\d{1,2}/);
      if (d) units.add(d[0]);
    }
  }
  const allText = [ctx.facts.emergencyContact ?? "", ...ctx.facts.warningSigns.map((w) => `${w.sign ?? ""} ${w.action ?? ""}`), ctx.sourceExcerpt].join(" ");
  for (const m of allText.matchAll(NUMBER_UNIT_RE)) units.add(normalize(m[0]));
  for (const m of allText.matchAll(CLOCK_TIME_RE)) times.add(normalize(m[0].replace(/\s+/g, " ")));
  return { units, times, medNames };
}

function numOf(numberUnit: string): string {
  const m = numberUnit.match(/[\d,]+(?:\.\d+)?/);
  return m ? m[0].replace(/,/g, "") : "";
}

/**
 * Checks an answer for:
 *  1. invented clock times (any time not present in the source corpus)
 *  2. invented medication quantities (number+unit tokens absent from corpus
 *     while a source medicine name is referenced)
 *  3. dose-alteration endorsement language
 */
export function checkAnswerFaithfulness(answer: string, ctx: AssistantContext | null): AnswerCheckResult {
  const reasons: string[] = [];

  if (DOSE_ENDORSE_RE.test(answer)) {
    reasons.push("Answer appears to endorse changing a medicine dose.");
  }

  if (!ctx) {
    return { ok: reasons.length === 0, reasons };
  }

  const { units, times, medNames } = buildFactCorpus(ctx);
  const answerNorm = normalize(answer);
  const referencesMed = medNames.some((n) => n && answerNorm.includes(n));

  // 1. clock-time invention — only meaningful when the source corpus has no such time
  for (const m of answer.matchAll(CLOCK_TIME_RE)) {
    const t = normalize(m[0].replace(/\s+/g, " "));
    const digits = t.replace(/[^\d:]/g, "");
    const inCorpus = times.has(t) || [...times].some((x) => x.replace(/[^\d:]/g, "") === digits);
    if (!inCorpus) reasons.push(`Answer contains a clock time ("${m[0]}") that is not stated in the source.`);
  }

  // 2. quantity invention when referencing a source medicine
  if (referencesMed) {
    const corpusNumbers = new Set<string>();
    for (const u of units) {
      const n = numOf(u);
      if (n) corpusNumbers.add(n);
    }
    for (const m of answer.matchAll(NUMBER_UNIT_RE)) {
      const token = normalize(m[0]);
      const n = numOf(token);
      // plain years (1900s/2000s) and bare 4-digit date fragments are not medication quantities
      if (n && n.length === 4 && /^(19|20)\d\d$/.test(n)) continue;
      if (!units.has(token)) {
        // reduce false positives: allow the bare number only if it appears with the
        // same unit somewhere in the source document itself
        const bare = new RegExp(`${n.replace(".", "\\.")}\\s?${token.replace(n, "").trim().replace(/\//g, "\\/")}`, "i");
        if (!bare.test(ctx.sourceExcerpt)) {
          reasons.push(`Answer contains quantity "${m[0]}" that is not supported by the source for any listed medicine.`);
        }
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/** Strict schema validation of the model's structured response. */
export function validateReplySchema(raw: unknown): raw is {
  answer: string;
  language: "en" | "te";
  supporting_source_excerpt: string | null;
  uncertainty_status: "confident" | "uncertain";
  needs_human_review: boolean;
  response_type: string;
} {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  if (typeof r.answer !== "string" || r.answer.trim().length < 2 || r.answer.length > 4000) return false;
  if (r.language !== "en" && r.language !== "te") return false;
  if (r.supporting_source_excerpt !== null && typeof r.supporting_source_excerpt !== "string") return false;
  if (typeof r.supporting_source_excerpt === "string" && r.supporting_source_excerpt.length > 600) return false;
  if (r.uncertainty_status !== "confident" && r.uncertainty_status !== "uncertain") return false;
  if (typeof r.needs_human_review !== "boolean") return false;
  if (typeof r.response_type !== "string" || r.response_type.length > 60) return false;
  return true;
}
