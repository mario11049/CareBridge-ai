// Telugu rendering resources.
// The dictionary covers the fixed phrase pools used by the synthetic samples and
// the gold-standard generator. Any phrase NOT found here is preserved in English
// and flagged `teReview = true` — faithful beats fluent.

import { normalize } from "./util";

/** Dictionary lookup tolerant to trailing punctuation differences. Returns null when no verified Telugu rendering exists. */
export function teLookup(dict: Record<string, string>, phrase: string | null | undefined): string | null {
  if (!phrase) return null;
  const n = normalize(phrase);
  return dict[n] ?? dict[n + "."] ?? null;
}

export const FREQ_TE: Record<string, string> = {
  "once daily": "రోజుకు ఒకసారి",
  "twice daily": "రోజుకు రెండుసార్లు",
  "three times daily": "రోజుకు మూడుసార్లు",
  "four times daily": "రోజుకు నాలుగుసార్లు",
  "once a week": "వారానికి ఒకసారి",
  "twice a week": "వారానికి రెండుసార్లు",
  "every 4 hours": "ప్రతి 4 గంటలకు",
  "every 6 hours": "ప్రతి 6 గంటలకు",
  "every 8 hours": "ప్రతి 8 గంటలకు",
  "every 12 hours": "ప్రతి 12 గంటలకు",
  "at bedtime": "రాత్రి నిద్రపోయే ముందు",
  "as needed (PRN)": "అవసరమైనప్పుడు మాత్రమే",
  "before meals": "భోజనానికి ముందు",
  "after meals": "భోజనం తర్వాత",
};

export const ROUTE_TE: Record<string, string> = {
  "by mouth": "నోటి ద్వారా",
  "by inhalation": "శ్వాస ద్వారా (ఇన్హేలర్)",
  "by subcutaneous injection": "చర్మం కింద ఇంజెక్షన్ ద్వారా",
  "by intramuscular injection": "కండరం లోపల ఇంజెక్షన్ ద్వారా",
  "by intravenous injection": "నరం (IV) ద్వారా ఇంజెక్షన్",
  "applied to skin": "చర్మంపై పూసుకోవాలి",
  "under the tongue": "నాలుక కింద ఉంచుకోవాలి",
  "per rectum": "గుద ద్వారం గుండా వాడాలి",
};

export const DOSE_UNIT_TE: Record<string, string> = {
  tablet: "టాబ్లెట్",
  tablets: "టాబ్లెట్లు",
  capsule: "క్యాప్సూల్",
  capsules: "క్యాప్సూళ్ళు",
  ml: "ml",
  puffs: "పఫ్‌లు",
  puff: "పఫ్",
  units: "యూనిట్లు",
  unit: "యూనిట్",
  vial: "వైల్",
  vials: "వైళ్ళు",
  drops: "చుక్కలు",
  drop: "చుక్క",
  patch: "ప్యాచ్",
  sachet: "సాషే",
};

export function durationTe(duration: string | null): string | null {
  if (!duration) return null;
  const m = duration.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
  if (!m) return null;
  const n = m[1];
  const unit = m[2].toLowerCase();
  if (unit.startsWith("day")) return `${n} రోజుల పాటు`;
  if (unit.startsWith("week")) return `${n} వారాల పాటు`;
  return `${n} నెలల పాటు`;
}

export function doseTe(dose: string | null): { text: string; review: boolean } {
  if (!dose) return { text: "—", review: false };
  const m = dose.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
  if (!m) return { text: dose, review: true };
  const unit = DOSE_UNIT_TE[m[2].toLowerCase()];
  if (!unit) return { text: dose, review: true };
  return { text: `${m[1]} ${unit}`, review: false };
}

export const SPECIAL_TE: Record<string, string> = {
  "take after food.": "ఆహారం తర్వాత తీసుకోండి.",
  "take before food.": "ఆహారానికి ముందు తీసుకోండి.",
  "take before breakfast.": "ఉదయం అల్పాహారానికి ముందు తీసుకోండి.",
  "take on an empty stomach.": "ఖాళీ కడుపుతో తీసుకోండి.",
  "take with food.": "ఆహారంతో పాటు తీసుకోండి.",
  "complete the full course of this antibiotic.": "యాంటీబయాటిక్ కోర్సును పూర్తిగా వాడండి; మధ్యలో ఆపవద్దు.",
  "complete the full course.": "కోర్సును పూర్తిగా వాడండి; మధ్యలో ఆపవద్దు.",
  "take only if fever is above 100°f.": "జ్వరం 100°F కంటే ఎక్కువ ఉన్నప్పుడే తీసుకోండి.",
  "shake well before use.": "వాడే ముందు బాగా ఊపండి.",
  "do not stop this medicine suddenly.": "ఈ మందును హఠాత్తుగా ఆపవద్దు.",
  "do not stop suddenly.": "హఠాత్తుగా ఆపవద్దు.",
  "to be given at home by a trained nurse.": "ఇంట్లో శిక్షణ పొందిన నర్సే ఇవ్వాలి.",
  "dose adjustment pending inr report.": "INR నివేదిక వచ్చిన తర్వాత మోతాదు సరిచేయబడుతుంది.",
  "[conflicting entry in source — cardiology to confirm.]": "మూల పత్రంలో విరుద్ధమైన నమోదు — కార్డియాలజీ విభాగం నిర్ధారించాలి.",
  "avoid alcohol while taking this medicine.": "ఈ మందు వాడుతున్నప్పుడు మద్యం సేవించవద్దు.",
  "may cause drowsiness.": "నిద్రమట్లు కలగవచ్చు; జాగ్రత్తగా ఉండండి.",
  "apply a thin layer to the affected area.": "బాధిత ప్రాంతంపై పలుచని పొర పూయండి.",
};

export const INSTRUCTION_TE: Record<string, string> = {
  "eat soft, light food for the first 2 days, then return to your normal diet.":
    "మొదటి 2 రోజులు మెత్తటి, తేలికపాటి ఆహారం తీసుకోండి; ఆ తర్వాత మీ సాధారణ ఆహారానికి తిరిగి వెళ్లండి.",
  "drink plenty of water and fluids.": "నీరు, ద్రవాలు పుష్కలంగా త్రాగండి.",
  "follow a diabetic diet; avoid sugar and sweets.": "మధుమేహ ఆహార నియమాలు పాటించండి; చక్కెర, తీపి పదార్థాలు తగ్గించండి.",
  "keep vitamin k intake consistent; do not start or stop green leafy vegetables suddenly.":
    "విటమిన్-K ఉండే ఆహారాన్ని (ఆకుకూరలు) ప్రతిరోజూ సమానంగా తీసుకోండి; హఠాత్తుగా ప్రారంభించకండి లేదా ఆపకండి.",
  "drink at least 8 glasses of water daily.": "రోజూ కనీసం 8 గ్లాసుల నీరు త్రాగండి.",
  "avoid oily and spicy food for 1 week.": "1 వారం పాటు నూనె, మసాలాలు ఎక్కువగా ఉండే ఆహారం తగ్గించండి.",
  "do not lift anything heavier than 5 kg for 2 weeks.": "2 వారాల పాటు 5 kg కంటే బరువైన వస్తువులు ఎత్తవద్దు.",
  "keep the wound clean and dry. change the dressing every 2 days.":
    "గాయాన్ని శుభ్రంగా, పొడిగా ఉంచండి. ప్రతి 2 రోజులకు డ్రెస్సింగ్ మార్చండి.",
  "walk for 10 to 15 minutes, three times a day.": "రోజుకు మూడుసార్లు, ఒక్కొక్కసారి 10 నుండి 15 నిమిషాలు నడవండి.",
  "rest at home for 1 week.": "1 వారం పాటు ఇంట్లో విశ్రాంతి తీసుకోండి.",
  "do breathing exercises 3 times a day.": "రోజుకు 3 సార్లు శ్వాస వ్యాయామాలు చేయండి.",
  "do not travel long distances for 1 week.": "1 వారం పాటు దూర ప్రయాణాలు చేయవద్దు.",
  "avoid dusty places. do not smoke.": "దుమ్ము ఉండే ప్రదేశాలకు వెళ్లవద్దు. పొగ త్రాగవద్దు.",
  "take a bath only 48 hours after surgery, keeping the wound covered.":
    "శస్త్రచికిత్స జరిగిన 48 గంటల తర్వాతే స్నానం చేయండి; గాయాన్ని కప్పి ఉంచండి.",
  "carry your anticoagulant card at all times.": "మీ యాంటికోయాగ్యులెంట్ కార్డును ఎల్లప్పుడూ మీ దగ్గర ఉంచుకోండి.",
  "check your blood sugar every morning and record it.": "ప్రతి ఉదయం మీ రక్తంలో చక్కెర స్థాయిని పరీక్షించి నమోదు చేసుకోండి.",
};

export const WARNING_SIGN_TE: Record<string, string> = {
  "fever above 100.4°f (38°c)": "జ్వరం 100.4°F (38°C) కంటే ఎక్కువగా ఉంటే",
  "redness, swelling, or pus from the wound": "గాయం చుట్టూ ఎరుపు, వాపు లేదా చీము వస్తే",
  "severe abdominal pain not relieved by the prescribed medicine": "ఇచ్చిన మందులతో తగ్గని తీవ్రమైన కడుపు నొప్పి ఉంటే",
  "increasing breathlessness or difficulty breathing": "శ్వాస తీసుకోవడంలో ఇబ్బంది పెరుగుతుంటే",
  "chest pain": "ఛాతీ నొప్పి వస్తే",
  "blood in sputum (coughing up blood)": "దగ్గుతున్నప్పుడు రక్తం వస్తే",
  "black stools, blood in vomit, or unusual bleeding": "నల్లటి మలం, వాంతుల్లో రక్తం, లేదా అసాధారణ రక్తస్రావం ఉంటే",
  "dizziness or fainting": "తల తిరగడం లేదా మూర్ఛ వస్తే",
  "swelling of the legs or sudden weight gain": "కాళ్ళు వాచడం లేదా బరువు హఠాత్తుగా పెరిగితే",
  "very high or very low blood sugar reading": "చక్కెర స్థాయి చాలా ఎక్కువ లేదా చాలా తక్కువగా చూపిస్తే",
};

export const WARNING_ACTION_TE: Record<string, string> = {
  "contact the surgical unit immediately": "వెంటనే శస్త్రచికిత్స (సర్జరీ) విభాగాన్ని సంప్రదించండి",
  "go to the emergency department": "వెంటనే అత్యవసర విభాగానికి (ఎమర్జెన్సీ) వెళ్లండి",
  "go to the emergency department immediately": "వెంటనే అత్యవసర విభాగానికి (ఎమర్జెన్సీ) వెళ్లండి",
  "call 040-5555-0132 immediately": "వెంటనే 040-5555-0132 నంబర్‌కు కాల్ చేయండి",
  "call 040-5555-0177": "040-5555-0177 నంబర్‌కు కాల్ చేయండి",
  "call 040-5555-0164": "040-5555-0164 నంబర్‌కు కాల్ చేయండి",
  "call 108 or go to the nearest hospital": "108కు కాల్ చేయండి లేదా దగ్గర్లోని ఆసుపత్రికి వెళ్లండి",
  "seek emergency care immediately": "వెంటనే అత్యవసర వైద్య సహాయం పొందండి",
};

export const DIAGNOSIS_TE: Record<string, string> = {
  "acute appendicitis. laparoscopic appendectomy performed on 06 march 2026. recovery uncomplicated.":
    "తీవ్రమైన అపెండిసైటిస్ (అపెండిక్స్‌కు వాపు). 06 మార్చి 2026 నాటికి కీ-హోల్ (లాపరోస్కోపిక్) పద్ధతిలో అపెండిక్స్ తొలగింపు శస్త్రచికిత్స చేశారు. కోలుకునే దశలో ఎలాంటి సమస్యా లేదు.",
  "community-acquired pneumonia, right lower lobe, improving on treatment. type 2 diabetes mellitus, stable on oral medication.":
    "న్యుమోనియా (ఊపిరితిత్తుల ఇన్ఫెక్షన్), కుడి ఊపిరితిత్తి కింది భాగంలో; చికిత్సతో మెరుగవుతోంది. టైపు 2 మధుమేహం కూడా ఉంది — అది మాత్రలతో అదుపులో ఉంది.",
  "atrial fibrillation, rate-controlled with medication. viral fever, resolved during admission.":
    "గుండె కొట్టుకోవడం అసాధారణంగా ఉండే సమస్య (ఏట్రియల్ ఫిబ్రిలేషన్); మందులతో కొట్టుకోవడం అదుపులో ఉంది. వైరల్ జ్వరం ఇంతకుముందు వచ్చి, ఆసుపత్రిలో ఉన్నప్పుడే తగ్గిపోయింది.",
};

export const FOLLOWUP_TITLE_TE: Record<string, string> = {
  "surgical outpatient review": "శస్త్రచికిత్స విభాగం అవుట్‌పేషెంట్ రివ్యూ",
  "chest clinic review with repeat chest x-ray": "ఛాతీ క్లినిక్ రివ్యూ (మళ్ళీ ఛాతీ ఎక్స్-రేతో సహా)",
  "diabetes review": "మధుమేహ రివ్యూ",
  "inr blood test": "INR రక్త పరీక్ష",
  "cardiology review": "గుండె (కార్డియాలజీ) విభాగం రివ్యూ",
};

export const FOLLOWUP_PREP_TE: Record<string, string> = {
  "bring this discharge summary and all your medicines.": "ఈ డిశ్చార్జ్ సారాంశాన్ని, మీ మందులన్నీ తీసుకురండి.",
  "bring all current medicines and old x-ray reports.": "ప్రస్తుతం వాడుతున్న మందులన్నీ, పాత ఎక్స్-రే నివేదికలను తీసుకురండి.",
  "bring your blood sugar diary.": "మీ బ్లడ్ షుగర్ రోజువారీ నమోదు పుస్తకాన్ని తీసుకురండి.",
};

export const PLAN_TE = {
  headings: {
    whatHappened: "ఏమి జరిగింది?",
    medicines: "మీ ఔషధాలు",
    home: "ఇంట్లో ఏమి చేయాలి",
    followUp: "మీ ఫాలో-అప్ (తదుపరి చూపు)",
    warnings: "ఎప్పుడు వెంటనే సహాయం పొందాలి",
    questions: "మీ వైద్య బృందాన్ని అడగాల్సిన ప్రశ్నలు",
    diet: "ఆహారం",
    activity: "శారీరక శ్రమ / జాగ్రత్తలు",
    homeCare: "ఇంటి సంరక్షణ",
    other: "ఇతర సూచనలు",
  },
  medTable: {
    medicine: "ఔషధం",
    dose: "మోతాదు",
    howTaken: "ఎలా తీసుకోవాలి",
    howOften: "ఎన్నిసార్లు",
    howLong: "ఎంతకాలం",
    special: "ప్రత్యేక సూచన",
    strength: "బలం",
  },
  fieldNames: {
    name: "ఔషధ పేరు",
    strength: "ఔషధ బలం",
    dose: "మోతాదు",
    route: "తీసుకునే విధానం",
    frequency: "ఎన్నిసార్లు వాడాలో",
    duration: "ఎంతకాలం వాడాలో",
    date: "తేదీ",
    time: "సమయం",
    location: "చోటు",
    warning: "ప్రమాద సంకేతం",
  },
  notStated: "మూల పత్రంలో పేర్కొనలేదు — దయచేసి ఆసుపత్రిలో నిర్ధారించుకోండి.",
  unclearMissing: (fieldTe: string) =>
    `మూల పత్రంలో «${fieldTe}» స్పష్టంగా లేదు. దయచేసి మీ వైద్యుడితో లేదా ఆసుపత్రితో నిర్ధారించుకోండి.`,
  conflict: "మూల పత్రంలో ఒకే ఔషధానికి రెండు వేర్వేరు వివరాలు ఉన్నాయి. సరైంది ఏదో వైద్యుడిని అడిగి నిర్ధారించుకోండి.",
  illegible: "ఈ ఔషధ పేరు మూల పత్రంలో చదవలేనంతగా ఉంది. దయచేసి ఆసుపత్రితో నిర్ధారించుకోండి.",
};
