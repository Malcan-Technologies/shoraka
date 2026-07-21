/**
 * SECTION: Deterministic Prospectus Review draft content for local product demos
 * WHY: Shared by seed E2E runner and tests — editable highlight copy + remaining catalogues
 */

import { PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT } from "@cashsouk/types";
import {
  emptyProspectusReviewContent,
  normalizeAboutInvoiceSelections,
} from "./prospectus-review-content";
import type { ProspectusReviewStoredContent } from "./prospectus-review-content";

/** Complete, approval-valid draft using recommended/editable highlight copy. */
export function buildCompleteProspectusReviewDraft(): ProspectusReviewStoredContent {
  const paymasterSnapshot = {
    name: "Demo Paymaster Sdn. Bhd.",
    entity_type: "Private Limited Company (Sdn Bhd)",
  };
  const contractSnapshot = {
    contract_details: {
      description: "civil engineering and infrastructure works",
    },
  };
  let draft = emptyProspectusReviewContent(
    {
      paymasterSnapshot,
      riskRating: "AA",
      profitRatePercent: 12,
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
    },
    {
      paymasterSnapshot,
      contractSnapshot,
      deedOfAssignment: null,
    }
  );
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
  draft.page2.issuerProfile = { companySize: "Medium" };
  draft.page2.invoicePaymaster = {
    deedOfAssignment: "Yes",
    paymasterRating: "PM1",
    confidenceGrading: "High",
  };
  draft = normalizeAboutInvoiceSelections(draft, {
    paymasterSnapshot,
    contractSnapshot,
    deedOfAssignment: "Yes",
  });
  // Mark demo statements as officer-confirmed so approval validation treats them as final.
  draft.page2.aboutInvoice = {
    items: (draft.page2.aboutInvoice?.items ?? []).map((item) => ({
      ...item,
      sourceType: "OFFICER_ENTERED" as const,
    })),
  };
  draft.page2.paymasterTrackRecord = {
    totalInvoicesPaid: 48,
    totalAmountPaid: "12500000",
    successfulRepaymentPercent: 98.5,
    onTimePaymentPercent: 94,
    averagePaymentPeriodDays: 32,
  };
  draft.page2.creditInsights = {
    creditScoreOptionKey: "good",
    paymentBehaviourOptionKey: "good",
    creditUtilisationOptionKey: "healthy",
    litigationCheckOptionKey: "clear",
    ccrisStatusOptionKey: "no_record",
  };
  draft.page2.invoiceWorkStatements = (draft.page2.aboutInvoice?.items ?? []).map((item) => ({
    key: item.id,
    optionKey: null,
    isVisible: true,
  }));
  draft.page3.manualFinancialInputs = {
    years: {
      "2022": {
        grossProfit: 2_100_000,
        ebitda: 1_600_000,
        ebit: 1_450_000,
        cashAndBank: 900_000,
        tradeReceivables: 2_800_000,
        totalEquity: 4_500_000,
        quickRatio: 1.11,
      },
      "2023": {
        grossProfit: 2_400_000,
        ebitda: 1_850_000,
        ebit: 1_700_000,
        cashAndBank: 1_100_000,
        tradeReceivables: 3_100_000,
        totalEquity: 5_000_000,
        quickRatio: 1.18,
      },
      "2024": {
        grossProfit: 2_800_000,
        ebitda: 2_100_000,
        ebit: 1_950_000,
        cashAndBank: 1_400_000,
        tradeReceivables: 3_200_000,
        totalEquity: 5_600_000,
        quickRatio: 1.26,
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
