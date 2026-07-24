/**
 * SECTION: Sample Page 3 Stage 5 trends inputs
 * WHY: Compose Stages 2–4 samples with visible year changes; all trends remain DNA
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET } from "./prospectus-page-three-balance-sheet.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY } from "./prospectus-page-three-coverage-efficiency.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT } from "./prospectus-page-three-income-statement.sample-data";
import { buildProspectusPageThreeTrends } from "./prospectus-page-three-trends";
import type {
  ProspectusPageThreeTrends,
  ProspectusPageThreeTrendsInput,
} from "./prospectus-page-three-trends.types";

export const SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT: ProspectusPageThreeTrendsInput = {
  incomeStatement: SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT,
  balanceSheet: SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET,
  coverageEfficiency: SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY,
  ctosFinancials: {
    financials: [{ financial_year: 2020, turnover: 9_999_999 }],
  },
};

export const SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS: ProspectusPageThreeTrends =
  buildProspectusPageThreeTrends(SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS_INPUT);
