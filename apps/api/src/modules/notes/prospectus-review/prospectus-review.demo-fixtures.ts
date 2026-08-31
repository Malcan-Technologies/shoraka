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
      riskRating: "SME-3",
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
  draft.page2.financialComparison = {
    overrides: {
      "2022": {
        interestCoverage: 12.1,
        dscr: 1.42,
        receivablesDays: 74,
        netDebtEquity: 0.35,
      },
      "2023": {
        interestCoverage: 13.3,
        dscr: 1.55,
        receivablesDays: 69,
        netDebtEquity: 0.28,
      },
      "2024": {
        interestCoverage: 14.6,
        dscr: 1.68,
        receivablesDays: 63,
        netDebtEquity: 0.22,
      },
      "2022-12-31": {
        interestCoverage: 12.1,
        dscr: 1.42,
        receivablesDays: 74,
        netDebtEquity: 0.35,
      },
      "2023-12-31": {
        interestCoverage: 13.3,
        dscr: 1.55,
        receivablesDays: 69,
        netDebtEquity: 0.28,
      },
      "2024-12-31": {
        interestCoverage: 14.6,
        dscr: 1.68,
        receivablesDays: 63,
        netDebtEquity: 0.22,
      },
    },
  };
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
        operatingCashFlow: 1_400_000,
        freeCashFlow: 1_100_000,
        debtEquity: 0.24,
        returnOnAssets: 4.8,
        payablesDays: 48,
        assetTurnover: 1.72,
      },
      "2023": {
        grossProfit: 2_400_000,
        ebitda: 1_850_000,
        ebit: 1_700_000,
        cashAndBank: 1_100_000,
        tradeReceivables: 3_100_000,
        totalEquity: 5_000_000,
        quickRatio: 1.18,
        operatingCashFlow: 1_700_000,
        freeCashFlow: 1_300_000,
        debtEquity: 0.2,
        returnOnAssets: 5.3,
        payablesDays: 46,
        assetTurnover: 1.82,
      },
      "2024": {
        grossProfit: 2_800_000,
        ebitda: 2_100_000,
        ebit: 1_950_000,
        cashAndBank: 1_400_000,
        tradeReceivables: 3_200_000,
        totalEquity: 5_600_000,
        quickRatio: 1.26,
        operatingCashFlow: 2_100_000,
        freeCashFlow: 1_600_000,
        debtEquity: 0.16,
        returnOnAssets: 5.8,
        payablesDays: 44,
        assetTurnover: 1.92,
      },
    },
  };
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "steady_growth",
    liquidityOptionKey: "healthy_improving",
    leverageOptionKey: "conservative_improving",
    debtServicingCapacityOptionKey: "adequate_improving",
    receivablesCollectionOptionKey: "improving",
    overallFinancialProfileOptionKey: "strengthening",
  };
  return draft;
}
