/**
 * SECTION: Build Page 2 Investment CTA view-model
 * WHY: No marketing claims; destination only via confirmed /investments/{noteId}
 */

import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  buildProspectusInvestorNoteInvestmentPath,
  parseConfirmedProspectusInvestorNoteInvestmentPath,
} from "./prospectus-investor-note-route";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL,
  PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
  PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX,
  type ProspectusInvestmentCta,
  type ProspectusInvestmentCtaInput,
} from "./prospectus-investment-cta.types";

function resolveButtonHref(input: ProspectusInvestmentCtaInput): string | null {
  const fromNoteId = buildProspectusInvestorNoteInvestmentPath(input.noteId);
  if (fromNoteId) return fromNoteId;
  return parseConfirmedProspectusInvestorNoteInvestmentPath(input.investmentDestinationUrl);
}

export function buildProspectusInvestmentCta(
  input: ProspectusInvestmentCtaInput = {}
): ProspectusInvestmentCta {
  void input.productNameEndingInI;
  void input.marketingParagraph;

  const buttonHref = resolveButtonHref(input);
  const money = formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR);

  return {
    sectionHeading: PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING,
    paragraph: PROSPECTUS_DATA_NOT_AVAILABLE,
    buttonLabel: PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL,
    buttonHref,
    isButtonEnabled: buttonHref != null,
    minimumInvestmentStatement: `${PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX} ${money}`,
    audit: {
      heading: {
        sourceType: "static_canva_section_heading",
      },
      paragraph: {
        status: "unresolved",
        approvedCopyAvailable: false,
        generatedMarketingClaimAllowed: false,
      },
      button: {
        labelSource: "static_template",
        destinationRouteSource:
          buttonHref != null ? "confirmed_existing_route" : "unavailable",
        arbitraryUrlAllowed: false,
        investabilityRuleOwnedByMarketplace: true,
      },
      minimumInvestment: {
        source: "MARKETPLACE_MIN_COMMIT_MYR",
        formatter: "formatProspectusMoneyMyr",
        capacityAdjustedMinimumUsed: false,
      },
      claims: {
        attractiveReturnAllowed: false,
        shortTermClaimAllowed: false,
        shariahCompliantInvestmentClaimAllowed: false,
      },
    },
  };
}
