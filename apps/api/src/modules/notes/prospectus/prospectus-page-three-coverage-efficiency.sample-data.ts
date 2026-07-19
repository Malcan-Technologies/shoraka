/**
 * SECTION: Sample Page 3 Stage 4 coverage/efficiency inputs
 * WHY: Deterministic plnpat/bsqpuc for ROE; no mock OCF/DSCR/days values
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import type {
  ProspectusPageThreeCoverageEfficiency,
  ProspectusPageThreeCoverageEfficiencyInput,
} from "./prospectus-page-three-coverage-efficiency.types";

function yearBlock(input: { plnpat: number; bsqpuc: number; turnover: number }) {
  return {
    plnpat: input.plnpat,
    bsqpuc: input.bsqpuc,
    turnover: input.turnover,
    plnpbt: Math.round(input.plnpat * 1.2),
    bscatot: 4_700_000,
    curlib: 2_900_000,
    bsfatot: 1_500_000,
    othass: 1_000_000,
    bsclbank: 900_000,
    bsslltd: 500_000,
    bsclstd: 200_000,
  };
}

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE =
  buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: { financial_year_end: "2024-12-31" },
      unaudited_by_year: {
        "2022": yearBlock({ plnpat: 1_200_000, bsqpuc: 2_000_000, turnover: 13_900_000 }),
        "2023": yearBlock({ plnpat: 1_500_000, bsqpuc: 2_200_000, turnover: 16_200_000 }),
        "2024": yearBlock({ plnpat: 1_800_000, bsqpuc: 2_400_000, turnover: 18_600_000 }),
      },
    },
    ctosFinancials: {
      financials: [{ financial_year: 2020, plnpat: 9_999_999 }],
    },
  });

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT: ProspectusPageThreeCoverageEfficiencyInput =
  {
    financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE,
    ctosFinancials: {
      financials: [{ financial_year: 2020, plnpat: 9_999_999 }],
    },
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY: ProspectusPageThreeCoverageEfficiency =
  buildProspectusPageThreeCoverageEfficiency(
    SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
  );
