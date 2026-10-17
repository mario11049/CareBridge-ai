// CareBridge AI — core domain types.
// Everything is typed end-to-end so the extractor, planner, validator and
// evaluator all speak the same structured language.

export type Lang = "en" | "te";

export interface Evidence {
  section: string;
  line: number | null; // 1-based line number in the source text
  snippet: string;
  locationAvailable: boolean;
}

export interface Medication {
  id: string;
  raw: string;
  formulation: string | null; // Tab. / Cap. / Syr. / Inj. ...
  name: string | null;
  strength: string | null; // "650 mg"
  dose: string | null; // "1 tablet"
  route: string | null; // "by mouth"
  frequency: string | null; // "three times daily"
  duration: string | null; // "5 days"
  durationDays: number | null; // normalised day count when derivable
  special: string | null;
  prescribedTimes: string[] | null; // only when the source states explicit times
  flags: string[];
  evidence: Evidence;
}

export interface FollowUp {
  id: string;
  raw: string;
  title: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  preparation: string | null;
  flags: string[];
  evidence: Evidence;
}

export interface WarningSign {
  id: string;
  raw: string;
  sign: string | null;
  action: string | null;
  flags: string[];
  evidence: Evidence;
}

export type InstructionCategory = "diet" | "activity" | "home_care" | "other";

export interface InstructionItem {
  id: string;
  category: InstructionCategory;
  raw: string;
  text: string;
  flags: string[];
  evidence: Evidence;
}

export interface UnclearItem {
  id: string;
  reason: string;
  text: string;
  evidence: Evidence | null;
}

export interface HeaderInfo {
  hospital: string | null;
  patientId: string | null;
  patientName: string | null;
  admissionDate: string | null;
  dischargeDate: string | null;
  diagnosis: string | null;
  emergencyContact: string | null;
}

export interface Extraction {
  header: HeaderInfo;
  medications: Medication[];
  followUps: FollowUp[];
  warningSigns: WarningSign[];
  instructions: InstructionItem[];
  unclear: UnclearItem[];
  meta: {
    detectedFormat: boolean;
    parserNotes: string[];
    synthetic: boolean;
    sourceLineCount: number;
  };
}

// ---------------- Care plan ----------------

export interface PlanMed {
  id: string;
  sourceId: string | null; // null => unsupported addition (validator must flag)
  name: string | null;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  prescribedTimes: string[] | null;
  specialEn: string | null;
  specialTe: string | null;
  specialTeReview: boolean;
  howEn: string; // composed patient sentence (English)
  howTe: string; // composed patient sentence (Telugu, English preserved as needed)
  howTeReview: boolean;
  flags: string[];
  evidence: Evidence | null;
}

export interface PlanInstruction {
  id: string;
  sourceId: string | null;
  category: InstructionCategory;
  en: string;
  te: string | null;
  teReview: boolean;
  evidence: Evidence | null;
}

export interface PlanFollowUp {
  id: string;
  sourceId: string | null;
  title: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  preparation: string | null;
  titleTe: string | null;
  prepTe: string | null;
  teReview: boolean;
  evidence: Evidence | null;
}

export interface PlanWarning {
  id: string;
  sourceId: string | null;
  sign: string | null;
  action: string | null;
  signTe: string | null;
  actionTe: string | null;
  teReview: boolean;
  evidence: Evidence | null;
}

export interface PlanQuestion {
  id: string;
  en: string;
  te: string | null;
  teReview: boolean;
  relatedField: string;
}

export interface CarePlan {
  id: string;
  createdAt: string;
  whatHappened: {
    en: string | null;
    te: string | null;
    teReview: boolean;
    evidence: Evidence | null;
  };
  medications: PlanMed[];
  home: PlanInstruction[];
  followUps: PlanFollowUp[];
  warnings: PlanWarning[];
  questions: PlanQuestion[];
  teReviewCount: number;
}

// ---------------- Validation ----------------

export type ReviewStatus = "matched" | "needs_review" | "mismatch" | "not_evaluated";

export interface AuditRow {
  id: string;
  group: string;
  field: string;
  label: string;
  critical: boolean;
  sourceValue: string;
  planValue: string;
  status: ReviewStatus;
  evidence: Evidence | null;
  action: string;
}

export interface ValidationReport {
  createdAt: string;
  rows: AuditRow[];
  counts: Record<ReviewStatus, number>;
  criticalFailures: number;
  criticalReviews: number;
  verified: boolean;
  verifiedReason: string;
}

// ---------------- Samples / processing ----------------

export interface SampleCase {
  id: string;
  label: string;
  difficulty: "Routine" | "Moderate" | "Challenging";
  blurb: string;
  text: string;
}

export interface PipelineResult {
  mode: "demo" | "live";
  extraction: Extraction;
  plan: CarePlan;
  report: ValidationReport;
  sourceText: string;
  sourceName: string;
  sampleId: string | null;
  processedAt: string;
}
