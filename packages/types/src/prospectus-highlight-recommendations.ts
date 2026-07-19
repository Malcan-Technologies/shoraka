/**
 * Page 1 Key Investor Highlights — recommendation + fixed copy helpers.
 * Officer may edit paymaster / issuer / return; Shariah is fixed read-only.
 */

import { calculateCalendarDayCount } from "./prospectus-calendar";
import { PROSPECTUS_FIXED_SHARIAH_PRINCIPLE } from "./prospectus-fixed-templates";
import {
  isSoukscoreRiskRating,
  type SoukscoreRiskRating,
} from "./invoice-offer-risk-rating";
import { formatInvestorReturnRatePercent } from "./note-expected-return";

export const PROSPECTUS_HIGHLIGHT_KEYS = [
  "paymaster",
  "issuer_fundamentals",
  "return",
  "shariah",
] as const;

export type ProspectusHighlightKey = (typeof PROSPECTUS_HIGHLIGHT_KEYS)[number];

export type ProspectusHighlightCopy = {
  title: string;
  description: string;
};

export const PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT_TITLE = "Shariah financing structure";

export const PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT_DESCRIPTION = `This Note is structured under ${PROSPECTUS_FIXED_SHARIAH_PRINCIPLE}.`;

export const PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT: ProspectusHighlightCopy = {
  title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT_TITLE,
  description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT_DESCRIPTION,
};

/** Placeholder SoukScore → Issuer Financial Strength recommendations (not approved claims). */
export const ISSUER_FINANCIAL_STRENGTH_RECOMMENDATIONS: Record<
  SoukscoreRiskRating,
  ProspectusHighlightCopy
> = {
  AAA: {
    title: "Issuer financial profile",
    description: "Placeholder recommendation for an issuer with a AAA risk rating.",
  },
  AA: {
    title: "Issuer financial profile",
    description: "Placeholder recommendation for an issuer with an AA risk rating.",
  },
  A: {
    title: "Issuer financial profile",
    description: "Placeholder recommendation for an issuer with an A risk rating.",
  },
  BBB: {
    title: "Issuer financial profile",
    description: "Placeholder recommendation for an issuer with a BBB risk rating.",
  },
  BB: {
    title: "Issuer financial profile",
    description: "Placeholder recommendation for an issuer with a BB risk rating.",
  },
  B: {
    title: "Issuer financial profile",
    description: "Placeholder recommendation for an issuer with a B risk rating.",
  },
};

export type PaymasterNatureBucket =
  | "government"
  | "glc"
  | "corporate"
  | "unknown";

const DNA = "Data not available";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOrEmpty(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/** Normalise paymaster_snapshot.entity_type into a small recommendation bucket. */
export function normalizePaymasterNatureBucket(
  entityType: string | null | undefined
): PaymasterNatureBucket {
  if (!entityType?.trim()) return "unknown";
  const raw = entityType.trim().toLowerCase();
  if (
    /\bglc\b/.test(raw) ||
    raw.includes("government-linked") ||
    raw.includes("government linked")
  ) {
    return "glc";
  }
  if (
    raw.includes("government") ||
    raw.includes("ministry") ||
    raw.includes("kementerian") ||
    raw.includes("agency")
  ) {
    return "government";
  }
  if (
    raw.includes("corporate") ||
    raw.includes("private") ||
    raw.includes("company") ||
    raw.includes("sdn")
  ) {
    return "corporate";
  }
  return "unknown";
}

function paymasterTitleForBucket(bucket: PaymasterNatureBucket): string {
  switch (bucket) {
    case "government":
      return "Backed by a government paymaster";
    case "glc":
      return "Supported by a government-linked paymaster";
    case "corporate":
      return "Supported by a corporate paymaster";
    default:
      return "Paymaster-backed invoice";
  }
}

function paymasterNatureSuffix(bucket: PaymasterNatureBucket, entityType: string): string {
  switch (bucket) {
    case "government":
      return ", a government agency";
    case "glc":
      return ", a government-linked company";
    case "corporate":
      return entityType ? `, ${entityType}` : ", a corporate paymaster";
    default:
      return entityType ? ` (${entityType})` : "";
  }
}

/**
 * Paymaster highlight recommendation from paymaster_snapshot only.
 * No track-record or government-backed security claims.
 */
export function recommendPaymasterHighlight(input: {
  paymasterSnapshot?: unknown;
}): ProspectusHighlightCopy {
  const snap = asRecord(input.paymasterSnapshot);
  const name = textOrEmpty(snap?.name);
  const entityType = textOrEmpty(snap?.entity_type ?? snap?.entityType ?? snap?.type);

  if (!name) {
    return { title: "Paymaster information", description: DNA };
  }

  const bucket = normalizePaymasterNatureBucket(entityType || null);
  const suffix = paymasterNatureSuffix(bucket, entityType);
  return {
    title: paymasterTitleForBucket(bucket),
    description: `The invoice is payable by ${name}${suffix}.`,
  };
}

/**
 * Issuer Financial Strength recommendation from standardised SoukScore risk rating.
 * Placeholder copy only — not approved financial claims.
 */
export function recommendIssuerFinancialStrengthHighlight(input: {
  riskRating?: unknown;
}): ProspectusHighlightCopy {
  if (!isSoukscoreRiskRating(input.riskRating)) {
    return {
      title: "Issuer financial profile",
      description: DNA,
    };
  }
  return ISSUER_FINANCIAL_STRENGTH_RECOMMENDATIONS[input.riskRating];
}

/**
 * Return highlight recommendation from Profit Rate (gross) and Tenure (calendar days).
 */
export function recommendReturnHighlight(input: {
  profitRatePercent?: number | null;
  listingOpensAt?: string | null;
  maturityDate?: string | null;
}): ProspectusHighlightCopy {
  const rate = input.profitRatePercent;
  const opensAt = input.listingOpensAt;
  const maturity = input.maturityDate;
  if (rate == null || !Number.isFinite(rate) || !opensAt || !maturity) {
    return { title: "Return information", description: DNA };
  }
  const start = new Date(opensAt);
  const end = new Date(maturity);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { title: "Return information", description: DNA };
  }
  const days = calculateCalendarDayCount(start, end);
  const rateLabel = formatInvestorReturnRatePercent(rate);
  if (rateLabel === "-" || days <= 0) {
    return { title: "Return information", description: DNA };
  }
  return {
    title: `${rateLabel} p.a. over ${days} days`,
    description: `This Note offers a profit rate of ${rateLabel} p.a. with a tenure of ${days} days.`,
  };
}

export function recommendShariahHighlight(): ProspectusHighlightCopy {
  return { ...PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT };
}

export type ProspectusHighlightRecommendationInput = {
  paymasterSnapshot?: unknown;
  riskRating?: unknown;
  profitRatePercent?: number | null;
  listingOpensAt?: string | null;
  maturityDate?: string | null;
};

/** Build all four highlight recommendations for a Note. */
export function buildProspectusHighlightRecommendations(
  input: ProspectusHighlightRecommendationInput
): Record<ProspectusHighlightKey, ProspectusHighlightCopy> {
  return {
    paymaster: recommendPaymasterHighlight(input),
    issuer_fundamentals: recommendIssuerFinancialStrengthHighlight(input),
    return: recommendReturnHighlight(input),
    shariah: recommendShariahHighlight(),
  };
}
