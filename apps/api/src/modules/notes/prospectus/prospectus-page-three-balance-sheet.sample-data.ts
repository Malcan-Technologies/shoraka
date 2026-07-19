/**
 * SECTION: Sample Page 3 Stage 3 balance sheet inputs
 * WHY: Deterministic three-year Application FS sample via Page 2 Stage 4A source
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import type {
  ProspectusPageThreeBalanceSheet,
  ProspectusPageThreeBalanceSheetInput,
} from "./prospectus-page-three-balance-sheet.types";

function yearBlock(input: {
  bsfatot: number;
  othass: number;
  bscatot: number;
  bsclbank: number;
  curlib: number;
  bsslltd: number;
  bsclstd: number;
}) {
  return {
    ...input,
    turnover: 10_000_000,
    plnpat: 1_000_000,
    plnpbt: 1_200_000,
    bsqpuc: 2_000_000,
  };
}

export const SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE =
  buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: { financial_year_end: "2024-12-31" },
      unaudited_by_year: {
        "2022": yearBlock({
          bsfatot: 1_500_000,
          othass: 1_000_000,
          bscatot: 4_700_000,
          bsclbank: 900_000,
          curlib: 2_900_000,
          bsslltd: 500_000,
          bsclstd: 200_000,
        }),
        "2023": yearBlock({
          bsfatot: 1_600_000,
          othass: 1_100_000,
          bscatot: 5_200_000,
          bsclbank: 950_000,
          curlib: 3_100_000,
          bsslltd: 550_000,
          bsclstd: 250_000,
        }),
        "2024": yearBlock({
          bsfatot: 1_700_000,
          othass: 1_200_000,
          bscatot: 5_800_000,
          bsclbank: 1_000_000,
          curlib: 3_400_000,
          bsslltd: 600_000,
          bsclstd: 300_000,
        }),
      },
    },
    ctosFinancials: {
      financials: [{ financial_year: 2020, bscatot: 9_999_999 }],
    },
  });

export const SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT: ProspectusPageThreeBalanceSheetInput =
  {
    financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_SOURCE,
    ctosFinancials: {
      financials: [{ financial_year: 2020, bscatot: 9_999_999 }],
    },
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET: ProspectusPageThreeBalanceSheet =
  buildProspectusPageThreeBalanceSheet(SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET_INPUT);
