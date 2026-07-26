/**
 * SECTION: Cashsouk Risk Rating catalogue (A–F)
 * WHY: Shared grade + label + description + colour for Admin, Prospectus, and invoice offers
 * SOURCE: Cashsouk Master Risk Scoring Module_v4.xlsx → Grade and Pricing Matrix
 * COLOURS: Excel grade cells have no fill; A–E from New folder/styles.css (.grade.a–e);
 *          F from same file brand token --red (F omitted from 5-grade Canva scale)
 */

/** Canonical Cashsouk risk grades — presentation catalogue only (no scores/weights/pricing). */
export const CASHSCOUK_RISK_GRADES = ["A", "B", "C", "D", "E", "F"] as const;

export type CashsoukRiskGrade = (typeof CASHSCOUK_RISK_GRADES)[number];

/** @deprecated Prefer CASHSCOUK_RISK_GRADES — kept for existing imports. */
export const SOUKSCORE_RISK_RATING_GRADES = CASHSCOUK_RISK_GRADES;

/** @deprecated Prefer CashsoukRiskGrade. */
export type SoukscoreRiskRating = CashsoukRiskGrade;

export function isCashsoukRiskGrade(value: unknown): value is CashsoukRiskGrade {
  return (
    typeof value === "string" &&
    (CASHSCOUK_RISK_GRADES as readonly string[]).includes(value)
  );
}

/** @deprecated Prefer isCashsoukRiskGrade. */
export const isSoukscoreRiskRating = isCashsoukRiskGrade;

/** Shared unavailable copy when grade is missing or invalid (Prospectus + Admin). */
export const SOUKSCORE_RISK_RATING_UNAVAILABLE = "—";

/**
 * Grade letter colour for Prospectus / Admin rating-scale badges and Page 1 shield.
 * Always white — do not use catalogue textColor / contrast helpers for these UIs.
 */
export const CASHSCOUK_RISK_GRADE_LETTER_COLOR = "#FFFFFF" as const;

export type CashsoukRiskRatingCatalogueEntry = {
  grade: CashsoukRiskGrade;
  label: string;
  description: string;
  /** CSS hex background from grade-matrix / prospectus colour reference. */
  color: string;
  /** Readable foreground for badges/shields on this grade colour. */
  textColor: "#FFFFFF" | "#111111";
};

/** @deprecated Prefer CashsoukRiskRatingCatalogueEntry. */
export type SoukscoreRiskRatingCatalogueEntry = CashsoukRiskRatingCatalogueEntry & {
  /** Alias of description for older Prospectus view-models. */
  explanation: string;
};

/**
 * Relative luminance (sRGB) for WCAG-style contrast picks.
 * Background hex may be #RGB or #RRGGBB (optional leading #).
 */
export function getReadableTextColor(backgroundColor: string): "#FFFFFF" | "#111111" {
  const hex = backgroundColor.replace("#", "").trim();
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#111111";
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#111111" : "#FFFFFF";
}

/**
 * Hard-coded Cashsouk grade → label + description + colour.
 * Single source for Admin, Page 1/2 HTML, preview, and freeze-time resolution.
 * Do not duplicate this wording or invent alternate colours elsewhere.
 */
export const CASHSCOUK_RISK_RATING_CATALOGUE: Record<
  CashsoukRiskGrade,
  CashsoukRiskRatingCatalogueEntry
> = {
  A: {
    grade: "A",
    label: "Lower Risk",
    description:
      "The note demonstrates strong paymaster quality, sound transaction structure, stable issuer profile, and minimal adverse indicators. While not risk-free, it reflects relatively lower expected credit and operational risk compared to other notes on the platform.",
    color: "#1EB93F",
    textColor: "#FFFFFF",
  },
  B: {
    grade: "B",
    label: "Moderate-Low Risk",
    description:
      "The note presents generally favourable risk characteristics with minor sensitivities. Some moderate risk factors may be present, but overall structural and credit indicators remain sound.",
    color: "#79CF54",
    textColor: "#111111",
  },
  C: {
    grade: "C",
    label: "Moderate Risk",
    description:
      "The note reflects typical SME and transaction-level risks. Certain risk factors such as shorter operating history, moderate leverage, or first-time commercial relationships may be present. Suitable for investors comfortable with standard SME credit exposure.",
    color: "#FFCF45",
    textColor: "#111111",
  },
  D: {
    grade: "D",
    label: "Higher Risk",
    description:
      "The note contains elevated risk characteristics, such as higher leverage, limited payment history, structural limitations, or weaker financial indicators. Investors should expect greater variability in payment timing and outcomes.",
    color: "#FF8647",
    textColor: "#FFFFFF",
  },
  E: {
    grade: "E",
    label: "High Risk",
    description:
      "The note demonstrates multiple risk sensitivities, including financial, structural, or behavioural concerns. Suitable only for investors with higher risk tolerance and understanding of potential delay or recovery scenarios.",
    color: "#CE201D",
    textColor: "#FFFFFF",
  },
  F: {
    grade: "F",
    label: "Not Eligible",
    description:
      "The note does not meet the Platform’s minimum listing standards due to legal, structural, integrity, or material credit concerns. It will not be made available for investment.",
    color: "#B10810",
    textColor: "#FFFFFF",
  },
};

/** Catalogue with explanation alias for older Prospectus scale builders. */
export const SOUKSCORE_RISK_RATING_CATALOGUE: Record<
  CashsoukRiskGrade,
  SoukscoreRiskRatingCatalogueEntry
> = {
  A: { ...CASHSCOUK_RISK_RATING_CATALOGUE.A, explanation: CASHSCOUK_RISK_RATING_CATALOGUE.A.description },
  B: { ...CASHSCOUK_RISK_RATING_CATALOGUE.B, explanation: CASHSCOUK_RISK_RATING_CATALOGUE.B.description },
  C: { ...CASHSCOUK_RISK_RATING_CATALOGUE.C, explanation: CASHSCOUK_RISK_RATING_CATALOGUE.C.description },
  D: { ...CASHSCOUK_RISK_RATING_CATALOGUE.D, explanation: CASHSCOUK_RISK_RATING_CATALOGUE.D.description },
  E: { ...CASHSCOUK_RISK_RATING_CATALOGUE.E, explanation: CASHSCOUK_RISK_RATING_CATALOGUE.E.description },
  F: { ...CASHSCOUK_RISK_RATING_CATALOGUE.F, explanation: CASHSCOUK_RISK_RATING_CATALOGUE.F.description },
};

export type SoukscoreRiskRatingPresentation = {
  grade: string;
  label: string;
  explanation: string;
  description: string;
  color: string;
  textColor: string;
  isAvailable: boolean;
};

/** Resolve display grade/label/description/colour from offer risk_rating. No separate storage. */
export function resolveSoukscoreRiskRatingPresentation(
  value: unknown
): SoukscoreRiskRatingPresentation {
  if (!isCashsoukRiskGrade(value)) {
    return {
      grade: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      label: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      explanation: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      description: SOUKSCORE_RISK_RATING_UNAVAILABLE,
      color: "#D4D4D4",
      textColor: "#111111",
      isAvailable: false,
    };
  }
  const entry = CASHSCOUK_RISK_RATING_CATALOGUE[value];
  return {
    grade: entry.grade,
    label: entry.label,
    explanation: entry.description,
    description: entry.description,
    color: entry.color,
    textColor: entry.textColor,
    isAvailable: true,
  };
}
