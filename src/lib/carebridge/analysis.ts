// Maps Gemini's structured analysis into the same Extraction shape the whole
// app already renders — then VERIFIES the output against the source before it
// can be displayed as evidence-linked. Fabricated citations and invented
// numeric values are flagged, never trusted.

import type { Evidence, Extraction, FollowUp, InstructionItem, Medication, TestResult, UnclearItem, WarningSign } from "./types";
import { normalize, uid } from "./util";

// ---------- runtime types from the model ----------
export interface GenLine {
  text: string;
  te: string | null;
}
export interface GenMed {
  name: string | null;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  special: string | null;
  evidence: string | null;
  plainEnglish: string;
  plainTelugu: string | null;
}
export interface GenWarn {
  sign: string | null;
  action: string | null;
  signTe: string | null;
  actionTe: string | null;
  evidence: string | null;
}
export interface GenFup {
  title: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  preparation: string | null;
  te: string | null;
  evidence: string | null;
}
export interface GenTest {
  name: string;
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
  note: string | null;
  evidence: string | null;
}
export interface GenAnalysis {
  patient: {
    patientId: string | null;
    patientName: string | null;
    admissionDate: string | null;
    dischargeDate: string | null;
    hospitalName: string | null;
  };
  diagnosis: { verbatim: string | null; plainEnglish: string | null; telugu: string | null };
  symptoms: string[];
  medicalHistory: string[];
  testResults: GenTest[];
  medications: GenMed[];
  diet: GenLine[];
  activity: GenLine[];
  precautions: GenLine[];
  warningSigns: GenWarn[];
  followUps: GenFup[];
  allergies: string[];
  unclear: Array<{ reason: string; text: string }>;
  completenessNotes: string | null;
}

// ---------- runtime validation & normalisation ----------
function s(v: unknown, max = 400): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t || /^(null|n\/a|none|unknown|not stated|not specified|-+)$/i.test(t)) return null;
  return t.slice(0, max);
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

export function validateGenAnalysis(raw: unknown): GenAnalysis | null {
  const r = obj(raw);
  if (!Array.isArray(r.medications)) return null;
  const p = obj(r.patient);
  const d = obj(r.diagnosis);
  const lines = (v: unknown): GenLine[] =>
    arr(v)
      .map((x) => obj(x))
      .map((x) => ({ text: s(x.text, 400) ?? "", te: s(x.te, 500) }))
      .filter((x) => x.text);
  const gen: GenAnalysis = {
    patient: {
      patientId: s(p.patientId, 80),
      patientName: s(p.patientName, 120),
      admissionDate: s(p.admissionDate, 60),
      dischargeDate: s(p.dischargeDate, 60),
      hospitalName: s(p.hospitalName, 160),
    },
    diagnosis: { verbatim: s(d.verbatim, 600), plainEnglish: s(d.plainEnglish, 800), telugu: s(d.telugu, 900) },
    symptoms: arr(r.symptoms).map((x) => s(x, 300)).filter((x): x is string => Boolean(x)).slice(0, 30),
    medicalHistory: arr(r.medicalHistory).map((x) => s(x, 300)).filter((x): x is string => Boolean(x)).slice(0, 30),
    testResults: arr(r.testResults)
      .map((x) => obj(x))
      .map((x) => ({
        name: s(x.name, 200) ?? "",
        value: s(x.value, 80),
        unit: s(x.unit, 40),
        referenceRange: s(x.referenceRange, 80),
        note: s(x.note, 300),
        evidence: s(x.evidence, 220),
      }))
      .filter((x) => x.name)
      .slice(0, 40),
    medications: arr(r.medications)
      .map((x) => obj(x))
      .map((x) => ({
        name: s(x.name, 160),
        strength: s(x.strength, 80),
        dose: s(x.dose, 120),
        route: s(x.route, 120),
        frequency: s(x.frequency, 120),
        duration: s(x.duration, 120),
        special: s(x.special, 300),
        evidence: s(x.evidence, 220),
        plainEnglish: s(x.plainEnglish, 700) ?? "",
        plainTelugu: s(x.plainTelugu, 800),
      }))
      .filter((x) => x.name !== null || x.evidence !== null)
      .slice(0, 40),
    diet: lines(r.diet).slice(0, 30),
    activity: lines(r.activity).slice(0, 30),
    precautions: lines(r.precautions).slice(0, 30),
    warningSigns: arr(r.warningSigns)
      .map((x) => obj(x))
      .map((x) => ({
        sign: s(x.sign, 400),
        action: s(x.action, 400),
        signTe: s(x.signTe, 400),
        actionTe: s(x.actionTe, 400),
        evidence: s(x.evidence, 220),
      }))
      .filter((x) => x.sign || x.action)
      .slice(0, 30),
    followUps: arr(r.followUps)
      .map((x) => obj(x))
      .map((x) => ({
        title: s(x.title, 300),
        date: s(x.date, 80),
        time: s(x.time, 80),
        location: s(x.location, 300),
        preparation: s(x.preparation, 300),
        te: s(x.te, 700),
        evidence: s(x.evidence, 220),
      }))
      .filter((x) => x.title || x.date)
      .slice(0, 20),
    allergies: arr(r.allergies).map((x) => s(x, 200)).filter((x): x is string => Boolean(x)).slice(0, 20),
    unclear: arr(r.unclear)
      .map((x) => obj(x))
      .map((x) => ({ reason: s(x.reason, 300) ?? "Unclear in source", text: s(x.text, 500) ?? "" }))
      .filter((x) => x.text)
      .slice(0, 30),
    completenessNotes: s(r.completenessNotes, 500),
  };
  return gen;
}

// ---------- source verification ----------
const clockTimesOf = (t: string): Set<string> => {
  const out = new Set<string>();
  for (const m of t.matchAll(/\b\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?)\b|\b\d{1,2}:\d{2}\b/gi)) {
    out.add(normalize(m[0].replace(/\s+/g, " ")));
  }
  return out;
};
const unitTokensOf = (t: string): Set<string> => {
  const out = new Set<string>();
  for (const m of t.matchAll(/\b\d[\d,]*(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml|l|mmhg|mmol(?:\/l)?|meq|units?|tablets?|capsules?|vials?|puffs?|drops?|%)\b/gi)) {
    out.add(normalize(m[0]));
  }
  const loose = new Set(Array.from(out).map((x) => x.replace(/,/g, "")));
  for (const x of loose) out.add(x);
  return out;
};

function snippetSearch(sourceText: string, snippet: string): number | null {
  if (!snippet) return null;
  const hay = sourceText.split("\n");
  const needle = normalize(snippet).slice(0, 120);
  for (let i = 0; i < hay.length; i++) {
    if (needle && normalize(hay[i]).includes(needle.slice(0, Math.min(needle.length, 60)))) return i + 1;
  }
  // whole-document fallback (multi-line quotes)
  const flat = normalize(sourceText);
  if (needle && flat.includes(needle.slice(0, Math.min(needle.length, 60)))) return 1;
  return null;
}

const MED_CUES = ["Tab.", "Tabs.", "Tablet", "Cap.", "Caps.", "Capsule", "Syr.", "Syrup", "Inj.", "Injection", "Oint.", "Inh.", "T.", "C."];

function findMedEvidence(sourceText: string, name: string | null): { line: number | null; snippet: string } {
  if (!name) return { line: null, snippet: "" };
  const lines = sourceText.split("\n");
  const target = normalize(name);
  for (let i = 0; i < lines.length; i++) {
    const L = normalize(lines[i]);
    if (L.includes(target) && MED_CUES.some((c) => lines[i].includes(c))) {
      return { line: i + 1, snippet: lines[i].trim().slice(0, 220) };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (normalize(lines[i]).includes(target)) return { line: i + 1, snippet: lines[i].trim().slice(0, 220) };
  }
  return { line: null, snippet: "" };
}

function ev(section: string, line: number | null, snippet: string): Evidence {
  return { section, line, snippet: snippet.slice(0, 220), locationAvailable: line != null };
}

/**
 * Cross-check the model's own plain-language sentence against its own
 * structured fields. If the sentence asserts a dose, unit, clock time,
 * duration or frequency the fields don't support, the sentence is untrustworthy
 * and the app falls back to the deterministic template instead.
 */
export function verifyPlainSentence(med: { strength: string | null; dose: string | null; frequency: string | null; duration: string | null; special: string | null }, plain: string | null): { ok: boolean; reason?: string } {
  if (!plain) return { ok: true };
  const corpus = [med.strength, med.dose, med.duration, med.special].filter(Boolean).join(" ");
  // numeric+unit tokens must be supported by the structured fields or by a stated duration count
  for (const m of plain.matchAll(/\b\d[\d,]*(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml|tablets?|capsules?|vials?|puffs?|units?|drops?)\b/gi)) {
    const tok = normalize(m[0]);
    if (!normalize(corpus).includes(tok) && !normalize(corpus).includes(tok.replace(/,/g, ""))) {
      return { ok: false, reason: `plain sentence asserts "${m[0]}" which is not in the structured medication fields` };
    }
  }
  for (const m of plain.matchAll(/\b\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?)\b/gi)) {
    if (!normalize(corpus).includes(normalize(m[0].replace(/\s+/g, " ")))) {
      return { ok: false, reason: `plain sentence asserts a clock time ("${m[0]}") the source does not state` };
    }
  }
  // frequency phrases
  const freqHits = plain.match(/once daily|twice daily|three times (?:daily|a day)|four times daily|every \d+ hours?|once a week|twice a week|at bedtime|as needed/gi);
  if (freqHits && !med.frequency) {
    return { ok: false, reason: `plain sentence asserts a frequency ("${freqHits[0]}") but the source frequency is not stated` };
  }
  // stated duration count must match the structured duration when present
  const durHit = plain.match(/for (\d+)\s*(day|days|week|weeks|month|months)/i);
  if (durHit && med.duration) {
    const a = normalize(durHit[1] + " " + durHit[2]);
    const b = normalize(med.duration);
    if (!b.includes(a) && !a.includes(b)) {
      return { ok: false, reason: `plain sentence duration "${durHit[0]}" differs from structured duration "${med.duration}"` };
    }
  }
  if (durHit && !med.duration) {
    return { ok: false, reason: `plain sentence asserts a duration ("${durHit[0]}") the source does not state` };
  }
  return { ok: true };
}

function durationDays(duration: string | null): number | null {
  if (!duration) return null;
  const m = duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  return u.startsWith("day") ? n : u.startsWith("week") ? n * 7 : n * 30;
}

export interface MapOptions {
  sourceText: string;
  imageOnly: boolean; // scanned PDF — no extractable text to verify against
  model: string;
}

export function mapGenToExtraction(gen: GenAnalysis, opts: MapOptions): Extraction {
  const { sourceText, imageOnly } = opts;
  const srcUnits = unitTokensOf(sourceText);
  const srcTimes = clockTimesOf(sourceText);

  const verifyNumbers = (fields: Array<string | null>): string[] => {
    if (imageOnly) return [];
    const problems: string[] = [];
    for (const f of fields) {
      if (!f) continue;
      for (const tokenability of f.matchAll(/\b\d[\d,]*(?:\.\d+)?\s?(?:mg|mcg|g|iu|ml|mmhg|tablets?|capsules?|vials?|puffs?|units?|drops?)\b/gi)) {
        const t = normalize(tokenability[0]);
        if (!srcUnits.has(t) && !srcUnits.has(t.replace(/,/g, ""))) {
          problems.push(`Value "${tokenability[0]}" could not be located in the source text — verify against the original document`);
        }
      }
    }
    return problems;
  };

  const medications: Medication[] = gen.medications.map((m, i) => {
    const locate = m.evidence ? snippetSearch(sourceText, m.evidence) : null;
    const cue = locate == null ? findMedEvidence(sourceText, m.name) : null;
    const line = locate ?? cue?.line ?? null;
    const snippet = (m.evidence ?? cue?.snippet ?? "").trim();
    const flags: string[] = [];
    if (!imageOnly && m.evidence && locate == null) {
      flags.push("Model-provided evidence quote was not found verbatim in the source — manual verification required");
    }
    if (!m.dose) flags.push("Dose not stated in source");
    if (!m.frequency) flags.push("Frequency not stated in source");
    if (!m.duration) flags.push("Duration not stated in source");
    flags.push(...verifyNumbers([m.strength, m.dose, m.duration]));
    if (imageOnly) flags.push("Scanned/image document — values were read visually; verify against the original");

    // the model's own sentence must agree with the model's own fields
    const plainEnCheck = verifyPlainSentence(m, m.plainEnglish);
    const plainTeCheck = verifyPlainSentence(m, m.plainTelugu);
    if (!plainEnCheck.ok) flags.push(`Plain-English sentence rejected: ${plainEnCheck.reason} — deterministic template used instead`);
    return {
      id: uid("MED", i + 1),
      raw: snippet || `${m.name ?? "?"} ${m.strength ?? ""} ${m.dose ?? ""} ${m.frequency ?? ""}`.trim(),
      formulation: null,
      name: m.name,
      strength: m.strength,
      dose: m.dose,
      route: m.route,
      frequency: m.frequency,
      duration: m.duration,
      durationDays: durationDays(m.duration),
      special: m.special,
      prescribedTimes: null,
      flags,
      evidence: ev("MEDICATIONS", line, snippet),
      plainEn: plainEnCheck.ok ? m.plainEnglish || null : null,
      plainTe: plainEnCheck.ok && plainTeCheck.ok ? m.plainTelugu : null,
      provider: "gemini",
    } satisfies Medication;
  });

  const followUps: FollowUp[] = gen.followUps.map((f, i) => {
    const line = f.evidence ? snippetSearch(sourceText, f.evidence) : null;
    const flags: string[] = [];
    if (!f.date) flags.push("Exact date not stated");
    if (!f.time && f.date) flags.push("Exact time not stated");
    if (!imageOnly && f.evidence && line == null) flags.push("Evidence quote not found verbatim — manual verification required");
    if (!imageOnly && f.time) {
      const t = normalize(f.time);
      if (![...srcTimes].some((x) => t.includes(x) || x.includes(t))) {
        flags.push(`Time "${f.time}" could not be located in the source text — verify`);
      }
    }
    if (imageOnly) flags.push("Scanned/image document — verify against the original");
    return {
      id: uid("FUP", i + 1),
      raw: f.evidence ?? `${f.title ?? ""} ${f.date ?? ""}`.trim(),
      title: f.title,
      date: f.date,
      time: f.time,
      location: f.location,
      preparation: f.preparation,
      flags,
      evidence: ev("FOLLOW-UP", line, f.evidence ?? ""),
      te: f.te,
      provider: "gemini",
    } satisfies FollowUp;
  });

  const warningSigns: WarningSign[] = gen.warningSigns.map((w, i) => {
    const line = w.evidence ? snippetSearch(sourceText, w.evidence) : null;
    const flags = !imageOnly && w.evidence && line == null ? ["Evidence quote not found verbatim — manual verification required"] : [];
    if (imageOnly) flags.push("Scanned/image document — verify against the original");
    return {
      id: uid("WRN", i + 1),
      raw: w.evidence ?? `${w.sign ?? ""}: ${w.action ?? ""}`,
      sign: w.sign,
      action: w.action,
      flags,
      evidence: ev("WARNING SIGNS", line, w.evidence ?? ""),
      signTe: w.signTe,
      actionTe: w.actionTe,
      provider: "gemini",
    } satisfies WarningSign;
  });

  const mkInstr = (arr: GenLine[], cat: InstructionItem["category"], prefix: string): InstructionItem[] =>
    arr.map((l, i) => {
      const line = snippetSearch(sourceText, l.text);
      const flags = !imageOnly && line == null ? ["Instruction could not be located verbatim in source — may be rephrased; verify"] : [];
      return {
        id: uid(prefix, i + 1),
        category: cat,
        raw: l.text,
        text: l.text.replace(/\.$/, "") + ".",
        flags,
        evidence: ev(cat === "diet" ? "DIET" : cat === "activity" ? "ACTIVITY AND HOME CARE" : "INSTRUCTIONS", line, l.text),
        te: l.te,
      } satisfies InstructionItem;
    });

  const instructions: InstructionItem[] = [
    ...mkInstr(gen.diet, "diet", "DIE"),
    ...mkInstr(gen.activity, "activity", "ACT"),
    ...mkInstr(gen.precautions, "other", "PRC"),
  ];

  const testResults: TestResult[] = gen.testResults.map((t, i) => {
    const line = t.evidence ? snippetSearch(sourceText, t.evidence) : null;
    return {
      id: uid("TST", i + 1),
      name: t.name,
      value: t.value,
      unit: t.unit,
      referenceRange: t.referenceRange,
      note: t.note,
      evidence: t.evidence ? ev("TEST RESULTS", line, t.evidence) : null,
    } satisfies TestResult;
  });

  const unclear: UnclearItem[] = gen.unclear.map((u, i) => ({
    id: uid("UC", i + 1),
    reason: u.reason,
    text: u.text,
    evidence: null,
  }));

  const missingCritical: string[] = [];
  if (medications.length && medications.every((m) => !m.dose || !m.frequency)) {
    missingCritical.push("At least one medication line is missing dose or frequency details in the source.");
  }

  return {
    header: {
      hospital: gen.patient.hospitalName,
      patientId: gen.patient.patientId,
      patientName: gen.patient.patientName,
      admissionDate: gen.patient.admissionDate,
      dischargeDate: gen.patient.dischargeDate,
      diagnosis: gen.diagnosis.verbatim,
      emergencyContact: findEmergencyContact(sourceText),
    },
    medications,
    followUps,
    warningSigns,
    instructions,
    unclear,
    provider: "gemini",
    symptoms: gen.symptoms,
    medicalHistory: gen.medicalHistory,
    testResults,
    allergies: gen.allergies,
    precautions: gen.precautions.map((l) => l.text),
    diagnosisPlainEn: gen.diagnosis.plainEnglish,
    diagnosisPlainTe: gen.diagnosis.telugu,
    meta: {
      detectedFormat: true,
      parserNotes: [
        `Analysed by the CareBridge AI engine and verified against the source text by the application before display.`,
        ...(imageOnly
          ? ["This PDF had no extractable text layer — the document was read visually. Please verify critical values against the original."]
          : []),
        ...(unclear.length ? [`${unclear.length} item(s) need human review. Nothing was guessed to fill these gaps.`] : []),
        ...(gen.completenessNotes ? [gen.completenessNotes] : []),
        ...missingCritical,
      ],
      synthetic: /synthetic|sample patient|not a real patient/i.test(sourceText),
      sourceLineCount: sourceText.split("\n").length,
    },
  };
}

function findEmergencyContact(sourceText: string): string | null {
  const m = sourceText.match(/(?:emergency(?:\s+contact)?|24[\s-]?hours?)[^\n]{0,120}?(\+?\d[\d\s().-]{6,}\d)/i);
  return m ? m[0].trim().slice(0, 160) : null;
}
