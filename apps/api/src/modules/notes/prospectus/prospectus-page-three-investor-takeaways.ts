/**
 * SECTION: Build Page 3 Stage 6 investor takeaway slots
 * WHY: Fixed categories; description from typed option catalogue only — never value-derived
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
import { resolveInvestorTakeawayText } from "./prospectus-placeholder-publication-content";

/**
 * Builds six takeaway slots. Descriptions come only from typed option keys.
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

  const options = input.investorTakeawayOptions;
  const selections = input.investorTakeawaySelections;
  const omittedKeys: string[] = [];

  const items = PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_KEYS.map((key) => {
    if (!options || !selections) {
      return {
        key,
        label: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS[key],
        takeaway: PROSPECTUS_DATA_NOT_AVAILABLE,
      };
    }
    const selectedKey = selections[key];
    if (selectedKey === "do_not_display") {
      omittedKeys.push(key);
      return {
        key,
        label: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS[key],
        takeaway: "",
      };
    }
    const text = resolveInvestorTakeawayText(key, selectedKey, options);
    return {
      key,
      label: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAY_LABELS[key],
      takeaway: text ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    };
  });

  return {
    sectionHeading: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_SECTION_HEADING,
    items,
    omittedKeys,
    audit: PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_AUDIT,
  };
}
