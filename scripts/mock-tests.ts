// CareBridge — MOCKED Gemini unit tests (no network, fully repeatable).
// These exercise the schema validator, the source-verification layer, and the
// failure handling the analysis route depends on — with fabricated model
// outputs that simulate the failure modes the mission requires.
// Run: npx tsx scripts/mock-tests.ts

import { mapGenToExtraction, validateGenAnalysis, type GenAnalysis } from "../src/lib/carebridge/analysis";
import { checkAnswerFaithfulness, validateReplySchema } from "../src/lib/carebridge/answercheck";
import { buildAssistantContext } from "../src/lib/carebridge/assistant";
import { extractFromText } from "../src/lib/carebridge/extractor";
import { buildPlan } from "../src/lib/carebridge/planner";
import { validatePlan } from "../src/lib/carebridge/validator";
import { SAMPLES } from "../src/lib/carebridge/samples";
import type { PipelineResult } from "../src/lib/carebridge/types";

let failures = 0;
const check = (name: string, cond: boolean, extra?: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? " :: " + extra.slice(0, 220) : ""}`);
  if (!cond) failures += 1;
};

const SOURCE = `CITY HOSPITAL — DISCHARGE SUMMARY
Patient ID: MOCK-01
Diagnosis: Acute gastritis.
MEDICATIONS
1. Tab. Pantoprazole 40 mg, take 1 tablet by mouth, once daily, for 14 days. Take before breakfast.
FOLLOW-UP
1. Gastroenterology review on 26 June 2026 at 11:00 AM, Room 5.
WARNING SIGNS
1. Black stools: go to the emergency department.`;

function baseGen(): GenAnalysis {
  return {
    patient: { patientId: "MOCK-01", patientName: null, admissionDate: null, dischargeDate: null, hospitalName: "CITY HOSPITAL" },
    diagnosis: { verbatim: "Acute gastritis.", plainEnglish: "Your stomach lining was inflamed; it improved with treatment.", telugu: "మీ కడుపు పొరకు వాపు వచ్చింది; చికిత్సతో తగ్గింది." },
    symptoms: [],
    medicalHistory: [],
    testResults: [],
    medications: [
      {
        name: "Pantoprazole",
        strength: "40 mg",
        dose: "1 tablet",
        route: "by mouth",
        frequency: "once daily",
        duration: "14 days",
        special: "Take before breakfast.",
        evidence: "Tab. Pantoprazole 40 mg, take 1 tablet by mouth, once daily",
        plainEnglish: "Take 1 tablet by mouth once daily for 14 days, before breakfast.",
        plainTelugu: "ఉదయం అల్పాహారానికి ముందు రోజుకు ఒకసారి 1 టాబ్లెట్ 14 రోజులు వాడండి.",
      },
    ],
    diet: [],
    activity: [],
    precautions: [],
    warningSigns: [
      { sign: "Black stools", action: "go to the emergency department", signTe: "నల్లటి మలం వస్తే", actionTe: "అత్యవసర విభాగానికి వెళ్లండి", evidence: "Black stools: go to the emergency department" },
    ],
    followUps: [
      { title: "Gastroenterology review", date: "26 June 2026", time: "11:00 AM", location: "Room 5", preparation: null, te: null, evidence: "Gastroenterology review on 26 June 2026 at 11:00 AM" },
    ],
    allergies: [],
    unclear: [],
    completenessNotes: null,
  };
}

console.log("=== C. AI integration — mocked model outputs ===");

// 1. well-formed model output passes validation, maps cleanly
{
  const gen = validateGenAnalysis(JSON.parse(JSON.stringify(baseGen())));
  check("valid model output passes schema", gen !== null);
  const ext = mapGenToExtraction(gen!, { sourceText: SOURCE, imageOnly: false, model: "mock" });
  check("medication mapped with evidence located", ext.medications[0].evidence.line != null, JSON.stringify(ext.medications[0].evidence));
  check("no flags on fully-sourced med", ext.medications[0].flags.length === 0, ext.medications[0].flags.join("; "));
  const plan = buildPlan(ext);
  const report = validatePlan(ext, plan);
  check("verified passes for faithful mapped output", report.verified, report.verifiedReason);
  check("plain English used in plan", plan.medications[0].howEn.includes("14 days"));
  check("Telugu used in plan", /[ఁ-౿]/.test(plan.medications[0].howTe));
}

// 2. fabricated evidence quote → flagged, never displayed as verified evidence
{
  const g = baseGen();
  g.medications[0].evidence = "Tab. Pantoprazole 80 mg, take 2 tablets by mouth, four times daily"; // fabricated
  const ext = mapGenToExtraction(validateGenAnalysis(JSON.parse(JSON.stringify(g)))!, { sourceText: SOURCE, imageOnly: false, model: "mock" });
  check("fabricated evidence quote flagged", ext.medications[0].flags.some((f) => /evidence quote/i.test(f) || /not found/i.test(f)), ext.medications[0].flags.join("; "));
}

// 3. invented unit value → flagged
{
  const g = baseGen();
  g.medications[0].strength = "80 mg"; // invented
  g.medications[0].evidence = "Tab. Pantoprazole 40 mg, take 1 tablet by mouth, once daily";
  const ext = mapGenToExtraction(validateGenAnalysis(JSON.parse(JSON.stringify(g)))!, { sourceText: SOURCE, imageOnly: false, model: "mock" });
  check("invented strength flagged", ext.medications[0].flags.some((f) => /80 mg/.test(f)), ext.medications[0].flags.join("; "));
}

// 4. missing frequency/duration → explicit flags, plan still renders with "not stated"
{
  const g = baseGen();
  g.medications[0].frequency = null;
  g.medications[0].duration = null;
  const ext = mapGenToExtraction(validateGenAnalysis(JSON.parse(JSON.stringify(g)))!, { sourceText: SOURCE, imageOnly: false, model: "mock" });
  const plan = buildPlan(ext);
  const report = validatePlan(ext, plan);
  check("missing freq/duration flagged", ext.medications[0].flags.some((f) => /Frequency not stated/.test(f)) && ext.medications[0].flags.some((f) => /Duration not stated/.test(f)));
  check("verified BLOCKED when critical fields missing", !report.verified);
  check("plan does not invent the missing frequency", !/once daily/i.test(plan.medications[0].howEn.replace("before breakfast", "")));
  check("questions generated for missing fields", plan.questions.some((q) => /frequency/i.test(q.en)) && plan.questions.some((q) => /duration/i.test(q.en)));
}

// 5. contradictory entries → both preserved, conflict surfaced
{
  const g = baseGen();
  g.medications.push({ ...g.medications[0], strength: "20 mg" });
  const ext = mapGenToExtraction(validateGenAnalysis(JSON.parse(JSON.stringify(g)))!, { sourceText: SOURCE, imageOnly: false, model: "mock" });
  check("both doses preserved in extraction", ext.medications.length === 2 && ext.medications[1].strength === "20 mg");
  const report = validatePlan(ext, buildPlan(ext));
  // 20 mg is not in source → must be caught by numeric verification
  check("contradictory invented dose flagged", ext.medications[1].flags.some((f) => /20 mg/.test(f)), ext.medications[1].flags.join("; "));
  check("conflict blocks verified", !report.verified);
}

// 6. malformed model payloads rejected by schema validator
{
  check("missing medications array rejected", validateGenAnalysis({ patient: {} }) === null);
  check("null rejected", validateGenAnalysis(null) === null);
  check("string rejected", validateGenAnalysis("{}") === null);
  const tooLong = baseGen();
  (tooLong as unknown as { medications: Array<{ plainEnglish: string }> }).medications[0].plainEnglish = null as never;
  check("normalisation survives null plainEnglish", validateGenAnalysis(JSON.parse(JSON.stringify(tooLong))) !== null);
}

// 7. chat answer-checker with mocked assistant replies
{
  const e = extractFromText(SAMPLES[0].text);
  const p = buildPlan(e);
  const r: PipelineResult = { mode: "demo", extraction: e, plan: p, report: validatePlan(e, p), sourceText: SAMPLES[0].text, sourceName: "s", sampleId: "SYN-001", processedAt: "t" };
  const ctx = buildAssistantContext(r);
  check("mocked good reply passes schema", validateReplySchema({ answer: "ok", language: "en", supporting_source_excerpt: null, uncertainty_status: "confident", needs_human_review: false, response_type: "general" }));
  check("mocked fabricated dose rejected", !checkAnswerFaithfulness("Take Paracetamol 1200 mg three times a day.", ctx).ok);
  check("mocked fabricated time rejected", !checkAnswerFaithfulness("Take it at 7:30 AM.", ctx).ok);
  check("mocked sourced answer accepted", checkAnswerFaithfulness("Take Paracetamol 650 mg, 1 tablet by mouth, three times daily, for 5 days.", ctx).ok);
  check("with no document, dose invented check stays neutral", checkAnswerFaithfulness("Take Paracetamol 650 mg.", null).ok);
}

// 8. image-only (scanned) docs — flagged honestly instead of fake verification
{
  const ext = mapGenToExtraction(validateGenAnalysis(JSON.parse(JSON.stringify(baseGen())))!, { sourceText: "", imageOnly: true, model: "mock" });
  check("scanned docs flagged for visual-reading verification", ext.medications[0].flags.some((f) => /Scanned|visually/i.test(f)), ext.medications[0].flags.join("; "));
  check("parser notes disclose visual reading", ext.meta.parserNotes.some((n) => /visually/i.test(n)));
}

console.log(failures ? `\n${failures} FAILURES` : "\nALL MOCKED TESTS PASSED");
process.exit(failures ? 1 : 0);
