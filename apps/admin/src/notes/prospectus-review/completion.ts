import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusCompletionItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

/** Compact step/checklist status: Complete, Required, or Optional. */
export type ProspectusStepStatus = "complete" | "required" | "optional";

export const PROSPECTUS_STEP_STATUS_LABEL: Record<ProspectusStepStatus, string> = {
  complete: "Complete",
  required: "Required",
  optional: "Optional",
};

/** Maps Final checklist rows to workflow step ids. */
export const CHECKLIST_ITEM_STEP: Record<string, ProspectusWorkflowStepId> = {
  core: 0,
  highlights: 1,
  paymaster: 2,
  credit: 3,
  financials: 4,
  takeaways: 5,
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
    { id: "core", label: "Core Terms", complete: true, required: true },
    {
      id: "highlights",
      label: "Investor Highlights",
      complete: highlightsComplete && paymentComplete,
      required: true,
    },
    {
      id: "paymaster",
      label: "Issuer & Paymaster",
      complete: paymasterComplete,
      required: false,
    },
    {
      id: "credit",
      label: "Credit & Invoice Details",
      complete: creditComplete && invoiceComplete,
      required: true,
    },
    {
      id: "financials",
      label: "Financial Review",
      complete: financialInputComplete,
      required: false,
    },
    {
      id: "takeaways",
      label: "Investor Takeaways",
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

export function statusForCompletionItem(item: ProspectusCompletionItem): ProspectusStepStatus {
  if (item.complete) return "complete";
  return item.required ? "required" : "optional";
}

/**
 * Compact status words for the step navigator.
 * Preview & Approval only shows Complete when the draft is ready.
 */
export function getProspectusStepStatuses(
  draft: ProspectusReviewStoredContent
): Partial<Record<ProspectusWorkflowStepId, ProspectusStepStatus>> {
  const checklist = buildProspectusCompletionChecklist(draft);
  const byId = Object.fromEntries(checklist.map((item) => [item.id, item]));
  const ready = isProspectusDraftReadyToSubmit(draft);

  const statusFor = (itemId: string): ProspectusStepStatus => {
    const item = byId[itemId];
    if (!item) return "optional";
    return statusForCompletionItem(item);
  };

  return {
    0: statusFor("core"),
    1: statusFor("highlights"),
    2: statusFor("paymaster"),
    3: statusFor("credit"),
    4: statusFor("financials"),
    5: statusFor("takeaways"),
    ...(ready ? { 6: "complete" as const } : {}),
  };
}
