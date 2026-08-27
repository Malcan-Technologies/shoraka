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

export const MARC_SME_BANDS = [
  {
    key: "a",
    grades: ["SME-1", "SME-2"] as const,
    rangeLabel: "SME-1 - SME-2",
    label: "Very Low Risk",
    explanation: "Very strong credit strength; minimal repayment risk.",
    color: "#69ca48",
  },
  {
    key: "b",
    grades: ["SME-3", "SME-4"] as const,
    rangeLabel: "SME-3 - SME-4",
    label: "Low Risk",
    explanation: "Strong credit strength; low repayment risk.",
    color: "#8ed657",
  },
  {
    key: "c",
    grades: ["SME-5", "SME-6"] as const,
    rangeLabel: "SME-5 - SME-6",
    label: "Moderate Risk",
    explanation: "Moderate credit strength; moderate repayment risk.",
    color: "#f5ca47",
  },
  {
    key: "d",
    grades: ["SME-7", "SME-8"] as const,
    rangeLabel: "SME-7 - SME-8",
    label: "High Risk",
    explanation: "Weak credit strength; elevated default risk.",
    color: "#f5964f",
  },
  {
    key: "e",
    grades: ["SME-9", "SME-10"] as const,
    rangeLabel: "SME-9 - SME-10",
    label: "Very High Risk",
    explanation: "Very weak credit strength; high default risk.",
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

export interface MarcAssessmentSnapshot {
  creditGrade: string | null;
  creditScore: string | number | null;
  probabilityOfDefault: string | number | null;
  reportDate: string | null;
  reportFileName: string | null;
  assessedAt: string | null;
}
