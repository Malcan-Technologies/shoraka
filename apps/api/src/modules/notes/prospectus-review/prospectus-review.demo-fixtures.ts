/**
 * SECTION: Deterministic Prospectus Review draft content for local product demos
 * WHY: Shared by seed E2E runner and tests — placeholder catalogue keys only
 */

import { emptyProspectusReviewContent } from "./prospectus-review-content";
import type { ProspectusReviewStoredContent } from "./prospectus-review-content";

/** Complete, approval-valid draft using current placeholder catalogue keys. */
export function buildCompleteProspectusReviewDraft(): ProspectusReviewStoredContent {
  const draft = emptyProspectusReviewContent();
  const highlightMap: Record<string, string> = {
    paymaster: "placeholder_paymaster",
    issuer_fundamentals: "placeholder_issuer_fundamentals",
    return: "placeholder_return",
    shariah: "do_not_display",
  };
  draft.page1.keyInvestorHighlights = draft.page1.keyInvestorHighlights.map((h) => ({
    ...h,
    optionKey: highlightMap[h.key] ?? "do_not_display",
    isVisible: highlightMap[h.key] !== "do_not_display",
  }));
  draft.page1.paymentBasisOptionKey = "placeholder_bullet_maturity";
  draft.page1.shariahPrincipleOptionKey = "placeholder_tawarruq";
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
  const years: Record<string, Record<string, number>> = {};
  for (const year of ["2022", "2023", "2024"]) {
    const base = year === "2024" ? 1.1 : year === "2023" ? 1.05 : 1;
    years[year] = {
      grossProfit: Math.round(4_500_000 * base),
      ebitda: Math.round(2_200_000 * base),
      ebit: Math.round(1_800_000 * base),
      cashAndBank: Math.round(900_000 * base),
      tradeReceivables: Math.round(2_500_000 * base),
      totalEquity: Math.round(7_000_000 * base),
      quickRatio: Number((1.4 * base).toFixed(2)),
      operatingCashFlow: Math.round(1_500_000 * base),
      freeCashFlow: Math.round(900_000 * base),
      interestCoverage: Number((6.5 * base).toFixed(2)),
      dscr: Number((1.35 * base).toFixed(2)),
      debtEquity: Number((0.45 / base).toFixed(2)),
      returnOnAssets: Number((8.2 * base).toFixed(2)),
      receivablesDays: Math.round(45 / base),
      payablesDays: Math.round(38 / base),
      assetTurnover: Number((1.1 * base).toFixed(2)),
    };
  }
  draft.page3.manualFinancialInputs = { years };
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "placeholder_positive",
    liquidityOptionKey: "placeholder_stable",
    leverageOptionKey: "placeholder_moderate",
    debtServicingCapacityOptionKey: "placeholder_adequate",
    workingCapitalEfficiencyOptionKey: "placeholder_typical",
    overallFinancialProfileOptionKey: "placeholder_balanced",
  };
  return draft;
}
