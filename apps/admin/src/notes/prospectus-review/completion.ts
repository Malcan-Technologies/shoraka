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

function hasHighlightCopy(value: { title?: string; description?: string; key?: string }): boolean {
  if (value.key === "shariah") return true;
  return hasOption(value.title) && hasOption(value.description);
}

export type ProspectusCompletionOptions = {
  /**
   * Calendar years on Page 2/3 financial tables — used for Income Statement and
   * Balance Sheet officer-field completeness.
   */
  incomeStatementYears?: readonly string[];
};

const PAGE_THREE_OFFICER_FINANCIAL_FIELDS = [
  "grossProfit",
  "ebitda",
  "ebit",
  "cashAndBank",
  "tradeReceivables",
  "totalEquity",
  "quickRatio",
  "operatingCashFlow",
  "freeCashFlow",
  "debtEquity",
  "returnOnAssets",
  "payablesDays",
  "assetTurnover",
] as const;

function pageThreeOfficerFieldsComplete(
  draft: ProspectusReviewStoredContent,
  years: readonly string[]
): boolean {
  if (years.length === 0) return false;
  const bag = draft.page3.manualFinancialInputs?.years ?? {};
  return years.every((year) => {
    const row = bag[year] ?? {};
    return PAGE_THREE_OFFICER_FINANCIAL_FIELDS.every((field) => {
      const value = row[field];
      return value != null && value !== "";
    });
  });
}

export function buildProspectusCompletionChecklist(
  draft: ProspectusReviewStoredContent,
  options?: ProspectusCompletionOptions
): ProspectusCompletionItem[] {
  const highlightsComplete =
    draft.page1.keyInvestorHighlights.length >= 4 &&
    draft.page1.keyInvestorHighlights.every((h) => hasHighlightCopy(h));

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

  const aboutItems = draft.page2.aboutInvoice?.items ?? [];
  const invoiceComplete =
    aboutItems.length >= 4 &&
    aboutItems.every((item) => typeof item.text === "string" && item.text.trim().length > 0);

  const takeaways = draft.page3.investorTakeaways;
  const takeawaysComplete =
    hasOption(takeaways.revenueProfitabilityOptionKey) &&
    hasOption(takeaways.liquidityOptionKey) &&
    hasOption(takeaways.leverageOptionKey) &&
    hasOption(takeaways.debtServicingCapacityOptionKey) &&
    hasOption(takeaways.receivablesCollectionOptionKey) &&
    hasOption(takeaways.overallFinancialProfileOptionKey);

  const incomeYears = options?.incomeStatementYears ?? [];
  const financialInputComplete =
    incomeYears.length > 0
      ? pageThreeOfficerFieldsComplete(draft, incomeYears)
      : Object.values(draft.page3.manualFinancialInputs?.years ?? {}).some((row) =>
          Object.values(row ?? {}).some((value) => value != null && value !== "")
        );

  return [
    { id: "core", label: "Note & Investment Details", complete: true, required: true },
    {
      id: "highlights",
      label: "Investor Highlights",
      complete: highlightsComplete,
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
      required: incomeYears.length > 0,
    },
    {
      id: "takeaways",
      label: "Investor Takeaways",
      complete: takeawaysComplete,
      required: true,
    },
  ];
}

export function isProspectusDraftReadyToSubmit(
  draft: ProspectusReviewStoredContent,
  options?: ProspectusCompletionOptions
): boolean {
  return buildProspectusCompletionChecklist(draft, options)
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
  draft: ProspectusReviewStoredContent,
  options?: ProspectusCompletionOptions
): Partial<Record<ProspectusWorkflowStepId, ProspectusStepStatus>> {
  const checklist = buildProspectusCompletionChecklist(draft, options);
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
