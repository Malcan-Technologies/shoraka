/**
 * SECTION: Sample Page 3 Stage 6 investor takeaways inputs
 * WHY: Compose Stages 1–5 samples with positive-looking numbers; all takeaways DNA
 */

import { SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET } from "./prospectus-page-three-balance-sheet.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY } from "./prospectus-page-three-coverage-efficiency.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT } from "./prospectus-page-three-income-statement.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA } from "./prospectus-page-three-metadata.sample-data";
import { SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS } from "./prospectus-page-three-trends.sample-data";
import { buildProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways";
import type {
  ProspectusPageThreeInvestorTakeaways,
  ProspectusPageThreeInvestorTakeawaysInput,
} from "./prospectus-page-three-investor-takeaways.types";

export const SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT: ProspectusPageThreeInvestorTakeawaysInput =
  {
    metadata: SAMPLE_PROSPECTUS_PAGE_THREE_METADATA,
    incomeStatement: SAMPLE_PROSPECTUS_PAGE_THREE_INCOME_STATEMENT,
    balanceSheet: SAMPLE_PROSPECTUS_PAGE_THREE_BALANCE_SHEET,
    coverageEfficiency: SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY,
    trends: SAMPLE_PROSPECTUS_PAGE_THREE_TRENDS,
    ctosFinancials: { commentary: "LIVE CTOS MUST NOT APPEAR" },
    adminMemoText:
      "Revenue and profitability have shown steady year-on-year growth.",
    canvaSampleTakeaways: [
      "Liquidity remains healthy, with current and quick ratios improving over time.",
      "Leverage is conservative and trending downward.",
      "Overall financial fundamentals are strengthening.",
    ],
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS: ProspectusPageThreeInvestorTakeaways =
  buildProspectusPageThreeInvestorTakeaways(
    SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT
  );
