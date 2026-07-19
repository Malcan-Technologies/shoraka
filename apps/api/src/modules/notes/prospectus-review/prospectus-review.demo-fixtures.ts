/**
 * SECTION: Deterministic Prospectus Review draft content for local product demos
 * WHY: Shared by seed E2E runner and tests — editable highlight copy + remaining catalogues
 */

import { PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT } from "@cashsouk/types";
import { emptyProspectusReviewContent } from "./prospectus-review-content";
import type { ProspectusReviewStoredContent } from "./prospectus-review-content";

/** Complete, approval-valid draft using recommended/editable highlight copy. */
export function buildCompleteProspectusReviewDraft(): ProspectusReviewStoredContent {
  const draft = emptyProspectusReviewContent({
    paymasterSnapshot: {
      name: "Kementerian Kerja Raya",
      entity_type: "Government Agency",
    },
    riskRating: "AA",
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
  });
  draft.page1.keyInvestorHighlights = draft.page1.keyInvestorHighlights.map((h) => {
    if (h.key === "shariah") {
      return {
        key: "shariah",
        title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
        description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
      };
    }
    return h;
  });
  draft.page2.paymasterTrackRecord = {
    totalInvoicesPaid: 48,
    totalAmountPaid: "12500000",
    successfulRepaymentPercent: 98.5,
    onTimePaymentPercent: 94,
    averagePaymentPeriodDays: 32,
  };
  draft.page2.creditInsights = {
    creditScoreOptionKey: "positive",
    paymentBehaviourOptionKey: "neutral",
    creditUtilisationOptionKey: "do_not_display",
    litigationCheckOptionKey: "positive",
    ccrisStatusOptionKey: "neutral",
  };
  const invoiceMap: Record<string, string> = {
    work_under_contract: "placeholder_work_under_contract",
    certification_acceptance: "placeholder_certification_acceptance",
    paymaster_trust_account: "placeholder_paymaster_trust_account",
    deed_of_assignment: "placeholder_deed_of_assignment",
  };
  draft.page2.invoiceWorkStatements = draft.page2.invoiceWorkStatements.map((s) => ({
    ...s,
    optionKey: invoiceMap[s.key] ?? "do_not_display",
    isVisible: true,
  }));
  draft.page3.manualFinancialInputs = {
    years: {
      "2024": {
        grossProfit: 1_200_000,
        ebitda: 900_000,
        ebit: 800_000,
      },
    },
  };
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "placeholder_positive",
    liquidityOptionKey: "do_not_display",
    leverageOptionKey: "placeholder_moderate",
    debtServicingCapacityOptionKey: "placeholder_adequate",
    workingCapitalEfficiencyOptionKey: "placeholder_typical",
    overallFinancialProfileOptionKey: "placeholder_balanced",
  };
  return draft;
}
