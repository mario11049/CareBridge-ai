import type { SampleCase } from "./types";

const COMMON_HEADER = (hospital: string) => `${hospital} — DISCHARGE SUMMARY                                                                                 Page 1 of 1`;

export const SAMPLE_ROUTINE: SampleCase = {
  id: "SYN-001",
  label: "Routine recovery",
  difficulty: "Routine",
  blurb:
    "Appendectomy discharge with three medicines, one follow-up visit, and standard wound and warning-sign instructions.",
  text: `${COMMON_HEADER("APOLLO CARE HOSPITAL, HYDERABAD")}
                               [SYNTHETIC SAMPLE DOCUMENT — NOT A REAL PATIENT]
   Prepared for hackathon demonstration. All names, dates and phone numbers are fictional.

Patient ID: SYN-001
Patient Name: Sample Patient A
Admission Date: 05 March 2026
Discharge Date: 09 March 2026
Diagnosis: Acute appendicitis. Laparoscopic appendectomy performed on 06 March 2026. Recovery uncomplicated.

MEDICATIONS
1. Tab. Paracetamol 650 mg, take 1 tablet by mouth, three times daily, for 5 days. Take after food.
2. Cap. Amoxicillin 500 mg, take 1 capsule by mouth, three times daily, for 7 days. Complete the full course of this antibiotic.
3. Tab. Pantoprazole 40 mg, take 1 tablet by mouth, once daily, for 10 days. Take before breakfast.

FOLLOW-UP
1. Surgical outpatient review on 20 March 2026 at 10:30 AM, OPD Block B, Room 214, Apollo Care Hospital. Bring this discharge summary and all your medicines.

WARNING SIGNS
1. Fever above 100.4°F (38°C): contact the surgical unit immediately.
2. Redness, swelling, or pus from the wound: go to the emergency department.
3. Severe abdominal pain not relieved by the prescribed medicine: call 040-5555-0132 immediately.

DIET
1. Eat soft, light food for the first 2 days, then return to your normal diet.
2. Drink plenty of water and fluids.

ACTIVITY AND HOME CARE
1. Do not lift anything heavier than 5 kg for 2 weeks.
2. Keep the wound clean and dry. Change the dressing every 2 days.
3. Walk for 10 to 15 minutes, three times a day.

OTHER INSTRUCTIONS
1. Take a bath only 48 hours after surgery, keeping the wound covered.

UNCLEAR / TO CONFIRM
None recorded.

EMERGENCY CONTACT
Surgical unit, Apollo Care Hospital: 040-5555-0132 (24 hours).`,
};

export const SAMPLE_MULTIMED: SampleCase = {
  id: "SYN-002",
  label: "Multiple medicines, two follow-ups",
  difficulty: "Moderate",
  blurb:
    "Pneumonia with diabetes: five medicines including a syrup and a weekly capsule, plus two follow-up visits with preparation instructions.",
  text: `${COMMON_HEADER("KAMINENI CITY HOSPITAL, VIJAYAWADA")}
                               [SYNTHETIC SAMPLE DOCUMENT — NOT A REAL PATIENT]
   Prepared for hackathon demonstration. All names, dates and phone numbers are fictional.

Patient ID: SYN-002
Patient Name: Sample Patient B
Admission Date: 10 March 2026
Discharge Date: 14 March 2026
Diagnosis: Community-acquired pneumonia, right lower lobe, improving on treatment. Type 2 diabetes mellitus, stable on oral medication.

MEDICATIONS
1. Tab. Azithromycin 500 mg, take 1 tablet by mouth, once daily, for 5 days. Take on an empty stomach.
2. Tab. Metformin 500 mg, take 1 tablet by mouth, twice daily, for 30 days. Take with food.
3. Tab. Paracetamol 650 mg, take 1 tablet by mouth, three times daily, for 3 days. Take only if fever is above 100°F.
4. Syr. Ambroxol 15 mg/5 ml, take 10 ml by mouth, three times daily, for 7 days. Shake well before use.
5. Cap. Vitamin D3 60000 IU, take 1 capsule by mouth, once a week, for 8 weeks.

FOLLOW-UP
1. Chest clinic review with repeat chest X-ray on 21 March 2026 at 09:00 AM, Radiology Wing, Ground Floor, Kamineni City Hospital. Bring all current medicines and old X-ray reports.
2. Diabetes review on 28 March 2026 at 11:00 AM, Endocrinology OPD, Room 108. Bring your blood sugar diary.

WARNING SIGNS
1. Increasing breathlessness or difficulty breathing: go to the emergency department.
2. Chest pain: call 108 or go to the nearest hospital.
3. Blood in sputum (coughing up blood): seek emergency care immediately.
4. Very high or very low blood sugar reading: call 040-5555-0164.

DIET
1. Follow a diabetic diet; avoid sugar and sweets.
2. Drink at least 8 glasses of water daily.

ACTIVITY AND HOME CARE
1. Rest at home for 1 week.
2. Do breathing exercises 3 times a day.
3. Avoid dusty places. Do not smoke.

OTHER INSTRUCTIONS
1. Check your blood sugar every morning and record it.

UNCLEAR / TO CONFIRM
None recorded.

EMERGENCY CONTACT
Pulmonology unit, Kamineni City Hospital: 040-5555-0164 (24 hours).`,
};

export const SAMPLE_CHALLENGING: SampleCase = {
  id: "SYN-003",
  label: "Conflicting & incomplete entries",
  difficulty: "Challenging",
  blurb:
    "Deliberately hard case: two conflicting Warfarin strengths, an illegible drug name, a missing duration, and a follow-up without an exact date and time.",
  text: `${COMMON_HEADER("SUNRISE GENERAL HOSPITAL, WARANGAL")}
                               [SYNTHETIC SAMPLE DOCUMENT — NOT A REAL PATIENT]
   Prepared for hackathon demonstration. All names, dates and phone numbers are fictional.

Patient ID: SYN-003
Patient Name: Sample Patient C
Admission Date: 12 March 2026
Discharge Date: 15 March 2026
Diagnosis: Atrial fibrillation, rate-controlled with medication. Viral fever, resolved during admission.

MEDICATIONS
1. Tab. Warfarin 5 mg, take 1 tablet by mouth, once daily, for 30 days. Dose adjustment pending INR report.
2. Tab. Warfarin 2 mg, take 1 tablet by mouth, once daily, for 30 days. [Conflicting entry in source — cardiology to confirm.]
3. Tab. Metoprolol 25 mg, take 1 tablet by mouth, twice daily, for 30 days. Do not stop this medicine suddenly.
4. Tab. [illegible] 500 mg, take 1 tablet by mouth, twice daily. Duration not stated.
5. Inj. Ceftriaxone 1 g, 1 vial by intramuscular injection, twice daily, for 3 days. To be given at home by a trained nurse.

FOLLOW-UP
1. INR blood test in 3 days; exact date not stated in source, confirm with the laboratory.
2. Cardiology review on 28 March 2026 at [time unclear], OPD Block A, Sunrise General Hospital.

WARNING SIGNS
1. Black stools, blood in vomit, or unusual bleeding: go to the emergency department immediately.
2. Dizziness or fainting: call 040-5555-0177.

DIET
1. Keep vitamin K intake consistent; do not start or stop green leafy vegetables suddenly.

ACTIVITY AND HOME CARE
1. Rest at home for 1 week.
2. Do not travel long distances for 1 week.

OTHER INSTRUCTIONS
1. Carry your anticoagulant card at all times.

UNCLEAR / TO CONFIRM
1. The correct Warfarin strength (5 mg or 2 mg) is unclear in this document; cardiology must confirm the dose.
2. The name of medicine number 4 is illegible in the source document.

EMERGENCY CONTACT
Cardiology unit, Sunrise General Hospital: 040-5555-0177 (24 hours).`,
};

export const SAMPLES: SampleCase[] = [SAMPLE_ROUTINE, SAMPLE_MULTIMED, SAMPLE_CHALLENGING];

export function sampleById(id: string | null | undefined): SampleCase | null {
  if (!id) return null;
  return SAMPLES.find((s) => s.id === id) ?? null;
}
