/**
 * SECTION: Build Page 2 Investment CTA view-model
 * WHY: Static heading + platform minimum only; no live investability or routes
 */

import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_INVESTMENT_CTA_AUDIT,
  PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
  PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX,
  type ProspectusInvestmentCta,
} from "./prospectus-investment-cta.types";

export function buildProspectusInvestmentCta(): ProspectusInvestmentCta {
  const money = formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR);

  return {
    sectionHeading: PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
    minimumInvestmentStatement: `${PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX} ${money}`,
    audit: PROSPECTUS_INVESTMENT_CTA_AUDIT,
  };
}
