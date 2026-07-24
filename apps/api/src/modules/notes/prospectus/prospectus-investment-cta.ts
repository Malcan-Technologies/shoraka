/**
 * SECTION: Build Page 2 Investment CTA view-model
 * WHY: Static heading, non-clickable button, platform minimum; no live investability
 */

import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_INVESTMENT_CTA_AUDIT,
  PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL,
  PROSPECTUS_INVESTMENT_CTA_DESCRIPTION,
  PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
  PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX,
  type ProspectusInvestmentCta,
} from "./prospectus-investment-cta.types";

export function buildProspectusInvestmentCta(): ProspectusInvestmentCta {
  const money = formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR);

  return {
    sectionHeading: PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
    description: PROSPECTUS_INVESTMENT_CTA_DESCRIPTION,
    buttonLabel: PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL,
    /** Reserved for a future route — keep null so frozen HTML stays non-clickable. */
    buttonHref: null,
    minimumInvestmentStatement: `${PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX} ${money}`,
    audit: PROSPECTUS_INVESTMENT_CTA_AUDIT,
  };
}
