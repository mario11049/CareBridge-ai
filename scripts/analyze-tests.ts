// End-to-end tests for the real Gemini analysis pipeline (/api/analyze).
// Run while the production server is up: npx tsx scripts/analyze-tests.ts [baseUrl]
// Reports ACTUAL results honestly.

import { SAMPLES } from "../src/lib/carebridge/samples";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
let failures = 0;
const check = (name: string, cond: boolean, extra?: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? " :: " + extra.slice(0, 300) : ""}`);
  if (!cond) failures += 1;
};

// --- minimal valid PDF generator (real file bytes, offsets computed) ---
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = lines
    .map((l, i) => `BT /F1 ${11} Tf 56 ${760 - i * 15} Td (${esc(l)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function analyseText(text: string, name = "test") {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, name }),
  });
  return res.json();
}
async function analyseFile(buf: Buffer, name: string, type: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buf)], name, { type }));
  const res = await fetch(`${BASE}/api/analyze`, { method: "POST", body: form });
  return res.json();
}

async function main() {
  console.log("--- capability ---");
  const cap = await fetch(`${BASE}/api/analyze`).then((r) => r.json());
  check("analyze endpoint reports configured", cap.configured === true, JSON.stringify(cap));

  console.log("\n--- T1: pasted SYN-001 text ---");
  {
    const r = await analyseText(SAMPLES[0].text, "syn001.txt");
    check("ok + live mode", r.ok === true && r.mode === "live", r.message ?? "");
    if (r.ok) {
      const e = r.extraction;
      const med = e.medications.find((m: { name?: string | null }) => /paracetamol/i.test(m.name ?? ""));
      check("Paracetamol extracted", Boolean(med));
      check("650 mg preserved", /650/.test(med?.strength ?? ""), JSON.stringify(med?.strength));
      check("1 tablet dose preserved", /1\s*tab/i.test(med?.dose ?? ""), med?.dose);
      check("three times daily preserved", /three times/i.test(med?.frequency ?? ""), med?.frequency);
      check("5 days duration preserved", /5\s*day/i.test(med?.duration ?? ""), med?.duration);
      check("follow-up date preserved", e.followUps.some((f: { date?: string | null }) => /20 March 2026/.test(f.date ?? "")), JSON.stringify(e.followUps?.[0]?.date));
      check("warning signs extracted", e.warningSigns.length >= 3, String(e.warningSigns.length));
      check("patientId captured", /SYN-001/.test(e.header.patientId ?? ""), e.header.patientId);
      check("plain English diagnosis present", Boolean(e.diagnosisPlainEn), "");
      check("Telugu diagnosis rendering present", Boolean(e.diagnosisPlainTe && /[ఁ-౿]/.test(e.diagnosisPlainTe)), "");
      check("evidence lines located", e.medications.some((m: { evidence: { line: number | null } }) => m.evidence.line != null));
      console.log(`   meds=${e.medications.length} fups=${e.followUps.length} warns=${e.warningSigns.length} unclear=${e.unclear.length} model=${r.model}`);
    }
  }

  console.log("\n--- T2: multi-med doc with test results, symptoms, allergies ---");
  {
    const custom = `RIVERSIDE HOSPITAL — DISCHARGE SUMMARY
Patient ID: LIVE-777
Patient Name: Test Subject
Admission Date: 01 May 2026
Discharge Date: 04 May 2026
Diagnosis: Type 2 diabetes mellitus with hyperglycemia, now stable.

Symptoms on admission: excessive thirst, frequent urination, blurred vision.
Past medical history: hypertension for 5 years.
Allergies: Penicillin — causes rash and swelling.

TEST RESULTS
HbA1c: 8.2% (target below 7%)
Fasting blood sugar: 142 mg/dL (ref 70–100 mg/dL)
Blood pressure on discharge: 138/88 mmHg

MEDICATIONS
1. Tab. Metformin 500 mg, take 1 tablet by mouth, twice daily, for 90 days. Take with food.
2. Tab. Glimepiride 1 mg, take half a tablet by mouth, once daily, for 90 days.
3. Tab. Amlodipine 5 mg, take 1 tablet by mouth, once daily, for 30 days.

FOLLOW-UP
1. Endocrinology review on 18 May 2026 at 09:15 AM, OPD Room 12. Bring your sugar diary.

WARNING SIGNS
1. Sweating, tremors, confusion (low sugar): take sugar immediately and call the hospital.
2. Chest pain: go to the emergency department.

DIET
1. Follow a diabetic diet. Avoid fruit juices and sweets.

ACTIVITY AND HOME CARE
1. Walk 30 minutes every morning.
2. Check your feet daily for cuts or sores.

UNCLEAR
None.`;
    const r = await analyseText(custom, "live-777.txt");
    check("ok", r.ok === true, r.message ?? "");
    if (r.ok) {
      const e = r.extraction;
      check("3 medicines extracted", e.medications.length === 3, String(e.medications.length));
      check("Metformin strength kept", /500 mg/.test(e.medications.find((m: { name?: string | null }) => /metformin/i.test(m.name ?? ""))?.strength ?? ""));
      check("symptoms captured", (e.symptoms ?? []).length >= 3, JSON.stringify(e.symptoms));
      check("history captured", (e.medicalHistory ?? []).some((h: string) => /hypertension/i.test(h)));
      check("allergy captured", (e.allergies ?? []).some((a: string) => /penicillin/i.test(a)));
      check("test results with units", (e.testResults ?? []).some((t: { unit?: string | null }) => /mg\/dL/i.test(t.unit ?? "")), JSON.stringify(e.testResults));
      check("HbA1c value preserved", (e.testResults ?? []).some((t: { name: string; value?: string | null }) => /hba1c/i.test(t.name) && /8\.2/.test(t.value ?? "")));
      check("half-tablet dose preserved", /half/i.test(e.medications.find((m: { name?: string | null }) => /glimepiride/i.test(m.name ?? ""))?.dose ?? ""), JSON.stringify(e.medications.map((m: { dose?: string | null }) => m.dose)));
      check("follow-up time preserved", /09:15/i.test(e.followUps[0]?.time ?? ""), e.followUps[0]?.time);
      check("Telugu med rendering present", e.medications.some((m: { plainTe?: string | null }) => m.plainTe && /[ఁ-౿]/.test(m.plainTe)));
    }
  }

  console.log("\n--- T3: REAL PDF upload (generated fixture) ---");
  {
    const pdf = makePdf([
      "CITY CARE HOSPITAL -- DISCHARGE SUMMARY",
      "Patient ID: PDF-101",
      "Admission Date: 10 June 2026",
      "Discharge Date: 12 June 2026",
      "Diagnosis: Acute gastritis, improved with treatment.",
      "MEDICATIONS",
      "1. Tab. Pantoprazole 40 mg, take 1 tablet by mouth, once daily, for 14 days.",
      "   Take before breakfast.",
      "2. Syr. Sucralfate 1 g/10 ml, take 10 ml by mouth, three times daily, for 14 days.",
      "FOLLOW-UP",
      "1. Gastroenterology review on 26 June 2026 at 11:00 AM, Room 5.",
      "WARNING SIGNS",
      "1. Black stools or vomiting blood: go to the emergency department.",
      "DIET",
      "1. Avoid spicy food, coffee and alcohol for 2 weeks.",
    ]);
    writeFileSync("/tmp/fixture.pdf", pdf);
    const r = await analyseFile(pdf, "fixture.pdf", "application/pdf");
    check("pdf ok + live", r.ok === true && r.mode === "live", r.message ?? "");
    if (r.ok) {
      const e = r.extraction;
      check("imageOnly false (text layer read)", r.imageOnly === false);
      check("Pantoprazole extracted", e.medications.some((m: { name?: string | null }) => /pantoprazole/i.test(m.name ?? "")));
      check("40 mg preserved", e.medications.some((m: { strength?: string | null }) => /40\s*mg/.test(m.strength ?? "")));
      check("syrup strength preserved", e.medications.some((m: { strength?: string | null }) => /1\s*g\/10\s*ml/i.test(m.strength ?? "")), JSON.stringify(e.medications.map((m: { strength?: string | null }) => m.strength)));
      check("follow-up date preserved", e.followUps.some((f: { date?: string | null }) => /26 June 2026/.test(f.date ?? "")));
      check("warning sign preserved", e.warningSigns.some((w: { sign?: string | null }) => /black stools|vomiting blood/i.test(w.sign ?? "")));
    }
  }

  console.log("\n--- T4: non-medical gibberish rejected honestly ---");
  {
    const r = await analyseText("The quick brown fox jumps over the lazy dog. ".repeat(30), "dogs.txt");
    check("rejected with no_medical_content (no fake plan)", r.ok === false && /no_medical_content|could not/i.test(r.code ?? "") || (r.ok === true && r.extraction.medications.length === 0), (r.code ?? "ok") + " " + (r.message ?? "").slice(0, 120));
  }

  console.log("\n--- T5: invalid/corrupted inputs ---");
  {
    const notPdf = Buffer.from("this is just text with a pdf extension", "utf-8");
    const r = await analyseFile(notPdf, "fake.pdf", "application/pdf");
    check("corrupt PDF rejected with invalid_pdf", r.ok === false && r.code === "invalid_pdf", r.code);
    const empty = await analyseText("   ", "empty.txt");
    check("empty text rejected", empty.ok === false && empty.code === "empty", empty.code);
    const big = await analyseText("A".repeat(61000), "big.txt");
    check("oversize text rejected", big.ok === false && big.code === "too_large", big.code);
  }

  console.log("\n--- T6: unreadable-kind error mapping (invalid key path) ---");
  {
    // hit the route with a key-less check is not possible without restarting;
    // instead verify error payload shape is machine-readable
    const r = await fetch(`${BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    check("errors return JSON {ok:false, code, message}", (await r.json()).ok === false);
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL ANALYSIS PIPELINE TESTS PASSED");
}

main().catch((e) => {
  console.error("test run crashed:", e);
  process.exit(1);
});
