/**
 * SECTION: Sample Page 2 Stage 4A financial comparison source
 * WHY: Four+ years + invalid keys prove latest-three selection and ascending display
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import type {
  ProspectusFinancialComparisonSource,
  ProspectusFinancialComparisonSourceInput,
} from "./prospectus-financial-comparison-source.types";

function yearBlock(year: number) {
  return {
    pldd: `${year}-12-31`,
    turnover: year * 100_000,
    plnpat: year * 10_000,
    bscatot: 1_000_000,
    curlib: 500_000,
    bsqpuc: 2_000_000,
  };
}

/**
 * Insertion order is intentionally scrambled. Invalid keys must be ignored.
 * CTOS sample is observational only and must not be selected.
 */
export const SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT: ProspectusFinancialComparisonSourceInput =
  {
    financialStatements: {
      questionnaire: {
        financial_year_end: "2027-12-31",
      },
      unaudited_by_year: {
        "2024": yearBlock(2024),
        "2021": yearBlock(2021),
        FY2025: yearBlock(2025),
        draft: yearBlock(2020),
        "2023": yearBlock(2023),
        "2024/25": yearBlock(2025),
        "2022": yearBlock(2022),
      },
    },
    ctosFinancials: {
      financials: [
        { financial_year: 2020, turnover: 9_999_999 },
        { financial_year: 2021, turnover: 8_888_888 },
        { financial_year: 2022, turnover: 7_777_777 },
      ],
    },
  };

export const SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE: ProspectusFinancialComparisonSource =
  buildProspectusFinancialComparisonSource(
    SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_INPUT
  );
