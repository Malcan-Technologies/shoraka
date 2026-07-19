import type { ProspectusReviewStoredContent } from "@cashsouk/types";

export type ProspectusCompletionItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

function hasOption(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildProspectusCompletionChecklist(
  draft: ProspectusReviewStoredContent
): ProspectusCompletionItem[] {
  const highlightsComplete = draft.page1.keyInvestorHighlights.every(
    (h) => hasOption(h.optionKey) || h.isVisible === false
  );
  const paymentComplete =
    hasOption(draft.page1.paymentBasisOptionKey) &&
    hasOption(draft.page1.shariahPrincipleOptionKey);

  const track = draft.page2.paymasterTrackRecord;
  const paymasterComplete = Boolean(
    track &&
      track.totalInvoicesPaid != null &&
      track.totalAmountPaid != null &&
      track.totalAmountPaid !== "" &&
      track.successfulRepaymentPercent != null &&
      track.successfulRepaymentPercent !== "" &&
      track.onTimePaymentPercent != null &&
      track.onTimePaymentPercent !== "" &&
      track.averagePaymentPeriodDays != null &&
      track.averagePaymentPeriodDays !== ""
  );

  const credit = draft.page2.creditInsights;
  const creditComplete =
    hasOption(credit.creditScoreOptionKey) &&
    hasOption(credit.paymentBehaviourOptionKey) &&
    hasOption(credit.creditUtilisationOptionKey) &&
    hasOption(credit.litigationCheckOptionKey) &&
    hasOption(credit.ccrisStatusOptionKey);

  const invoiceComplete = draft.page2.invoiceWorkStatements.every((s) =>
    hasOption(s.optionKey)
  );

  const takeaways = draft.page3.investorTakeaways;
  const takeawaysComplete =
    hasOption(takeaways.revenueProfitabilityOptionKey) &&
    hasOption(takeaways.liquidityOptionKey) &&
    hasOption(takeaways.leverageOptionKey) &&
    hasOption(takeaways.debtServicingCapacityOptionKey) &&
    hasOption(takeaways.workingCapitalEfficiencyOptionKey) &&
    hasOption(takeaways.overallFinancialProfileOptionKey);

  const years = draft.page3.manualFinancialInputs?.years ?? {};
  const financialInputComplete = Object.values(years).some((row) =>
    Object.values(row ?? {}).some((value) => value != null && value !== "")
  );

  return [
    { id: "core", label: "Core Terms reviewed", complete: true, required: true },
    {
      id: "highlights",
      label: "Investor Highlights complete",
      complete: highlightsComplete && paymentComplete,
      required: true,
    },
    {
      id: "paymaster",
      label: "Paymaster information complete",
      complete: paymasterComplete,
      required: false,
    },
    {
      id: "credit",
      label: "Credit and Invoice details complete",
      complete: creditComplete && invoiceComplete,
      required: true,
    },
    {
      id: "financials",
      label: "Financial Review complete",
      complete: financialInputComplete,
      required: false,
    },
    {
      id: "takeaways",
      label: "Investor Takeaways complete",
      complete: takeawaysComplete,
      required: true,
    },
  ];
}

export function isProspectusDraftReadyToSubmit(draft: ProspectusReviewStoredContent): boolean {
  return buildProspectusCompletionChecklist(draft)
    .filter((item) => item.required)
    .every((item) => item.complete);
}
