// The Faithfulness Engine.
// Deterministic, field-by-field comparison between the extracted source facts
// and the generated care plan. No fuzzy dose similarity, no vibes — a value is
// either exactly preserved (after meaning-safe normalisation), absent, or
// different. Critical failures block the verified state.

import type { AuditRow, CarePlan, Extraction, ReviewStatus, ValidationReport } from "./types";
import { exactValue, isBlank, normalize, uid } from "./util";

interface RowSpec {
  group: string;
  field: string;
  label: string;
  critical: boolean;
  sourceValue: string;
  planValue: string;
  status: ReviewStatus;
  action: string;
  evidenceLine?: number | null;
  evidenceSection?: string | null;
  evidenceSnippet?: string | null;
}

export function validatePlan(extraction: Extraction, plan: CarePlan): ValidationReport {
  const rows: AuditRow[] = [];
  const push = (r: RowSpec) =>
    rows.push({
      id: uid("ROW", rows.length + 1),
      group: r.group,
      field: r.field,
      label: r.label,
      critical: r.critical,
      sourceValue: r.sourceValue,
      planValue: r.planValue,
      status: r.status,
      evidence:
        r.evidenceSnippet != null
          ? {
              section: r.evidenceSection ?? "SOURCE",
              line: r.evidenceLine ?? null,
              snippet: r.evidenceSnippet,
              locationAvailable: r.evidenceLine != null,
            }
          : null,
      action: r.action,
    });

  const cmp = (opts: {
    group: string;
    field: string;
    label: string;
    source: string | null;
    plan: string | null;
    critical?: boolean;
    flagged?: boolean;
    actionMatched?: string;
    actionReview?: string;
    evidence?: { line: number | null; section: string; snippet: string } | null;
    optional?: boolean;
    /** an additional accepted plan value (e.g. a plain-language rendering of the same field) */
    alsoAccept?: string | null;
  }) => {
    const { group, field, label, source, plan } = opts;
    const critical = opts.critical !== false;
    let status: ReviewStatus;
    let action: string;
    if (isBlank(source) && isBlank(plan)) {
      status = opts.optional ? "not_evaluated" : "needs_review";
      action = opts.optional ? "Nothing to check — field absent in both source and plan." : "Value is absent in both source and plan. Confirm with the care team.";
    } else if (isBlank(source)) {
      status = "needs_review";
      action = "Source does not state this value. The plan correctly left it open — confirm with the care team.";
    } else if (isBlank(plan)) {
      status = isBlank(source) ? "needs_review" : "mismatch";
      action = "Present in source but MISSING from the care plan. Restore it exactly as written.";
    } else if (opts.flagged) {
      status = "needs_review";
      action = opts.actionReview ?? "Source is ambiguous/conflicting for this field — human review required.";
    } else if (exactValue(source, plan) || (opts.alsoAccept != null && exactValue(opts.alsoAccept, plan))) {
      status = "matched";
      action = opts.actionMatched ?? "No action needed.";
    } else {
      status = "mismatch";
      action = "Plan value differs from the source value. Correct the plan or re-run generation.";
    }
    push({
      group,
      field,
      label,
      critical,
      sourceValue: isBlank(source) ? "Not stated in source" : (source as string),
      planValue: isBlank(plan) ? "—" : (plan as string),
      status,
      action,
      evidenceLine: opts.evidence?.line ?? null,
      evidenceSection: opts.evidence?.section ?? null,
      evidenceSnippet: opts.evidence?.snippet ?? null,
    });
  };

  // ---- diagnosis ----
  // The plan may show either the verbatim diagnosis or the validated
  // plain-language rendering of it — both preserve meaning.
  cmp({
    group: "What happened",
    field: "diagnosis",
    label: "Reason for admission (as written)",
    source: extraction.header.diagnosis,
    plan: plan.whatHappened.en,
    alsoAccept: extraction.diagnosisPlainEn ?? null,
    actionReview: "No diagnosis found in source — plan must not invent one.",
    actionMatched: extraction.diagnosisPlainEn
      ? "Diagnosis preserved; plain-language explanation shown alongside it."
      : "No action needed.",
  });

  // ---- medications ----
  const srcMeds = extraction.medications;
  const planMeds = plan.medications;
  const planBySource = new Map(planMeds.filter((p) => p.sourceId).map((p) => [p.sourceId as string, p]));

  for (const m of srcMeds) {
    const pm = planBySource.get(m.id);
    const g = `Medicines — ${m.name ?? "unreadable name"}`;
    const ev = { line: m.evidence.line, section: m.evidence.section, snippet: m.evidence.snippet };
    if (!pm) {
      push({
        group: g,
        field: `${m.id}.presence`,
        label: "Medicine present in care plan",
        critical: true,
        sourceValue: m.raw,
        planValue: "— OMITTED —",
        status: "mismatch",
        action: "This medicine from the source is missing in the care plan. Add it back with all source values.",
        evidenceLine: ev.line,
        evidenceSection: ev.section,
        evidenceSnippet: ev.snippet,
      });
      continue;
    }
    const conflicted = m.flags.some((f) => f.startsWith("CONFLICT"));
    cmp({ group: g, field: `${m.id}.name`, label: "Medicine name", source: m.name, plan: pm.name === "Unreadable medicine name" ? null : pm.name, critical: true, flagged: pm.flags.some((f) => /illegible|could not be read/i.test(f)), actionReview: "Name unreadable in source — do not guess it.", evidence: ev });
    if (conflicted) {
      push({
        group: g,
        field: `${m.id}.strength`,
        label: "Strength",
        critical: true,
        sourceValue: srcMeds.filter((x) => normalize(x.name) === normalize(m.name)).map((x) => x.strength ?? "?").join("  /  "),
        planValue: pm.strength ?? "—",
        status: "needs_review",
        action: "The source itself conflicts on this value. The plan must NOT pick one silently — confirm with the care team.",
        evidenceLine: ev.line,
        evidenceSection: ev.section,
        evidenceSnippet: ev.snippet,
      });
    } else {
      cmp({ group: g, field: `${m.id}.strength`, label: "Strength", source: m.strength, plan: pm.strength, critical: true, evidence: ev });
      cmp({ group: g, field: `${m.id}.dose`, label: "Dose & unit", source: m.dose, plan: pm.dose, critical: true, flagged: m.flags.some((f) => /dose not stated|amount missing/i.test(f)), evidence: ev });
      cmp({ group: g, field: `${m.id}.route`, label: "Route", source: m.route, plan: pm.route, critical: true, flagged: m.flags.some((f) => /route not stated/i.test(f)), optional: isBlank(m.route), evidence: ev });
      cmp({ group: g, field: `${m.id}.frequency`, label: "Frequency", source: m.frequency, plan: pm.frequency, critical: true, flagged: m.flags.some((f) => /frequency not stated/i.test(f)), evidence: ev });
      cmp({ group: g, field: `${m.id}.duration`, label: "Duration", source: m.duration, plan: pm.duration, critical: true, flagged: m.flags.some((f) => /duration not stated/i.test(f)), evidence: ev });
      cmp({ group: g, field: `${m.id}.special`, label: "Special instructions", source: m.special, plan: pm.specialEn, critical: false, optional: isBlank(m.special) && isBlank(pm.specialEn), evidence: ev });
    }
  }

  // unsupported med additions
  for (const pm of planMeds) {
    if (!pm.sourceId || !srcMeds.find((m) => m.id === pm.sourceId)) {
      push({
        group: "Unsupported additions",
        field: `${pm.id}.unsupported`,
        label: "Medicine with no source evidence",
        critical: true,
        sourceValue: "— not present in source —",
        planValue: `${pm.name ?? "?"} ${pm.strength ?? ""}`.trim(),
        status: "mismatch",
        action: "This item appears in the care plan without any source evidence. Remove it or cite exact source text.",
      });
    }
  }

  // ---- follow-ups ----
  const planFupBySource = new Map(plan.followUps.filter((p) => p.sourceId).map((p) => [p.sourceId as string, p]));
  for (const f of extraction.followUps) {
    const pf = planFupBySource.get(f.id);
    const g = `Follow-up — ${f.title ?? "visit"}`;
    const ev = { line: f.evidence.line, section: f.evidence.section, snippet: f.evidence.snippet };
    if (!pf) {
      push({
        group: g,
        field: `${f.id}.presence`,
        label: "Follow-up present in care plan",
        critical: true,
        sourceValue: f.raw,
        planValue: "— OMITTED —",
        status: "mismatch",
        action: "This follow-up from the source is missing in the care plan.",
        evidenceLine: ev.line,
        evidenceSection: ev.section,
        evidenceSnippet: ev.snippet,
      });
      continue;
    }
    cmp({ group: g, field: `${f.id}.date`, label: "Date", source: f.date, plan: pf.date, critical: true, flagged: f.flags.some((x) => /date/i.test(x)), evidence: ev });
    cmp({ group: g, field: `${f.id}.time`, label: "Time", source: f.time, plan: pf.time, critical: true, flagged: f.flags.some((x) => /time/i.test(x)), optional: isBlank(f.time) && isBlank(pf.time), evidence: ev });
    cmp({ group: g, field: `${f.id}.location`, label: "Location", source: f.location, plan: pf.location, critical: false, optional: isBlank(f.location), evidence: ev });
    cmp({ group: g, field: `${f.id}.prep`, label: "Preparation", source: f.preparation, plan: pf.preparation, critical: false, optional: isBlank(f.preparation), evidence: ev });
  }
  for (const pf of plan.followUps) {
    if (!pf.sourceId || !extraction.followUps.find((f) => f.id === pf.sourceId)) {
      push({
        group: "Unsupported additions",
        field: `${pf.id}.unsupported`,
        label: "Follow-up with no source evidence",
        critical: true,
        sourceValue: "— not present in source —",
        planValue: `${pf.title ?? "?"} ${pf.date ?? ""}`.trim(),
        status: "mismatch",
        action: "Follow-up appears without source evidence. Remove it or cite exact source text.",
      });
    }
  }

  // ---- warning signs: presence + action preservation ----
  const planWarnBySource = new Map(plan.warnings.filter((p) => p.sourceId).map((p) => [p.sourceId as string, p]));
  for (const w of extraction.warningSigns) {
    const pw = planWarnBySource.get(w.id);
    const g = "When to seek help";
    const ev = { line: w.evidence.line, section: w.evidence.section, snippet: w.evidence.snippet };
    if (!pw) {
      push({
        group: g,
        field: `${w.id}.presence`,
        label: "Warning sign preserved in plan",
        critical: true,
        sourceValue: w.raw,
        planValue: "— OMITTED —",
        status: "mismatch",
        action: "A warning sign from the source is missing in the care plan. This is safety-critical.",
        evidenceLine: ev.line,
        evidenceSection: ev.section,
        evidenceSnippet: ev.snippet,
      });
      continue;
    }
    cmp({ group: g, field: `${w.id}.sign`, label: "Warning sign", source: w.sign, plan: pw.sign, critical: true, flagged: w.flags.length > 0, evidence: ev });
    cmp({ group: g, field: `${w.id}.action`, label: "Stated action", source: w.action, plan: pw.action, critical: true, flagged: w.flags.length > 0, evidence: ev });
  }
  for (const pw of plan.warnings) {
    if (!pw.sourceId || !extraction.warningSigns.find((w) => w.id === pw.sourceId)) {
      push({
        group: "Unsupported additions",
        field: `${pw.id}.unsupported`,
        label: "Warning sign with no source evidence",
        critical: true,
        sourceValue: "— not present in source —",
        planValue: `${pw.sign ?? "?"} → ${pw.action ?? "?"}`,
        status: "mismatch",
        action: "Warning appears without source evidence — the plan must not invent clinical advice.",
      });
    }
  }

  // ---- diet / activity / other instruction coverage ----
  const planHomeBySource = new Map(plan.home.filter((p) => p.sourceId).map((p) => [p.sourceId as string, p]));
  for (const ins of extraction.instructions) {
    const pi = planHomeBySource.get(ins.id);
    const g = ins.category === "diet" ? "Diet" : ins.category === "activity" ? "Activity & home care" : "Other instructions";
    const ev = { line: ins.evidence.line, section: ins.evidence.section, snippet: ins.evidence.snippet };
    if (!pi) {
      push({
        group: g,
        field: `${ins.id}.presence`,
        label: "Instruction covered in plan",
        critical: true,
        sourceValue: ins.text,
        planValue: "— OMITTED —",
        status: "mismatch",
        action: "Instruction from the source is missing in the plan.",
        evidenceLine: ev.line,
        evidenceSection: ev.section,
        evidenceSnippet: ev.snippet,
      });
    } else {
      cmp({ group: g, field: `${ins.id}.text`, label: "Instruction wording", source: ins.text, plan: pi.en, critical: true, actionMatched: "Covered.", evidence: ev });
    }
  }
  for (const pi of plan.home) {
    if (!pi.sourceId || !extraction.instructions.find((i) => i.id === pi.sourceId)) {
      push({
        group: "Unsupported additions",
        field: `${pi.id}.unsupported`,
        label: "Instruction with no source evidence",
        critical: true,
        sourceValue: "— not present in source —",
        planValue: pi.en,
        status: "mismatch",
        action: "Instruction appears without source evidence. Remove it or cite exact source text.",
      });
    }
  }

  // ---- unclear items & translation review rows (non-blocking but visible) ----
  for (const u of extraction.unclear) {
    push({
      group: "Unclear / to confirm",
      field: `${u.id}.review`,
      label: u.reason,
      critical: false,
      sourceValue: u.text.slice(0, 160),
      planValue: "Flagged for care-team confirmation",
      status: "needs_review",
      action: "Ask the care team. Never guess.",
      evidenceLine: u.evidence?.line ?? null,
      evidenceSection: u.evidence?.section ?? null,
      evidenceSnippet: u.evidence?.snippet ?? null,
    });
  }
  if (plan.teReviewCount > 0) {
    push({
      group: "Telugu rendering",
      field: "te.coverage",
      label: "Lines without verified Telugu rendering",
      critical: false,
      sourceValue: `${plan.teReviewCount} line(s)`,
      planValue: "Preserved in English and marked",
      status: "needs_review",
      action: "A fluent reading is not a faithful one — have a Telugu-speaking clinician or family member confirm these lines, which are preserved in English.",
    });
  }

  const counts: Record<ReviewStatus, number> = { matched: 0, needs_review: 0, mismatch: 0, not_evaluated: 0 };
  for (const r of rows) counts[r.status] += 1;

  const criticalMismatches = rows.filter((r) => r.critical && r.status === "mismatch").length;
  const criticalReviews = rows.filter((r) => r.critical && r.status === "needs_review").length;
  const criticalNotEval = rows.filter((r) => r.critical && r.status === "not_evaluated").length;

  const verified = criticalMismatches === 0 && criticalReviews === 0 && criticalNotEval === 0;
  const verifiedReason = verified
    ? "All critical automated checks passed. This is evidence of field-level consistency — NOT a guarantee of clinical safety."
    : `${criticalMismatches} critical mismatch(es), ${criticalReviews} critical item(s) need review, ${criticalNotEval} critical item(s) could not be evaluated. The verified state is blocked.`;

  return {
    createdAt: new Date().toISOString(),
    rows,
    counts,
    criticalFailures: criticalMismatches,
    criticalReviews: criticalReviews + criticalNotEval,
    verified,
    verifiedReason,
  };
}
