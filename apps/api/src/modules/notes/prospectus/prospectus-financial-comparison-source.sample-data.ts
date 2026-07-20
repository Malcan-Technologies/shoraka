/**
 * SECTION: Sample Page 2 Stage 4A financial comparison source
 * WHY: CTOS latest-three years prove Admin-aligned selection and ascending display
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import type {
  ProspectusFinancialComparisonSource,
  ProspectusFinancialComparisonSourceInput,
} from "./prospectus-financial-comparison-source.types";

function ctosYear(
  year: number,
  turnover: number
): {
  financial_year: number;
  dates: { pldd: string; bsdd: null };
  account: Record<string, number | null>;
} {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null },
    account: {
      turnover,
      plnpat: turnover / 10,
      bsqpuc: 2_000_000,
      bscatot: 1_000_000,
      curlib: 500_000,
      bsfatot: null,
      othass: null,
      bsclbank: null,
      totass: null,
      bsslltd: null,
      bsclstd: null,
      totlib: null,
      plnpbt: null,
      plnetdiv: null,
      plyear: null,
      networth: null,
      turnover_growth: null,
      profit_margin: null,
      return_on_equity: null,
      currat: null,
      workcap: null,
    },
  };
}

/**
 * CTOS supplies 2020–2024; Admin keeps latest three (2022–2024). Unaudited SSM years
 * are empty here so the shared sample stays a clean three-year audited set.
 */
export const SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT: ProspectusFinancialComparisonSourceInput =
  {
    financialStatements: {
      questionnaire: {
        financial_year_end: "2027-12-31",
      },
      unaudited_by_year: {
        "2021": { turnover: 1 },
        FY2025: { turnover: 2 },
        draft: { turnover: 3 },
      },
    },
    ctosFinancials: [
      ctosYear(2020, 9_999_999),
      ctosYear(2021, 2021 * 100_000),
      ctosYear(2022, 2022 * 100_000),
      ctosYear(2023, 2023 * 100_000),
      ctosYear(2024, 2024 * 100_000),
    ],
    ref: new Date("2026-07-17T00:00:00.000Z"),
  };

export const SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE: ProspectusFinancialComparisonSource =
  buildProspectusFinancialComparisonSource(
    SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
  );
