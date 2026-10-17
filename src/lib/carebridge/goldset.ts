// Gold-standard synthetic evaluation set.
// 50 fully synthetic discharge summaries generated with a seeded RNG, where the
// structured "gold" facts are KNOWN because the text is emitted from them.
// Seeds 1–10 = development set (parser rules were tuned against these).
// Seeds 11–50 = held-out evaluation set (never used for development/tuning).
// This measures parser/extraction fidelity on synthetic text only — it is NOT
// a measure of real-world clinical accuracy.

import { mulberry32, pick, pickN } from "./util";

export interface GoldMed {
  formulation: string;
  name: string;
  strength: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  special: string | null;
}

export interface GoldFollowUp {
  title: string;
  date: string | null;
  time: string | null;
  location: string | null;
  preparation: string | null;
}

export interface GoldWarning {
  sign: string;
  action: string;
}

export interface GoldCase {
  id: string;
  split: "development" | "held-out";
  text: string;
  gold: {
    diagnosis: string;
    medications: GoldMed[];
    followUps: GoldFollowUp[];
    warnings: GoldWarning[];
    instructions: string[];
  };
}

const DIAGNOSES = [
  "Community-acquired pneumonia, improving on treatment.",
  "Acute appendicitis. Laparoscopic appendectomy performed. Recovery uncomplicated.",
  "Viral fever with dehydration, resolved with intravenous fluids.",
  "Right wrist fracture. Closed reduction and plaster cast applied.",
  "Urinary tract infection, responding to antibiotics.",
  "Type 2 diabetes mellitus with hyperglycemia, stabilised on oral medication.",
  "Acute gastritis, improved on treatment.",
  "Cellulitis of the left leg, improving on antibiotics.",
];

const MED_POOL: Array<Omit<GoldMed, "frequency" | "duration" | "special">> = [
  { formulation: "Tab.", name: "Paracetamol", strength: "650 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Paracetamol", strength: "500 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Cap.", name: "Amoxicillin", strength: "500 mg", dose: "1 capsule", route: "by mouth" },
  { formulation: "Tab.", name: "Azithromycin", strength: "500 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Cefuroxime", strength: "250 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Metformin", strength: "500 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Atorvastatin", strength: "10 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Pantoprazole", strength: "40 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Amlodipine", strength: "5 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Tab.", name: "Metoprolol", strength: "25 mg", dose: "1 tablet", route: "by mouth" },
  { formulation: "Syr.", name: "Ambroxol", strength: "15 mg/5 ml", dose: "10 ml", route: "by mouth" },
  { formulation: "Inh.", name: "Salbutamol", strength: "100 mcg", dose: "2 puffs", route: "by inhalation" },
  { formulation: "Inj.", name: "Ceftriaxone", strength: "1 g", dose: "1 vial", route: "by intramuscular injection" },
  { formulation: "Inj.", name: "Insulin Glargine", strength: "100 IU/ml", dose: "10 units", route: "by subcutaneous injection" },
  { formulation: "Cap.", name: "Vitamin D3", strength: "60000 IU", dose: "1 capsule", route: "by mouth" },
  { formulation: "Tab.", name: "Cetirizine", strength: "10 mg", dose: "1 tablet", route: "by mouth" },
];

const SPECIALS = [
  "Take after food.",
  "Take before breakfast.",
  "Take with food.",
  "Take on an empty stomach.",
  "Complete the full course of this antibiotic.",
  "Shake well before use.",
  "Do not stop this medicine suddenly.",
  "May cause drowsiness.",
  "Avoid alcohol while taking this medicine.",
];

const FREQS = [
  "once daily",
  "twice daily",
  "three times daily",
  "four times daily",
  "every 8 hours",
  "every 12 hours",
  "at bedtime",
  "once a week",
  "as needed (PRN)",
];

const DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "30 days", "8 weeks", "2 weeks"];

const MONTHS = ["March", "April", "May", "June"];

const FOLLOWUP_TITLES = [
  "Surgical outpatient review",
  "Medicine outpatient review",
  "Diabetes review",
  "Cardiology review",
  "Orthopaedic review",
  "Chest clinic review with repeat chest X-ray",
];

const LOCATIONS = [
  "OPD Block A, Room 102, City Hospital",
  "OPD Block B, Room 214",
  "Endocrinology OPD, Room 108",
  "Radiology Wing, Ground Floor",
  "OPD Block C, Room 7",
];

const PREPS = [
  "Bring this discharge summary and all your medicines.",
  "Bring all current medicines and old X-ray reports.",
  "Bring your blood sugar diary.",
];

const WARNING_PAIRS: GoldWarning[] = [
  { sign: "Fever above 100.4°F (38°C)", action: "contact the surgical unit immediately" },
  { sign: "Redness, swelling, or pus from the wound", action: "go to the emergency department" },
  { sign: "Severe abdominal pain not relieved by the prescribed medicine", action: "call 040-5555-0132 immediately" },
  { sign: "Increasing breathlessness or difficulty breathing", action: "go to the emergency department" },
  { sign: "Chest pain", action: "call 108 or go to the nearest hospital" },
  { sign: "Blood in sputum (coughing up blood)", action: "seek emergency care immediately" },
  { sign: "Black stools, blood in vomit, or unusual bleeding", action: "go to the emergency department immediately" },
  { sign: "Dizziness or fainting", action: "call 040-5555-0177" },
  { sign: "Very high or very low blood sugar reading", action: "call 040-5555-0164" },
  { sign: "Swelling of the legs or sudden weight gain", action: "call 040-5555-0177" },
];

const DIET_POOL = [
  "Eat soft, light food for the first 2 days, then return to your normal diet.",
  "Drink plenty of water and fluids.",
  "Follow a diabetic diet; avoid sugar and sweets.",
  "Drink at least 8 glasses of water daily.",
  "Avoid oily and spicy food for 1 week.",
];

const ACTIVITY_POOL = [
  "Do not lift anything heavier than 5 kg for 2 weeks.",
  "Keep the wound clean and dry. Change the dressing every 2 days.",
  "Walk for 10 to 15 minutes, three times a day.",
  "Rest at home for 1 week.",
  "Do breathing exercises 3 times a day.",
  "Do not travel long distances for 1 week.",
  "Avoid dusty places. Do not smoke.",
];

const OTHER_POOL = [
  "Take a bath only 48 hours after surgery, keeping the wound covered.",
  "Carry your anticoagulant card at all times.",
  "Check your blood sugar every morning and record it.",
];

const HOSPITALS = ["CITY GENERAL HOSPITAL", "LAKESIDE MEDICAL CENTRE", "RIVERVIEW HOSPITAL"];

export function generateCase(seed: number): GoldCase {
  const rng = mulberry32(seed * 7919 + 13);
  const split = seed <= 10 ? "development" : "held-out";
  const hospital = pick(rng, HOSPITALS);
  const diagnosis = pick(rng, DIAGNOSES);

  // messy held-out cases: 11 and 23 deliberately omit critical medication fields
  const messy = seed === 14 || seed === 27;

  const nMeds = 1 + Math.floor(rng() * 4);
  const meds: GoldMed[] = pickN(rng, MED_POOL, nMeds).map((m, i) => {
    const freq = m.formulation === "Cap." && m.name === "Vitamin D3" ? "once a week" : pick(rng, FREQS.filter((f) => f !== "once a week"));
    const dur = m.formulation === "Cap." && m.name === "Vitamin D3" ? pick(rng, ["8 weeks", "4 weeks"]) : pick(rng, DURATIONS);
    const special = rng() < 0.45 ? pick(rng, SPECIALS) : null;
    if (messy && i === 0) {
      // omit duration entirely from the TEXT for this medicine
      return { ...m, frequency: freq, duration: null, special };
    }
    return { ...m, frequency: freq, duration: dur, special };
  });
  // ensure weekly vitamin isn't duplicated by freq filter edge: fine.

  const day0 = 15 + Math.floor(rng() * 13);
  const month = pick(rng, MONTHS);
  const followUps: GoldFollowUp[] = Array.from({ length: rng() < 0.55 ? 1 : 2 }, (_, i) => ({
    title: pickN(rng, FOLLOWUP_TITLES, 2)[i],
    date: `${String(day0 + i * 5).padStart(2, "0")} ${month} 2026`,
    time: i === 0 ? "09:00 AM" : "11:30 AM",
    location: pick(rng, LOCATIONS),
    preparation: rng() < 0.6 ? pick(rng, PREPS) : null,
  }));

  const warnings = pickN(rng, WARNING_PAIRS, 2 + Math.floor(rng() * 2));
  const instructions = [...pickN(rng, DIET_POOL, 1 + Math.floor(rng() * 2)), ...pickN(rng, ACTIVITY_POOL, 1 + Math.floor(rng() * 3)), ...(rng() < 0.5 ? pickN(rng, OTHER_POOL, 1) : [])];

  const pad = (n: number) => String(n).padStart(3, "0");
  const lines: string[] = [];
  lines.push(`${hospital} — DISCHARGE SUMMARY`);
  lines.push(`[SYNTHETIC GOLD-STANDARD CASE ${pad(seed)} — NOT A REAL PATIENT]`);
  lines.push(``);
  lines.push(`Patient ID: GOLD-${pad(seed)}`);
  lines.push(`Patient Name: Gold Sample ${pad(seed)}`);
  lines.push(`Admission Date: 01 ${month} 2026`);
  lines.push(`Discharge Date: 06 ${month} 2026`);
  lines.push(`Diagnosis: ${diagnosis}`);
  lines.push(``);
  lines.push(`MEDICATIONS`);
  meds.forEach((m, i) => {
    let line = `${i + 1}. ${m.formulation} ${m.name} ${m.strength}, take ${m.dose} ${m.route}, ${m.frequency}${m.duration ? `, for ${m.duration}` : ""}.`;
    if (m.special) line += ` ${m.special}`;
    lines.push(line);
  });
  lines.push(``);
  lines.push(`FOLLOW-UP`);
  followUps.forEach((f, i) => {
    let line = `${i + 1}. ${f.title} on ${f.date} at ${f.time}`;
    if (f.location) line += `, ${f.location}`;
    line += `.`;
    if (f.preparation) line += ` ${f.preparation}`;
    lines.push(line);
  });
  lines.push(``);
  lines.push(`WARNING SIGNS`);
  warnings.forEach((w, i) => lines.push(`${i + 1}. ${w.sign}: ${w.action}.`));
  lines.push(``);
  lines.push(`DIET AND ACTIVITY`);
  // use canonical sections for parser: split diet/activity properly
  lines.pop(); // remove combined header — emit canonical ones below
  const diet = instructions.filter((x) => DIET_POOL.includes(x));
  const act = instructions.filter((x) => !DIET_POOL.includes(x) && !OTHER_POOL.includes(x));
  const oth = instructions.filter((x) => OTHER_POOL.includes(x));
  lines.push(`DIET`);
  diet.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  lines.push(``);
  lines.push(`ACTIVITY AND HOME CARE`);
  act.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  if (oth.length) {
    lines.push(``);
    lines.push(`OTHER INSTRUCTIONS`);
    oth.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  }
  lines.push(``);
  lines.push(`UNCLEAR / TO CONFIRM`);
  lines.push(`None recorded.`);

  return {
    id: `GOLD-${pad(seed)}`,
    split,
    text: lines.join("\n"),
    gold: {
      diagnosis,
      medications: meds,
      followUps,
      warnings,
      instructions,
    },
  };
}

export const GOLD_SEEDS_DEV = Array.from({ length: 10 }, (_, i) => i + 1);
export const GOLD_SEEDS_EVAL = Array.from({ length: 40 }, (_, i) => i + 11);

export function allGoldCases(): GoldCase[] {
  return [...GOLD_SEEDS_DEV, ...GOLD_SEEDS_EVAL].map(generateCase);
}
