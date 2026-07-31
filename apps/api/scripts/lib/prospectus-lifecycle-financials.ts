/**
 * Financial statement / CTOS builders for Prospectus lifecycle seed year variants.
 *
 * Uses a fixed 2024–2026 reporting span for 2026 UAT seeds.
 * Do not derive years from `currentYear + 1` / `futureFyeIso` — that created FY2027.
 */

import {
  getAdminFinancialSummaryUserColumnYears,
  getFinancialYearPeriodEndIso,
  issuerUnauditedPlddForFyEndYear,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import type { Prisma } from "@prisma/client";

export type LifecycleFinancialVariant =
  | "three_years"
  | "one_year"
  | "two_years"
  | "gapped_years";

/** Fixed reporting span for normal Prospectus lifecycle seeds (no future FY2027). */
export const LIFECYCLE_REPORTING_YEARS = {
  y0: 2024,
  y1: 2025,
  y2: 2026,
} as const;

/** Company financial-year-end month/day (2 Sep) — year label must match date year. */
export const LIFECYCLE_FYE_MONTH_DAY = "09-02" as const;

const SERIES = [
  {
    turnover: 12_000_000,
    plnpbt: 1_100_000,
    plnpat: 900_000,
    bscatot: 4_000_000,
    bsfatot: 1_500_000,
    othass: 1_000_000,
    curlib: 2_000_000,
    bsslltd: 500_000,
    bsclstd: 200_000,
    bsclbank: 900_000,
    bsqpuc: 5_000_000,
    plnetdiv: 50_000,
    plyear: 200_000,
  },
  {
    turnover: 13_900_000,
    plnpbt: 1_300_000,
    plnpat: 1_100_000,
    bscatot: 4_200_000,
    bsfatot: 1_600_000,
    othass: 1_100_000,
    curlib: 2_100_000,
    bsslltd: 550_000,
    bsclstd: 250_000,
    bsclbank: 950_000,
    bsqpuc: 5_500_000,
    plnetdiv: 60_000,
    plyear: 220_000,
  },
  {
    turnover: 15_000_000,
    plnpbt: 1_400_000,
    plnpat: 1_200_000,
    bscatot: 4_500_000,
    bsfatot: 1_700_000,
    othass: 1_200_000,
    curlib: 2_200_000,
    bsslltd: 600_000,
    bsclstd: 300_000,
    bsclbank: 1_000_000,
    bsqpuc: 6_000_000,
    plnetdiv: 70_000,
    plyear: 240_000,
  },
] as const;

export function lifecycleQuestionnaire(): FinancialStatementsQuestionnaire {
  return {
    financial_year_end: `${LIFECYCLE_REPORTING_YEARS.y2}-${LIFECYCLE_FYE_MONTH_DAY}`,
  };
}

/** Newest real reporting year for lifecycle seeds (fixed FY2026). */
export function lifecycleNewestYear(): number {
  return LIFECYCLE_REPORTING_YEARS.y2;
}

function blockFor(
  year: number,
  index: number,
  questionnaire: FinancialStatementsQuestionnaire
): Record<string, unknown> {
  const series = SERIES[Math.min(Math.max(index, 0), SERIES.length - 1)]!;
  return {
    ...series,
    pldd: issuerUnauditedPlddForFyEndYear(year, questionnaire),
  };
}

function ctosRow(
  year: number,
  index: number,
  questionnaire: FinancialStatementsQuestionnaire
) {
  return {
    financial_year: year,
    dates: {
      pldd: getFinancialYearPeriodEndIso(questionnaire, year) ?? `${year}-${LIFECYCLE_FYE_MONTH_DAY}`,
      bsdd: null,
    },
    account: { ...SERIES[Math.min(Math.max(index, 0), SERIES.length - 1)]! },
  };
}

/**
 * Build application financial_statements + org CTOS rows for a lifecycle FY variant.
 * `ref` only affects which years land in unaudited vs CTOS (SSM window); year numbers stay fixed.
 */
export function buildLifecycleFinancialBundle(
  variant: LifecycleFinancialVariant,
  ref: Date = new Date()
): {
  financialStatements: Record<string, unknown>;
  ctosFinancials: unknown[];
  realYears: number[];
} {
  const questionnaire = lifecycleQuestionnaire();
  const { y0, y1, y2 } = LIFECYCLE_REPORTING_YEARS;

  if (variant === "one_year") {
    // Real: FY2026 only → display pads FY2024 | FY2025 | FY2026.
    const unaudited_by_year: Record<string, Record<string, unknown>> = {
      [String(y2)]: blockFor(y2, 2, questionnaire),
    };
    return {
      financialStatements: { questionnaire, unaudited_by_year },
      ctosFinancials: [],
      realYears: [y2],
    };
  }

  if (variant === "two_years") {
    // Real: FY2025 (CTOS) + FY2026 (unaudited) → display pads FY2024.
    const unaudited_by_year: Record<string, Record<string, unknown>> = {
      [String(y2)]: blockFor(y2, 2, questionnaire),
    };
    return {
      financialStatements: { questionnaire, unaudited_by_year },
      ctosFinancials: [ctosRow(y1, 1, questionnaire)],
      realYears: [y1, y2],
    };
  }

  if (variant === "gapped_years") {
    // Real: FY2024 (CTOS) + FY2026 (unaudited); FY2025 missing → display placeholder.
    // Never seed FY2027.
    const unaudited_by_year: Record<string, Record<string, unknown>> = {
      [String(y2)]: blockFor(y2, 2, questionnaire),
    };
    return {
      financialStatements: { questionnaire, unaudited_by_year },
      ctosFinancials: [ctosRow(y0, 0, questionnaire)],
      realYears: [y0, y2],
    };
  }

  // three_years — CTOS for older span years + unaudited SSM years → FY2024|FY2025|FY2026.
  const span = [y0, y1, y2];
  const ssmYears = getAdminFinancialSummaryUserColumnYears(questionnaire, ref).filter((year) =>
    span.includes(year)
  );
  const unauditedYears = ssmYears.includes(y2) ? ssmYears : [...ssmYears, y2];
  const unaudited_by_year: Record<string, Record<string, unknown>> = {};
  for (const year of unauditedYears) {
    const index = span.indexOf(year);
    unaudited_by_year[String(year)] = blockFor(year, index >= 0 ? index : 2, questionnaire);
  }
  const ctosFinancials = span
    .map((year, index) =>
      unaudited_by_year[String(year)] ? null : ctosRow(year, index, questionnaire)
    )
    .filter((row): row is NonNullable<typeof row> => row != null);

  return {
    financialStatements: { questionnaire, unaudited_by_year },
    ctosFinancials,
    realYears: span,
  };
}

export function ctosJson(rows: unknown[]): Prisma.InputJsonValue {
  return rows as Prisma.InputJsonValue;
}
