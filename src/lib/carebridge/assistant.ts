// CareBridge Assistant — shared core: types, context builder, safety guards.
// Used by the secure API route, the client widget and the test suite.

import type { PipelineResult } from "./types";

export interface AssistantContext {
  docId: string;
  hasDocument: boolean;
  verified: boolean;
  sourceExcerpt: string;
  facts: {
    diagnosis: string | null;
    patientId: string | null;
    dischargeDate: string | null;
    emergencyContact: string | null;
    medications: Array<{
      name: string | null;
      strength: string | null;
      dose: string | null;
      route: string | null;
      frequency: string | null;
      duration: string | null;
      special: string | null;
      needsReview: boolean;
      raw: string;
    }>;
    followUps: Array<{
      title: string | null;
      date: string | null;
      time: string | null;
      location: string | null;
      preparation: string | null;
      needsReview: boolean;
      raw: string;
    }>;
    warningSigns: Array<{ sign: string | null; action: string | null; raw: string }>;
    instructions: string[];
    unclear: string[];
  };
}

export interface AssistantReply {
  answer: string;
  language: "en" | "te";
  supportingSourceExcerpt: string | null;
  uncertaintyStatus: "confident" | "uncertain";
  needsHumanReview: boolean;
  responseType: "medication" | "follow_up" | "warning_sign" | "diet_activity" | "term_explanation" | "safety_refusal" | "general" | "error";
}

export interface AssistantErrorShape {
  code: "no_key" | "invalid_key" | "quota" | "offline" | "timeout" | "bad_response" | "blocked" | "bad_request";
  message: string;
}

/** Cheap, stable document fingerprint — used to isolate conversations per document. */
export function computeDocKey(sampleId: string | null, sourceName: string, processedAt: string, sourceText: string): string {
  const base = `${sampleId ?? "custom"}|${sourceName}|${processedAt}|${sourceText.length}`;
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  return `doc-${h.toString(36)}`;
}

/** Document key for the currently loaded pipeline result (null when no document). */
export function detectDocKeyFromResult(result: PipelineResult | null): string | null {
  if (!result) return null;
  return computeDocKey(result.sampleId, result.sourceName, result.processedAt, result.sourceText);
}

export function buildAssistantContext(result: PipelineResult | null): AssistantContext | null {
  if (!result) return null;
  const e = result.extraction;
  return {
    docId: computeDocKey(result.sampleId, result.sourceName, result.processedAt, result.sourceText),
    hasDocument: true,
    verified: result.report.verified,
    sourceExcerpt: result.sourceText.slice(0, 5200),
    facts: {
      diagnosis: e.header.diagnosis,
      patientId: e.header.patientId,
      dischargeDate: e.header.dischargeDate,
      emergencyContact: e.header.emergencyContact,
      medications: e.medications.map((m) => ({
        name: m.name,
        strength: m.strength,
        dose: m.dose,
        route: m.route,
        frequency: m.frequency,
        duration: m.duration,
        special: m.special,
        needsReview: m.flags.length > 0,
        raw: m.raw,
      })),
      followUps: e.followUps.map((f) => ({
        title: f.title,
        date: f.date,
        time: f.time,
        location: f.location,
        preparation: f.preparation,
        needsReview: f.flags.length > 0,
        raw: f.raw,
      })),
      warningSigns: e.warningSigns.map((w) => ({ sign: w.sign, action: w.action, raw: w.raw })),
      instructions: e.instructions.map((i) => i.text),
      unclear: e.unclear.map((u) => `${u.reason}: ${u.text}`),
    },
  };
}

/** Wrap user/document text so the model treats it strictly as DATA. */
export function wrapUntrusted(tag: string, content: string): string {
  return `<<<${tag}_DATA\n${content}\nEND_${tag}_DATA>>>`;
}

export interface GuardResult {
  triggered: boolean;
  reason?: "dose_alteration" | "diagnosis_request" | "emergency";
}

const DOSE_ALTER_RE =
  /\b(double|triple|half|increase|decrease|raise|lower|reduce|stop|skip|quit|change|adjust)\b[^.?!\n]{0,60}\b(dose|dosage|medicine|medication|tablet|capsule|pill|mg|amount)\b|\b(stop|quit|skip)\s+(taking|using|my)\b|\b(take|taking)\s+(two|three|four|\d+)\s+(instead|more|extra)\b|\bcan\s+i\s+(take\s+)?(double|more|extra|less)\b/i;

const DIAGNOSIS_RE = /\b(what('s| is) wrong with me|diagnose|do i have|is it cancer|am i dying)\b/i;

const EMERGENCY_RE = /\b(chest pain|can'?t breathe|cannot breathe|severe bleeding|unconscious|suicidal|overdose|stroke|heart attack)\b/i;

/**
 * Deterministic pre-flight safety guard. Runs client-side AND server-side.
 * These intents never reach the language model — the answer is a fixed,
 * safe template that cannot be talked out of.
 */
export function preflightGuard(question: string): GuardResult {
  if (EMERGENCY_RE.test(question)) return { triggered: true, reason: "emergency" };
  if (DOSE_ALTER_RE.test(question)) return { triggered: true, reason: "dose_alteration" };
  if (DIAGNOSIS_RE.test(question)) return { triggered: true, reason: "diagnosis_request" };
  return { triggered: false };
}

export const GUARD_REPLIES: Record<NonNullable<GuardResult["reason"]>, { en: string; te: string }> = {
  emergency: {
    en: "This sounds like it could be an emergency. Please do not rely on this chat — seek immediate medical care now (call your local emergency number, e.g. 108 in India, or go to the nearest emergency department). If your discharge summary lists an emergency contact, use it.",
    te: "ఇది అత్యవసర పరిస్థితి కావచ్చు. దయచేసి ఈ చాట్‌పై ఆధారపడవద్దు — వెంటనే వైద్య సహాయం పొందండి (అత్యవసర నంబర్ 108కి కాల్ చేయండి లేదా దగ్గర్లోని అత్యవసర విభాగానికి వెళ్లండి). మీ డిశ్చార్జ్ సారాంశంలో అత్యవసర సంప్రదింపు ఉంటే దాన్ని వాడండి.",
  },
  dose_alteration: {
    en: "I can only explain what your discharge summary says — I cannot endorse changing, stopping, skipping, doubling, or reducing any medicine. Any dose change must be decided by your doctor or pharmacist. Would you like me to repeat the exact dose written in your document?",
    te: "మీ డిశ్చార్జ్ సారాంశంలో ఉన్నది మాత్రమే నేను వివరించగలను — ఏ మందునైనా మార్చడం, ఆపడం, దాటవేయడం, రెట్టింపు చేయడం లేదా తగ్గించడం గురించి నేను సమ్మతించలేను. మోతాదు మార్పు మీ డాక్టర్ లేదా ఫార్మసిస్ట్ మాత్రమే నిర్ణయించాలి. మీ పత్రంలో ఉన్న ఖచ్చితమైన మోతాదును మళ్లీ చెప్పమంటారా?",
  },
  diagnosis_request: {
    en: "I cannot diagnose conditions or guess what might be wrong. I can only explain the instructions and terms in your loaded discharge document. For any new symptoms or concerns, please speak with your doctor.",
    te: "నేను వ్యాధిని నిర్ధారించలేను (డైగ్నోసిస్) లేదా ఏమై ఉంటుందో ఊహించలేను. మీరు లోడ్ చేసిన డిశ్చార్జ్ పత్రంలోని సూచనలు, పదాలను మాత్రమే వివరించగలను. కొత్త లక్షణాలు లేదా సందేహాలకు మీ డాక్టర్‌ను సంప్రదించండి.",
  },
};

export function suggestedQuestions(hasDocument: boolean, lang: "en" | "te"): string[] {
  if (lang === "te") {
    return hasDocument
      ? ["నా మందులు వివరించండి", "ఈ మందును ఎన్నిసార్లు వాడాలి?", "నా ఫాలో-అప్ సూచనలు చెప్పండి", "ప్రమాద సంకేతాలు ఏమిటి?", "ఈ వైద్య పదం అర్థం ఏమిటి?"]
      : ["కేర్‌బ్రిడ్జ్ ఎలా పనిచేస్తుంది?", "ఈ వైద్య పదం అర్థం ఏమిటి?", "నా పత్రాన్ని ఎలా లోడ్ చేయాలి?"];
  }
  return hasDocument
    ? ["Explain my medicines.", "How often should I take this medicine?", "Explain my follow-up instructions.", "What does this medical term mean?", "Explain my care plan in Telugu."]
    : ["How does CareBridge work?", "What does this medical term mean?", "How do I load my document?"];
}

export const MAX_QUESTION_CHARS = 1000;
export const MAX_HISTORY_ITEMS = 12;
export const MAX_HISTORY_CHARS = 1500;
export const MAX_CONTEXT_CHARS = 16_000;
