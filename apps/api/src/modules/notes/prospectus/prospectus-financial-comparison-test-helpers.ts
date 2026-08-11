/**
 * Test helper: build Stage 4A source from year blocks via CTOS rows.
 * WHY: Admin-aligned resolver only includes SSM unaudited tab years (1–2);
 * historical multi-year fixtures use CTOS the same way Admin does.
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";

const ACCOUNT_KEYS = [
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "totass",
  "curlib",
  "bsslltd",
  "bsclstd",
  "totlib",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
  "networth",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "workcap",
  "gear",
] as const;

function toAccount(raw: Record<string, unknown>): Record<string, number | null> {
  const account: Record<string, number | null> = {};
  for (const key of ACCOUNT_KEYS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) account[key] = v;
    else if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(/,/g, ""));
      account[key] = Number.isFinite(n) ? n : null;
    } else account[key] = null;
  }
  return account;
}

/** Build Prospectus financial comparison source from calendar-year field maps. */
export function financialSourceFromYearBlocks(
  years: Record<string, Record<string, unknown>>,
  options?: { financialYearEnd?: string; ref?: Date }
): ProspectusFinancialComparisonSource {
  const ctosFinancials = Object.entries(years)
    .filter(([key]) => /^\d{4}$/.test(key))
    .map(([yearKey, raw]) => {
      const year = Number(yearKey);
      const pldd =
        typeof raw.pldd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.pldd)
          ? raw.pldd
          : `${year}-12-31`;
      return {
        financial_year: year,
        dates: { pldd, bsdd: null as null },
        account: toAccount(raw),
      };
    });

  return buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: {
        financial_year_end: options?.financialYearEnd ?? "2027-12-31",
      },
      unaudited_by_year: {},
    },
    ctosFinancials,
    ref: options?.ref ?? new Date("2026-07-17T00:00:00.000Z"),
  });
}
