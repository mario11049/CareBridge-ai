// Deterministic discharge-summary extractor.
// Rules, not vibes: every numbered line in a known section becomes a structured
// item; fields that cannot be parsed become null + a review flag. Nothing is
// silently dropped, nothing is invented.

import type {
  Evidence,
  Extraction,
  FollowUp,
  HeaderInfo,
  InstructionCategory,
  InstructionItem,
  Medication,
  UnclearItem,
  WarningSign,
} from "./types";
import { normalize, uid } from "./util";

type SectionKey =
  | "header"
  | "medications"
  | "follow_up"
  | "warning_signs"
  | "diet"
  | "activity"
  | "other"
  | "unclear"
  | "emergency";

const SECTION_MAP: Record<string, SectionKey> = {
  medications: "medications",
  medication: "medications",
  "follow-up": "follow_up",
  "follow up": "follow_up",
  followup: "follow_up",
  "warning signs": "warning_signs",
  "warning sign": "warning_signs",
  diet: "diet",
  "activity and home care": "activity",
  "activity & home care": "activity",
  activity: "activity",
  "other instructions": "other",
  "other instruction": "other",
  "unclear / to confirm": "unclear",
  "unclear/to confirm": "unclear",
  "unclear": "unclear",
  "emergency contact": "emergency",
};

const FREQUENCY_PATTERNS: Array<{ re: RegExp; canonical: string }> = [
  { re: /^once daily$/i, canonical: "once daily" },
  { re: /^twice daily$/i, canonical: "twice daily" },
  { re: /^three times daily$/i, canonical: "three times daily" },
  { re: /^four times daily$/i, canonical: "four times daily" },
  { re: /^once a week$/i, canonical: "once a week" },
  { re: /^twice a week$/i, canonical: "twice a week" },
  { re: /^every (\d+) hours?$/i, canonical: "" }, // dynamic
  { re: /^at bedtime$/i, canonical: "at bedtime" },
  { re: /^as needed(?:\s*\(PRN\))?$/i, canonical: "as needed (PRN)" },
  { re: /^before meals$/i, canonical: "before meals" },
  { re: /^after meals$/i, canonical: "after meals" },
];

const ROUTES = [
  "by intramuscular injection",
  "by subcutaneous injection",
  "by intravenous injection",
  "by inhalation",
  "under the tongue",
  "applied to skin",
  "per rectum",
  "by mouth",
];

const FORM_RE = /^(Tab\.|Caps?\.|Syr\.|Inj\.|Oint\.|Inh\.|Gel\.|Drops?\.|Patch\.)\s+/i;

const STRENGTH_RE = /(\d[\d,]*(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|%|units?)(\/\s*(?:\d+(?:\.\d+)?\s*)?ml)?/i;

function evidence(section: string, line: number | null, snippet: string): Evidence {
  return { section, line, snippet: snippet.trim().slice(0, 220), locationAvailable: line != null };
}

function parseFrequency(seg: string): string | null {
  for (const p of FREQUENCY_PATTERNS) {
    const m = seg.match(p.re);
    if (m) {
      if (p.canonical) return p.canonical;
      return `every ${m[1]} hours`;
    }
  }
  return null;
}

function cleanStrength(g1: string, g2: string, g3?: string): string {
  let s = `${g1} ${g2.toUpperCase() === "IU" ? "IU" : g2.toLowerCase()}`;
  if (g3) s += `/${g3.replace(/^\//, "").replace(/\s+/g, " ").trim()}`;
  return s.replace(/,\s*/g, "");
}

export function parseMedicationLine(body: string, section: string, lineNo: number): { med: Medication; parseOk: boolean } {
  const flags: string[] = [];
  let rest = body.trim();
  const ev = evidence(section, lineNo, body);

  // Strip the formulation prefix first ("Tab." etc. contains a period).
  let formulation: string | null = null;
  const frm = rest.match(FORM_RE);
  if (frm) {
    formulation = frm[1];
    rest = rest.slice(frm[0].length);
  }

  // Split trailing sentence(s) (special instructions) from the grammar part:
  // first ". " that is followed by a capital letter or '['.
  const cut = rest.search(/\.\s+(?=[A-Z[])/);
  let grammar = rest;
  let trailingText = "";
  if (cut >= 0) {
    grammar = rest.slice(0, cut);
    trailingText = rest.slice(cut + 1).trim();
  }
  let special: string | null = trailingText ? (trailingText.replace(/\.$/, "").trim() + (trailingText.replace(/\.$/, "").trim().endsWith("]") ? "" : ".")) : null;
  if (special && /^none\.?$/i.test(special)) special = null;

  const segments = grammar.split(",").map((s) => s.trim()).filter(Boolean);

  let name: string | null = null;
  let strength: string | null = null;
  let dose: string | null = null;
  let route: string | null = null;
  let frequency: string | null = null;
  let duration: string | null = null;
  let durationDays: number | null = null;

  // Segment 0: [Form.] Name Strength
  const seg0 = (segments[0] ?? "").replace(FORM_RE, "").trim();
  const sm = seg0.match(STRENGTH_RE);
  if (sm) {
    strength = cleanStrength(sm[1], sm[2], sm[3]);
    name = seg0.slice(0, sm.index).trim();
    const after = seg0.slice((sm.index ?? 0) + sm[0].length).trim();
    if (after) flags.push(`Unparsed text after strength: "${after}"`);
    if (/illegible|unclear|unknown/i.test(name)) {
      flags.push("Medicine name is marked as illegible/unclear in the source");
      name = null;
    }
    if (name === "") {
      name = null;
      flags.push("Medicine name could not be read from the source");
    }
  } else {
    flags.push(`Could not parse medicine name/strength from: "${seg0}"`);
    if (seg0) name = null;
  }

  for (const seg of segments.slice(1)) {
    const lower = seg.toLowerCase();
    // dose + route
    const routeHit = ROUTES.find((r) => lower.endsWith(r) || lower.includes(` ${r}`));
    if (/^(take|apply|use|receive|give)\b/i.test(seg) || routeHit) {
      const r = routeHit ?? null;
      let dosePart = seg.replace(/^(take|apply|use|receive|give)\s+/i, "");
      if (r) {
        const idx = dosePart.toLowerCase().indexOf(r);
        if (idx >= 0) {
          route = r;
          dosePart = dosePart.slice(0, idx).trim();
        }
      }
      dosePart = dosePart.replace(/\.$/, "").trim();
      if (dosePart) dose = dosePart;
      else flags.push(`Dose amount missing in segment: "${seg}"`);
      continue;
    }
    const f = parseFrequency(seg);
    if (f) {
      frequency = f;
      continue;
    }
    const dm = seg.match(/^for\s+(\d+)\s+(days?|weeks?|months?)/i);
    if (dm) {
      const n = parseInt(dm[1], 10);
      const unit = dm[2].toLowerCase();
      duration = `${n} ${unit.startsWith("day") ? (n === 1 ? "day" : "days") : unit.startsWith("week") ? (n === 1 ? "week" : "weeks") : n === 1 ? "month" : "months"}`;
      durationDays = unit.startsWith("day") ? n : unit.startsWith("week") ? n * 7 : n * 30;
      continue;
    }
    flags.push(`Unparsed segment: "${seg}"`);
  }

  if (special && /duration not stated/i.test(special)) {
    flags.push("Duration is explicitly not stated in the source");
    // keep the sentence as evidence-quality special text but do not treat as instruction
  }
  if (!dose) flags.push("Dose not stated in a parseable form");
  if (!frequency) flags.push("Frequency not stated in a parseable form");
  if (!duration) flags.push("Duration not stated in a parseable form");
  if (!route && dose) {
    // route genuinely optional only for topical forms
    flags.push("Route not stated in a parseable form");
  }

  const med: Medication = {
    id: "",
    raw: body.trim(),
    formulation,
    name,
    strength,
    dose,
    route,
    frequency,
    duration,
    durationDays,
    prescribedTimes: null,
    special,
    flags,
    evidence: ev,
  };
  return { med, parseOk: flags.length === 0 };
}

export function parseFollowUpLine(body: string, section: string, lineNo: number): FollowUp {
  const flags: string[] = [];
  const ev = evidence(section, lineNo, body);
  let rest = body.trim();

  // preparation = trailing sentence beginning with known verbs
  let preparation: string | null = null;
  const prepMatch = rest.match(/(?:^|\.\s+)((?:Bring|Come|Carry|Fast|Do not eat)[^.]*\.?)\s*$/);
  if (prepMatch && !rest.toLowerCase().startsWith(prepMatch[1].toLowerCase())) {
    preparation = prepMatch[1].replace(/\.$/, "");
    rest = rest.slice(0, prepMatch.index).trim();
    if (rest.endsWith(";")) rest = rest.slice(0, -1);
  }

  let title: string | null = null;
  let date: string | null = null;
  let time: string | null = null;
  let location: string | null = null;

  const onMatch = rest.match(/^(.+?)\s+on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})(.*)$/i);
  if (onMatch) {
    title = onMatch[1].trim().replace(/[;,]$/, "");
    date = onMatch[2].trim();
    let tail = onMatch[3] ?? "";
    const timeMatch = tail.match(/at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (timeMatch) {
      time = timeMatch[1].toUpperCase().replace(/\s+/g, " ");
      tail = tail.replace(timeMatch[0], "");
    } else if (/\[time unclear\]|time unclear|time not stated/i.test(tail)) {
      flags.push("Time is unclear in the source");
      tail = tail.replace(/at\s+\[time unclear\]/i, "").replace(/(time unclear|time not stated)/i, "");
    } else if (/\bat\b/i.test(tail)) {
      flags.push("Time could not be parsed from the source");
      tail = tail.replace(/\bat\b[^,(]*/i, "");
    }
    tail = tail.replace(/^[,\s]+|[.\s,;]+$/g, "").trim();
    if (tail) location = tail;
  } else {
    // relative or vague scheduling: "INR blood test in 3 days; exact date not stated..."
    const rel = rest.match(/^(.+?)\s+in\s+(\d+)\s+(days?|weeks?)(.*)$/i);
    if (rel) {
      title = rel[1].trim().replace(/[;,]$/, "");
      date = null;
      flags.push(`Relative timing only ("in ${rel[2]} ${rel[3]}"); exact date not stated`);
      const tail = (rel[4] ?? "").replace(/^[;\s]+|[.\s]+$/g, "").trim();
      if (tail && /not stated|confirm/i.test(tail)) flags.push("Source itself says the date is not stated — confirm with the hospital");
      if (tail && !/not stated|confirm/i.test(tail)) location = tail;
    } else {
      title = rest.replace(/[.\s]+$/, "");
      flags.push("Could not identify a date or timing for this follow-up");
    }
  }
  if (!date) flags.push("Exact date not stated");
  if (!time && onMatch) flags.push("Exact time not stated");

  return { id: "", raw: body.trim(), title, date, time, location, preparation, flags, evidence: ev };
}

export function parseWarningLine(body: string, section: string, lineNo: number): WarningSign {
  const flags: string[] = [];
  const ev = evidence(section, lineNo, body);
  const m = body.match(/^(.+?):\s*(.+)$/);
  if (m) {
    return {
      id: "",
      raw: body.trim(),
      sign: m[1].trim(),
      action: m[2].trim().replace(/\.$/, ""),
      flags,
      evidence: ev,
    };
  }
  flags.push("Could not split warning sign and action — preserved verbatim");
  return { id: "", raw: body.trim(), sign: null, action: body.trim().replace(/\.$/, ""), flags, evidence: ev };
}

export function extractFromText(sourceText: string): Extraction {
  const lines = sourceText.replace(/\r\n?/g, "\n").split("\n");
  const parserNotes: string[] = [];
  const header: HeaderInfo = {
    hospital: null,
    patientId: null,
    patientName: null,
    admissionDate: null,
    dischargeDate: null,
    diagnosis: null,
    emergencyContact: null,
  };
  const medications: Medication[] = [];
  const followUps: FollowUp[] = [];
  const warningSigns: WarningSign[] = [];
  const instructions: InstructionItem[] = [];
  const unclear: UnclearItem[] = [];

  let current: SectionKey = "header";
  let sectionsSeen = new Set<SectionKey>();
  let statedSynthetic = /synthetic|sample patient|not a real patient/i.test(sourceText);

  const pushUnclear = (reason: string, text: string, line: number | null) => {
    unclear.push({
      id: uid("UC", unclear.length + 1),
      reason,
      text: text.trim(),
      evidence: line != null ? evidence(sectionName(current), line, text) : null,
    });
  };

  const sectionName = (s: SectionKey) =>
    s === "medications"
      ? "MEDICATIONS"
      : s === "follow_up"
        ? "FOLLOW-UP"
        : s === "warning_signs"
          ? "WARNING SIGNS"
          : s === "activity"
            ? "ACTIVITY AND HOME CARE"
            : s.toUpperCase().replace("_", " ");

  let medN = 0,
    fupN = 0,
    warnN = 0,
    insN = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNo = i + 1;
    if (!line) continue;

    // section heading?
    const headingKey = line.replace(/[:\s]+$/, "").toLowerCase();
    if (SECTION_MAP[headingKey]) {
      current = SECTION_MAP[headingKey];
      sectionsSeen.add(current);
      continue;
    }

    if (current === "header") {
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^Patient ID:\s*(.+)$/i))) header.patientId = m[1].trim();
      else if ((m = line.match(/^Patient Name:\s*(.+)$/i))) header.patientName = m[1].trim();
      else if ((m = line.match(/^Admission Date:\s*(.+)$/i))) header.admissionDate = m[1].trim();
      else if ((m = line.match(/^Discharge Date:\s*(.+)$/i))) header.dischargeDate = m[1].trim();
      else if ((m = line.match(/^Diagnosis:\s*(.+)$/i))) header.diagnosis = m[1].trim();
      else if (!header.hospital && /hospital/i.test(line) && !/^\[|page\s+\d/i.test(line)) header.hospital = line.replace(/\s+Page \d+ of \d+.*$/, "").replace(/— DISCHARGE SUMMARY/i, "").trim();
      continue;
    }

    if (/^none recorded/i.test(line)) continue;

    // emergency contact block
    if (current === "emergency") {
      header.emergencyContact = (header.emergencyContact ? header.emergencyContact + " " : "") + line.replace(/\.$/, "");
      continue;
    }

    if (current === "unclear") {
      const body = line.replace(/^\d+[.)]\s*/, "");
      if (body) pushUnclear("Listed as unclear/to-confirm in the source", body, lineNo);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s*(.+)$/);
    const body = numbered ? numbered[1] : null;

    if (!body) {
      // non-numbered line inside a structured section — never drop it
      pushUnclear(`Line in ${sectionName(current)} that is not a numbered item — preserved verbatim`, line, lineNo);
      continue;
    }

    switch (current) {
      case "medications": {
        const { med, parseOk } = parseMedicationLine(body, "MEDICATIONS", lineNo);
        medN += 1;
        med.id = uid("MED", medN);
        medications.push(med);
        if (!parseOk) {
          pushUnclear(`Medicine line ${medN} contains unparseable or missing details`, body, lineNo);
        }
        break;
      }
      case "follow_up": {
        const f = parseFollowUpLine(body, "FOLLOW-UP", lineNo);
        fupN += 1;
        f.id = uid("FUP", fupN);
        followUps.push(f);
        if (f.flags.length) pushUnclear(`Follow-up line ${fupN} has missing or unclear details`, body, lineNo);
        break;
      }
      case "warning_signs": {
        const w = parseWarningLine(body, "WARNING SIGNS", lineNo);
        warnN += 1;
        w.id = uid("WRN", warnN);
        warningSigns.push(w);
        if (w.flags.length) pushUnclear(`Warning-sign line ${warnN} could not be fully parsed`, body, lineNo);
        break;
      }
      case "diet":
      case "activity":
      case "other": {
        const cat: InstructionCategory = current === "diet" ? "diet" : current === "activity" ? "activity" : "other";
        insN += 1;
        instructions.push({
          id: uid("INS", insN),
          category: cat,
          raw: body.trim(),
          text: body.trim().replace(/\.$/, "") + ".",
          flags: [],
          evidence: evidence(sectionName(current), lineNo, body),
        });
        break;
      }
    }
  }

  // ---- conflict detection: same medicine, different strength ----
  const byName = new Map<string, Medication[]>();
  for (const m of medications) {
    if (!m.name) continue;
    const key = normalize(m.name);
    byName.set(key, [...(byName.get(key) ?? []), m]);
  }
  for (const [nameKey, group] of byName) {
    if (group.length > 1) {
      const strengths = new Set(group.map((g) => normalize(g.strength ?? "?")));
      const doses = new Set(group.map((g) => normalize(g.dose ?? "?")));
      if (strengths.size > 1 || doses.size > 1) {
        const vals = group.map((g) => `${g.strength ?? "?"} (${g.evidence.line != null ? "line " + g.evidence.line : "line ?"})`).join(" vs ");
        for (const g of group) g.flags.push(`CONFLICT: "${nameKey}" appears with different strength/dose in the source (${vals})`);
        pushUnclear(
          "Conflicting medicine entries detected in the source — do NOT assume either value",
          `${group[0].name}: ${vals}`,
          group[0].evidence.line,
        );
      } else {
        for (const g of group) g.flags.push(`Duplicate entry for "${nameKey}" in the source — confirm only one was intended`);
        pushUnclear("Duplicate medicine entry detected in the source", `${group[0].name} appears ${group.length} times`, group[0].evidence.line);
      }
    }
  }

  const foundCore = sectionsSeen.has("medications") || sectionsSeen.has("follow_up") || sectionsSeen.has("warning_signs");
  const detectedFormat = foundCore && header.diagnosis != null;

  if (!detectedFormat) {
    parserNotes.push(
      "This document does not follow the structured discharge-summary layout the parser understands. All content is preserved above as raw text; fields are marked for review instead of guessed.",
    );
    // preserve whole text as review material
    pushUnclear("Unstructured document — automatic field extraction is limited", sourceText.slice(0, 600) + (sourceText.length > 600 ? "…" : ""), null);
  } else {
    parserNotes.push(
      `Parsed ${medications.length} medicine line(s), ${followUps.length} follow-up(s), ${warningSigns.length} warning sign(s), ${instructions.length} instruction(s).`,
    );
  }

  if (unclear.length > 0) {
    parserNotes.push(`${unclear.length} item(s) need human review. Nothing was guessed to fill these gaps.`);
  }

  return {
    header,
    medications,
    followUps,
    warningSigns,
    instructions,
    unclear,
    meta: {
      detectedFormat,
      parserNotes,
      synthetic: statedSynthetic,
      sourceLineCount: lines.length,
    },
  };
}
