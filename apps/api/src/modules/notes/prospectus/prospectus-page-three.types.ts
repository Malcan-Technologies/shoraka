/**
 * SECTION: Prospectus Page 3 assembled view-model
 * WHY: One A4 page composed from Stages 1–6 + shared header/footer
 */

import type { ProspectusFooter } from "./prospectus-footer.types";
import type { ProspectusHeader } from "./prospectus-header.types";
import type { ProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet.types";
import type { ProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency.types";
import type { ProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement.types";
import type { ProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways.types";
import type { ProspectusPageThreeMetadata } from "./prospectus-page-three-metadata.types";
import type { ProspectusPageThreeTrends } from "./prospectus-page-three-trends.types";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";

/** Same A4 dimensions as Page 1 and Page 2. */
export const PROSPECTUS_PAGE_THREE_WIDTH_MM = 210;
export const PROSPECTUS_PAGE_THREE_HEIGHT_MM = 297;

/**
 * Canva source line is not approved production copy.
 * Visible slot remains Data not available.
 */
export const PROSPECTUS_PAGE_THREE_SOURCE_STATEMENT = "Data not available";

/**
 * Six visible Page 3 content stages (Canva / Data-First map).
 * Prisma loader, mapper, snapshot, and HTML shell are technical integration — not stages.
 */
export const PROSPECTUS_PAGE_THREE_VISIBLE_CONTENT_STAGES = [
  "page_title",
  "metadata_strip",
  "income_statement",
  "balance_sheet_liquidity",
  "coverage_efficiency_with_trends",
  "investor_takeaways",
] as const;

export type ProspectusPageThreeFinancialMode =
  | "frozen_publication_snapshot"
  | "live_unpublished_preview"
  | "published_unavailable";

export interface ProspectusPageThree {
  header: ProspectusHeader;
  metadata: ProspectusPageThreeMetadata;
  /** Shared Page 2 Stage 4A source — not rendered as a duplicate section. */
  financialSource: ProspectusFinancialComparisonSource;
  incomeStatement: ProspectusPageThreeIncomeStatement;
  balanceSheet: ProspectusPageThreeBalanceSheet;
  coverageEfficiency: ProspectusPageThreeCoverageEfficiency;
  trends: ProspectusPageThreeTrends;
  investorTakeaways: ProspectusPageThreeInvestorTakeaways;
  footer: ProspectusFooter;
  /** Audit-only render metadata — omitted from Canva HTML. */
  meta: {
    noteId: string;
    financialMode: ProspectusPageThreeFinancialMode;
    isPublished: boolean;
  };
}
