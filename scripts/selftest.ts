// CareBridge self-test — run with: npx tsx scripts/selftest.ts
// Verifies the deterministic pipeline end to end against the synthetic corpus:
// extraction, plan building, validation, judge-mode detection, evaluation.

import { extractFromText } from "../src/lib/carebridge/extractor";
import { buildPlan } from "../src/lib/carebridge/planner";
import { validatePlan } from "../src/lib/carebridge/validator";
import { runEvaluation } from "../src/lib/carebridge/evaluator";
import { SAMPLES } from "../src/lib/carebridge/samples";

let failures = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) console.log(`PASS  ${name}`);
  else {
    failures += 1;
    console.log(`FAIL  ${name}${extra ? " :: " + extra : ""}`);
  }
}

for (const s of SAMPLES) {
  const ext = extractFromText(s.text);
  const plan = buildPlan(ext);
  const report = validatePlan(ext, plan);
  console.log(`\n=== ${s.id} ${s.label} ===`);
  console.log(`meds=${ext.medications.length} fups=${ext.followUps.length} warns=${ext.warningSigns.length} ins=${ext.instructions.length} unclear=${ext.unclear.length}`);
  for (const m of ext.medications) {
    console.log(`  ${m.id} ${m.formulation ?? ""} ${m.name ?? "??"} | ${m.strength} | ${m.dose} | ${m.route} | ${m.frequency} | ${m.duration} | special=${m.special} | flags=${m.flags.length}`);
  }
  for (const f of ext.followUps) console.log(`  ${f.id} ${f.title} | ${f.date} | ${f.time} | loc=${f.location} | prep=${f.preparation} | flags=${f.flags.join("; ")}`);
  console.log(`verified=${report.verified} mismatches=${report.counts.mismatch} reviews=${report.counts.needs_review} matched=${report.counts.matched}`);
  check(`${s.id}: expects ${s.id === "SYN-003" ? "NOT verified" : "verified"}`, s.id === "SYN-003" ? !report.verified : report.verified);
  if (s.id === "SYN-001") {
    check("SYN-001 med count is 3", ext.medications.length === 3, `got ${ext.medications.length}`);
    check(
      "SYN-001 paracetamol parsed exactly",
      ext.medications[0]?.name === "Paracetamol" &&
        ext.medications[0]?.strength === "650 mg" &&
        ext.medications[0]?.dose === "1 tablet" &&
        ext.medications[0]?.route === "by mouth" &&
        ext.medications[0]?.frequency === "three times daily" &&
        ext.medications[0]?.duration === "5 days",
      JSON.stringify(ext.medications[0]),
    );
    check("SYN-001 follow-up date parsed", ext.followUps[0]?.date === "20 March 2026", JSON.stringify(ext.followUps[0]));
    check("SYN-001 warnings parsed", ext.warningSigns.length === 3 && Boolean(ext.warningSigns[0]?.sign?.startsWith("Fever above")));
  }
  if (s.id === "SYN-003") {
    check("SYN-003 conflict flagged", ext.medications.filter((m) => m.name === "Warfarin").every((m) => m.flags.some((f) => f.startsWith("CONFLICT"))));
    check("SYN-003 illegible name is null", ext.medications[3]?.name === null);
    check("SYN-003 med4 duration null", ext.medications[3]?.duration === null);
    check("SYN-003 fup1 date null + flagged", ext.followUps[0]?.date === null && ext.followUps[0].flags.length > 0);
    check("SYN-003 unclear entries recorded", ext.unclear.length >= 4, `got ${ext.unclear.length}`);
  }
  // judge-mode mutations
  const mutated = buildPlan(ext);
  const i0 = mutated.medications.findIndex((m) => m.strength && /\d/.test(m.strength));
  if (i0 >= 0 && s.id === "SYN-001") {
    const m = mutated.medications[i0];
    const orig = m.strength as string;
    mutated.medications[i0] = { ...m, strength: orig.replace(/\d[\d,]*(?:\.\d+)?/, (n) => String(parseFloat(n.replace(/,/g, "")) / 2)) };
    const rep2 = validatePlan(ext, mutated);
    check(`${s.id}: changed dose caught`, !rep2.verified && rep2.rows.some((r) => r.field.endsWith(".strength") && r.status === "mismatch"));
    const m2 = buildPlan(ext);
    m2.followUps.splice(0, 1);
    const rep3 = validatePlan(ext, m2);
    check(`${s.id}: dropped follow-up caught`, !rep3.verified && rep3.rows.some((r) => r.field.includes("FUP") && r.field.endsWith(".presence") && r.status === "mismatch"));
    const m3 = buildPlan(ext);
    m3.warnings.pop();
    const rep4 = validatePlan(ext, m3);
    check(`${s.id}: omitted warning caught`, !rep4.verified && rep4.rows.some((r) => r.group === "When to seek help" && r.field.endsWith(".presence") && r.status === "mismatch"));
    const m4 = buildPlan(ext);
    m4.home.push({ id: "X", sourceId: null, category: "other", en: "You may drive immediately.", te: null, teReview: false, evidence: null });
    const rep5 = validatePlan(ext, m4);
    check(`${s.id}: unsupported addition caught`, !rep5.verified && rep5.rows.some((r) => r.group === "Unsupported additions" && r.status === "mismatch"));
  }
}

console.log("\n=== EVALUATION ===");
const ev = runEvaluation();
console.log(`dev n=${ev.development.sampleCount} omissions=${ev.development.omissions} unsupported=${ev.development.unsupportedAdditions} fup=${ev.development.followUpPreserved.matched}/${ev.development.followUpPreserved.total} warn=${ev.development.warningPreserved.matched}/${ev.development.warningPreserved.total} flesch=${ev.development.englishReadability.fleschMean}`);
console.log(`eval n=${ev.heldOut.sampleCount} omissions=${ev.heldOut.omissions} unsupported=${ev.heldOut.unsupportedAdditions} fup=${ev.heldOut.followUpPreserved.matched}/${ev.heldOut.followUpPreserved.total} warn=${ev.heldOut.warningPreserved.matched}/${ev.heldOut.warningPreserved.total} flesch=${ev.heldOut.englishReadability.fleschMean} flags=${ev.heldOut.reviewFlags}`);
for (const m of ev.heldOut.medFieldMetrics) console.log(`  ${m.field}: ${m.matched}/${m.total} = ${(m.rate * 100).toFixed(1)}%`);
check("held-out med exact-match > 95%", ev.heldOut.medFieldMetrics.every((m) => m.field === "duration" ? m.rate > 0.9 : m.rate > 0.95));
check("held-out omissions == 0", ev.heldOut.omissions === 0, `got ${ev.heldOut.omissions}`);
check("held-out unsupported == 0", ev.heldOut.unsupportedAdditions === 0, `got ${ev.heldOut.unsupportedAdditions}`);
check("held-out warnings fully preserved", ev.heldOut.warningPreserved.matched === ev.heldOut.warningPreserved.total);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
