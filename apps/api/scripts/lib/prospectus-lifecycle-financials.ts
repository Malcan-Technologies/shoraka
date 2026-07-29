/**
 * Financial statement / CTOS builders for Prospectus lifecycle seed year variants.
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function futureFyeIso(ref: Date): string {
  return isoDate(new Date(ref.getTime() + 400 * 24 * 60 * 60 * 1000));
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

/**
 * Resolve the newest FY-end year the issuer SSM window expects for `ref`.
 */
export function lifecycleNewestYear(ref: Date = new Date()): number {
  const questionnaire: FinancialStatementsQuestionnaire = {
    financial_year_end: futureFyeIso(ref),
  };
  const ssm = getAdminFinancialSummaryUserColumnYears(questionnaire, ref);
  if (ssm.length > 0) return Math.max(...ssm);
  return Number(questionnaire.financial_year_end.slice(0, 4));
}

export function buildLifecycleFinancialBundle(
  variant: LifecycleFinancialVariant,
  ref: Date = new Date()
): {
  financialStatements: Record<string, unknown>;
  ctosFinancials: unknown[];
  realYears: number[];
} {
  const questionnaire: FinancialStatementsQuestionnaire = {
    financial_year_end: futureFyeIso(ref),
  };
  const newest = lifecycleNewestYear(ref);
  const y0 = newest - 2;
  const y1 = newest - 1;
  const y2 = newest;

  if (variant === "one_year") {
    // Only newest unaudited year; no CTOS → display pads Y-2 / Y-1.
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
    // CTOS for Y-1 + unaudited Y-2 (SSM window may already ask for Y-1/Y-2).
    const ssmYears = getAdminFinancialSummaryUserColumnYears(questionnaire, ref);
    const unaudited_by_year: Record<string, Record<string, unknown>> = {};
    for (const year of ssmYears) {
      if (year === y2) {
        unaudited_by_year[String(year)] = blockFor(year, 2, questionnaire);
      }
    }
    if (!unaudited_by_year[String(y2)]) {
      unaudited_by_year[String(y2)] = blockFor(y2, 2, questionnaire);
    }
    const ctosFinancials = [
      {
        financial_year: y1,
        dates: {
          pldd: getFinancialYearPeriodEndIso(questionnaire, y1) ?? `${y1}-12-31`,
          bsdd: null,
        },
        account: { ...SERIES[1] },
      },
    ];
    return {
      financialStatements: { questionnaire, unaudited_by_year },
      ctosFinancials,
      realYears: [y1, y2],
    };
  }

  if (variant === "gapped_years") {
    // Real Y0 (CTOS) + Y2 (unaudited); Y1 missing → display placeholder.
    const unaudited_by_year: Record<string, Record<string, unknown>> = {
      [String(y2)]: blockFor(y2, 2, questionnaire),
    };
    const ctosFinancials = [
      {
        financial_year: y0,
        dates: {
          pldd: getFinancialYearPeriodEndIso(questionnaire, y0) ?? `${y0}-12-31`,
          bsdd: null,
        },
        account: { ...SERIES[0] },
      },
    ];
    return {
      financialStatements: { questionnaire, unaudited_by_year },
      ctosFinancials,
      realYears: [y0, y2],
    };
  }

  // three_years — CTOS for older span years + unaudited SSM years.
  const ssmYears = getAdminFinancialSummaryUserColumnYears(questionnaire, ref);
  const span = [y0, y1, y2];
  const ssmSet = new Set(ssmYears);
  const unaudited_by_year: Record<string, Record<string, unknown>> = {};
  for (const year of ssmYears) {
    const index = span.indexOf(year);
    unaudited_by_year[String(year)] = blockFor(
      year,
      index >= 0 ? index : span.length - 1,
      questionnaire
    );
  }
  const ctosFinancials = span
    .map((year, index) => {
      if (ssmSet.has(year)) return null;
      return {
        financial_year: year,
        dates: {
          pldd: getFinancialYearPeriodEndIso(questionnaire, year) ?? `${year}-12-31`,
          bsdd: null,
        },
        account: { ...SERIES[index]! },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return {
    financialStatements: { questionnaire, unaudited_by_year },
    ctosFinancials,
    realYears: span,
  };
}

export function ctosJson(
  rows: unknown[]
): Prisma.InputJsonValue {
  return rows as Prisma.InputJsonValue;
}
