/**
 * SECTION: Sample Page 3 Stage 2 income statement inputs
 * WHY: Deterministic three-year Application FS sample via Page 2 Stage 4A source
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import type {
  ProspectusPageThreeIncomeStatement,
  ProspectusPageThreeIncomeStatementInput,
} from "./prospectus-page-three-income-statement.types";

function yearBlock(input: {
  turnover: number;
  plnpbt: number;
  plnpat: number;
}) {
  return {
    turnover: input.turnover,
    plnpbt: input.plnpbt,
    plnpat: input.plnpat,
    bscatot: 1_000_000,
    curlib: 500_000,
    bsqpuc: 2_000_000,
  };
}

export const SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE =
  buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: { financial_year_end: "2024-12-31" },
      unaudited_by_year: {
        "2022": yearBlock({
          turnover: 13_900_000,
          plnpbt: 1_400_000,
          plnpat: 1_200_000,
        }),
        "2023": yearBlock({
          turnover: 16_200_000,
          plnpbt: 1_700_000,
          plnpat: 1_500_000,
        }),
        "2024": yearBlock({
          turnover: 18_600_000,
          plnpbt: 2_000_000,
          plnpat: 1_800_000,
        }),
      },
    },
    ctosFinancials: {
      financials: [{ financial_year: 2020, turnover: 9_999_999 }],
    },
  });

export const SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT: ProspectusPageThreeIncomeStatementInput =
  {
    financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_SOURCE,
    ctosFinancials: {
      financials: [{ financial_year: 2020, turnover: 9_999_999 }],
    },
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT: ProspectusPageThreeIncomeStatement =
  buildProspectusPageThreeIncomeStatement(
    SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT_INPUT
  );
