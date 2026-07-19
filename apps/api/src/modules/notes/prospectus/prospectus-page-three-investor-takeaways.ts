/**
 * SECTION: Build Page 3 Stage 6 investor takeaway slots
 * WHY: DNA-only structural section; Stage 1–5 inputs accepted but never drive claims
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT,
  PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_SECTION_HEADING,
  type ProspectusPageThreeInvestorTakeaways,
  type ProspectusPageThreeInvestorTakeawaysInput,
} from "./prospectus-page-three-investor-takeaways.types";

/**
 * Builds six takeaway slots. All visible text is Data not available.
 * Does not read financial values, trends, admin memos, or Canva sample copy.
 */
export function buildProspectusPageThreeInvestorTakeaways(
  input: ProspectusPageThreeInvestorTakeawaysInput
): ProspectusPageThreeInvestorTakeaways {
  // Accepted for future composition / observational rejection only.
  void input.metadata;
  void input.incomeStatement;
  void input.balanceSheet;
  void input.coverageEfficiency;
  void input.trends;
  void input.ctosFinancials;
  void input.adminMemoText;
  void input.canvaSampleTakeaways;

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_SECTION_HEADING,
    items: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS.map((key) => ({
      key,
      label: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS[key],
      takeaway: PROSPECTUS_DATA_NOT_AVAILABLE,
    })),
    audit: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT,
  };
}
