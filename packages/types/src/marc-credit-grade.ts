/**
 * Shared MARC SME credit-grade catalogue for prospectus, admin org, and freeze snapshots.
 * Score bands and PD values come from the approved Strato methodology appendix.
 */

export const MARC_SME_GRADES = [
  "SME-1",
  "SME-2",
  "SME-3",
  "SME-4",
  "SME-5",
  "SME-6",
  "SME-7",
  "SME-8",
  "SME-9",
  "SME-10",
] as const;

export type MarcSmeGrade = (typeof MARC_SME_GRADES)[number];

/**
 * CashSouk visual grouping for the Page 2 scale.
 * `label` is a CashSouk band name, not official MARC Risk Profile wording.
 * Official grade descriptions live in {@link MARC_SCORE_DEFINITIONS}.
 */
export const MARC_SME_BANDS = [
  {
    key: "a",
    grades: ["SME-1", "SME-2"] as const,
    rangeLabel: "SME-1 - SME-2",
    compactRangeLabel: "SME-1–2",
    label: "Very Low Risk",
    groupedExplanation: "Very strong credit strength; minimal repayment risk.",
    color: "#69ca48",
  },
  {
    key: "b",
    grades: ["SME-3", "SME-4"] as const,
    rangeLabel: "SME-3 - SME-4",
    compactRangeLabel: "SME-3–4",
    label: "Low Risk",
    groupedExplanation: "Strong credit strength; low repayment risk.",
    color: "#8ed657",
  },
  {
    key: "c",
    grades: ["SME-5", "SME-6"] as const,
    rangeLabel: "SME-5 - SME-6",
    compactRangeLabel: "SME-5–6",
    label: "Moderate Risk",
    groupedExplanation: "Moderate credit strength; moderate repayment risk.",
    color: "#f5ca47",
  },
  {
    key: "d",
    grades: ["SME-7", "SME-8"] as const,
    rangeLabel: "SME-7 - SME-8",
    compactRangeLabel: "SME-7–8",
    label: "High Risk",
    groupedExplanation: "Weak credit strength; elevated default risk.",
    color: "#f5964f",
  },
  {
    key: "e",
    grades: ["SME-9", "SME-10"] as const,
    rangeLabel: "SME-9 - SME-10",
    compactRangeLabel: "SME-9–10",
    label: "Very High Risk",
    groupedExplanation: "Very weak credit strength; high default risk.",
    color: "#ef776c",
  },
] as const;

export type MarcSmeBandKey = (typeof MARC_SME_BANDS)[number]["key"];

export const MARC_SCORE_DEFINITIONS: Record<
  MarcSmeGrade,
  { scoreRange: string; pd: string; riskProfile: string }
> = {
  "SME-1": {
    scoreRange: "90-100",
    pd: "0.24%",
    riskProfile: "Extremely strong credit strength with very low non-repayment risk",
  },
  "SME-2": {
    scoreRange: "80-89.99",
    pd: "0.69%",
    riskProfile: "Very strong credit strength with low non-repayment risk",
  },
  "SME-3": {
    scoreRange: "70-79.99",
    pd: "1.13%",
    riskProfile: "Strong credit strength with low non-repayment risk",
  },
  "SME-4": {
    scoreRange: "60-69.99",
    pd: "7.43%",
    riskProfile: "Strong credit strength with moderate non-repayment risk",
  },
  "SME-5": {
    scoreRange: "50-59.99",
    pd: "13.73%",
    riskProfile: "Moderate credit strength with moderate non-repayment risk",
  },
  "SME-6": {
    scoreRange: "40-49.99",
    pd: "20.02%",
    riskProfile: "Moderate credit strength with high non-repayment risk",
  },
  "SME-7": {
    scoreRange: "30-39.99",
    pd: "25.89%",
    riskProfile: "Weak credit strength with high non-repayment risk",
  },
  "SME-8": {
    scoreRange: "20-29.99",
    pd: "31.76%",
    riskProfile: "Weak credit strength with potential to default",
  },
  "SME-9": {
    scoreRange: "10-19.99",
    pd: "37.63%",
    riskProfile: "Very weak credit strength with potential to default",
  },
  "SME-10": {
    scoreRange: "0-9.99",
    pd: "45.00%",
    riskProfile: "Very weak credit strength with high potential to default",
  },
};

export function isMarcSmeGrade(value: unknown): value is MarcSmeGrade {
  return typeof value === "string" && (MARC_SME_GRADES as readonly string[]).includes(value);
}

/** Active Note/invoice risk rating grades — MARC SME only. */
export const NOTE_RISK_RATING_GRADES = MARC_SME_GRADES;
export type NoteRiskRating = MarcSmeGrade;
export const isNoteRiskRating = isMarcSmeGrade;

export const MARC_ASSESSMENT_REQUIRED_MESSAGE = "MARC assessment is required.";
export const MARC_CREDIT_SCORE_REQUIRED_MESSAGE = "Credit Score is required.";
export const MARC_CREDIT_SCORE_RANGE_MESSAGE = "Credit Score must be between 0 and 100.";
export const MARC_PD_REQUIRED_MESSAGE = "Probability of Default is required.";
export const MARC_PD_RANGE_MESSAGE = "Probability of Default must be between 0% and 100%.";
export const MARC_REPORT_REQUIRED_MESSAGE = "MARC report is required.";
export const MARC_REPORT_DATE_REQUIRED_MESSAGE = "Report Date is required.";
export const MARC_CREDIT_GRADE_FROM_SCORE_HELP =
  "Automatically determined from the MARC Credit Score.";
export const NOTE_RISK_RATING_UNASSIGNED_MESSAGE = "Risk rating has not been assigned.";

/**
 * Saved invoice risk_rating wins. Otherwise suggest the issuer MARC grade.
 * Never maps A–F or other legacy values into the active MARC flow.
 */
export function resolveDefaultInvoiceRiskRating(
  savedRiskRating: unknown,
  orgMarcGrade: unknown
): MarcSmeGrade | null {
  if (isMarcSmeGrade(savedRiskRating)) return savedRiskRating;
  if (isMarcSmeGrade(orgMarcGrade)) return orgMarcGrade;
  return null;
}

export type MarcNoteRiskPresentation = {
  grade: string;
  label: string;
  riskProfile: string;
  color: string;
  textColor: "#ffffff";
  isAvailable: boolean;
};

/** Individual Note/invoice SME display. Incomplete when no MARC SME grade is stored. */
export function resolveMarcNoteRiskPresentation(value: unknown): MarcNoteRiskPresentation {
  if (!isMarcSmeGrade(value)) {
    return {
      grade: "—",
      label: "—",
      riskProfile: "—",
      color: "#d4d4d4",
      textColor: "#ffffff",
      isAvailable: false,
    };
  }
  return {
    grade: value,
    label: marcGradeLabel(value),
    riskProfile: MARC_SCORE_DEFINITIONS[value].riskProfile,
    color: marcGradeColor(value),
    textColor: "#ffffff",
    isAvailable: true,
  };
}

export function marcBandForGrade(grade: string | null | undefined) {
  if (!grade) return null;
  return MARC_SME_BANDS.find((band) => (band.grades as readonly string[]).includes(grade)) ?? null;
}

export function marcGradeColor(grade: string | null | undefined): string {
  return marcBandForGrade(grade)?.color ?? "#69ca48";
}

export function marcGradeLabel(grade: string | null | undefined): string {
  return marcBandForGrade(grade)?.label ?? "";
}

export function marcOfficialScoreRange(grade: string | null | undefined): string | null {
  if (!isMarcSmeGrade(grade)) return null;
  return MARC_SCORE_DEFINITIONS[grade].scoreRange;
}

export function marcOfficialPd(grade: string | null | undefined): string | null {
  if (!isMarcSmeGrade(grade)) return null;
  return MARC_SCORE_DEFINITIONS[grade].pd;
}

/** Official MARC Risk Profile for a single SME grade. Never a CashSouk paraphrase. */
export function marcOfficialRiskProfile(grade: string | null | undefined): string | null {
  if (!isMarcSmeGrade(grade)) return null;
  return MARC_SCORE_DEFINITIONS[grade].riskProfile;
}

export function marcBandOfficialGradeProfiles(
  band: (typeof MARC_SME_BANDS)[number]
): ReadonlyArray<{ grade: MarcSmeGrade; riskProfile: string }> {
  return band.grades.map((grade) => ({
    grade,
    riskProfile: MARC_SCORE_DEFINITIONS[grade].riskProfile,
  }));
}

export interface MarcAssessmentSnapshot {
  creditGrade: string | null;
  creditScore: string | number | null;
  probabilityOfDefault: string | number | null;
  reportDate: string | null;
  reportFileName: string | null;
  reportS3Key?: string | null;
  assessedAt: string | null;
}

function numericFromUnknown(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type MarcParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

/** Credit score storage matches Decimal(7, 2): 0–100, two decimal places. */
export function parseMarcCreditScore(value: unknown): MarcParseResult {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return { ok: false, message: MARC_CREDIT_SCORE_REQUIRED_MESSAGE };
  }
  const n = numericFromUnknown(value);
  if (n == null) return { ok: false, message: MARC_CREDIT_SCORE_RANGE_MESSAGE };
  if (n < 0 || n > 100) return { ok: false, message: MARC_CREDIT_SCORE_RANGE_MESSAGE };
  return { ok: true, value: roundToDecimals(n, 2) };
}

/**
 * PD is stored as a percentage (1.13 = 1.13%), matching Decimal(7, 4).
 * Not a 0–1 fraction and not auto-filled from the SME methodology table.
 */
export function parseMarcProbabilityOfDefault(value: unknown): MarcParseResult {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return { ok: false, message: MARC_PD_REQUIRED_MESSAGE };
  }
  const n = numericFromUnknown(value);
  if (n == null) return { ok: false, message: MARC_PD_RANGE_MESSAGE };
  if (n < 0 || n > 100) return { ok: false, message: MARC_PD_RANGE_MESSAGE };
  return { ok: true, value: roundToDecimals(n, 4) };
}

export function parseOfficialMarcScoreRange(range: string): { min: number; max: number } | null {
  const match = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(range.trim());
  if (!match) return null;
  return { min: Number(match[1]), max: Number(match[2]) };
}

/**
 * Official MARC score → SME grade using {@link MARC_SCORE_DEFINITIONS} ranges.
 * Inclusive on both bounds (90 → SME-1, 89.99 → SME-2).
 */
export function marcSmeGradeFromCreditScore(score: unknown): MarcSmeGrade | null {
  const parsed = parseMarcCreditScore(score);
  if (!parsed.ok) return null;
  const rounded = parsed.value;
  for (const grade of MARC_SME_GRADES) {
    const bounds = parseOfficialMarcScoreRange(MARC_SCORE_DEFINITIONS[grade].scoreRange);
    if (!bounds) continue;
    if (rounded + Number.EPSILON >= bounds.min && rounded - Number.EPSILON <= bounds.max) {
      return grade;
    }
  }
  return null;
}

function hasMarcReport(assessment: MarcAssessmentSnapshot): boolean {
  const fileName =
    typeof assessment.reportFileName === "string" ? assessment.reportFileName.trim() : "";
  const s3Key = typeof assessment.reportS3Key === "string" ? assessment.reportS3Key.trim() : "";
  return Boolean(fileName || s3Key);
}

function hasMarcReportDate(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** Organization MARC is complete when score, derived-capable grade, PD, report, and date exist. */
export function isCompleteIssuerMarcAssessment(
  assessment: MarcAssessmentSnapshot | null | undefined
): boolean {
  if (!assessment) return false;
  if (!isMarcSmeGrade(assessment.creditGrade)) return false;
  if (!parseMarcCreditScore(assessment.creditScore).ok) return false;
  if (!parseMarcProbabilityOfDefault(assessment.probabilityOfDefault).ok) return false;
  if (!hasMarcReport(assessment)) return false;
  return hasMarcReportDate(assessment.reportDate);
}
