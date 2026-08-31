import type { ProspectusWorkflowStepId } from "./labels";
import { MARC_ASSESSMENT_REQUIRED_MESSAGE } from "@cashsouk/types";

export type ProspectusCompletionItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

export type ProspectusStepStatus = "complete" | "required" | "optional";

export const PROSPECTUS_STEP_STATUS_LABEL: Record<ProspectusStepStatus, string> = {
  complete: "Complete",
  required: "Required",
  optional: "Optional",
};

function hasOption(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasHighlightCopy(value: { title?: string; description?: string; key?: string }): boolean {
  if (value.key === "shariah") return true;
  return hasOption(value.title) && hasOption(value.description);
}

export type ProspectusCompletionOptions = {
  incomeStatementYears?: readonly string[];
  /**
   * Whether the issuer organization has a usable MARC SME assessment.
   * Undefined = not evaluated yet (do not count as missing).
   * False = one Credit Insights blocker: MARC assessment required.
   */
  hasMarcAssessment?: boolean;
};

const PAGE_THREE_OFFICER_FINANCIAL_FIELDS = [
  "grossProfit",
  "ebitda",
  "ebit",
  "cashAndBank",
  "tradeReceivables",
  "totalEquity",
  "quickRatio",
  "payablesDays",
] as const;

const PAGE_TWO_OVERRIDE_FIELDS = [
  "netDebtEquity",
  "interestCoverage",
  "dscr",
  "receivablesDays",
] as const;

function pageThreeOfficerFieldsComplete(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
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

function pageTwoOverridesComplete(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
  years: readonly string[]
): boolean {
  if (years.length === 0) return true;
  const overrides = draft.page2.financialComparison?.overrides ?? {};
  return years.every((year) => {
    const row =
      overrides[year] ??
      overrides[`${year}-12-31`] ??
      Object.entries(overrides).find(([key]) => key.startsWith(`${year}-`))?.[1] ??
      {};
    return PAGE_TWO_OVERRIDE_FIELDS.every((field) => {
      const value = row[field];
      return value != null && value !== "";
    });
  });
}

export function buildProspectusCompletionChecklist(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
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
  const marcComplete = options?.hasMarcAssessment !== false;
  const creditInsightsComplete =
    hasOption(credit.creditScoreOptionKey) &&
    hasOption(credit.paymentBehaviourOptionKey) &&
    hasOption(credit.creditUtilisationOptionKey) &&
    hasOption(credit.litigationCheckOptionKey) &&
    hasOption(credit.ccrisStatusOptionKey) &&
    marcComplete;

  const aboutItems = draft.page2.aboutInvoice?.items ?? [];
  const invoiceComplete =
    aboutItems.length >= 4 &&
    aboutItems.every((item) => typeof item.text === "string" && item.text.trim().length > 0);

  const issuerPaymasterOfficerComplete =
    hasOption(draft.page2.issuerProfile?.companySize) &&
    hasOption(draft.page2.invoicePaymaster?.deedOfAssignment);

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
      ? pageThreeOfficerFieldsComplete(draft, incomeYears) &&
        pageTwoOverridesComplete(draft, incomeYears)
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
      label: "Paymaster Track Record",
      complete: paymasterComplete,
      required: false,
    },
    {
      id: "credit",
      label: "Issuer, Credit & Invoice",
      complete: creditInsightsComplete && invoiceComplete && issuerPaymasterOfficerComplete,
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
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
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

function worstStatus(a: ProspectusStepStatus, b: ProspectusStepStatus): ProspectusStepStatus {
  if (a === "required" || b === "required") return "required";
  if (a === "optional" || b === "optional") return a === "complete" ? b : a;
  return "complete";
}

export function getProspectusStepStatuses(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
  options?: ProspectusCompletionOptions
): Partial<Record<ProspectusWorkflowStepId, ProspectusStepStatus>> {
  const checklist = buildProspectusCompletionChecklist(draft, options);
  const byId = Object.fromEntries(checklist.map((item) => [item.id, item]));
  const ready = isProspectusDraftReadyToSubmit(draft, options);

  const statusFor = (itemId: string): ProspectusStepStatus => {
    const item = byId[itemId];
    if (!item) return "optional";
    return statusForCompletionItem(item);
  };

  return {
    0: worstStatus(statusFor("core"), statusFor("highlights")),
    1: statusFor("credit"),
    2: worstStatus(statusFor("financials"), statusFor("takeaways")),
    ...(ready ? { 3: "complete" as const } : {}),
  };
}

/** Grouped missing required fields for Preview & Approval navigation. */
export type ProspectusMissingField = {
  pageStep: ProspectusWorkflowStepId;
  section: string;
  field: string;
  year?: string;
  /** Internal working-area tab id for navigation. */
  tabId?: string;
};

export function buildProspectusMissingRequiredFields(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
  options?: ProspectusCompletionOptions
): ProspectusMissingField[] {
  const missing: ProspectusMissingField[] = [];

  for (const h of draft.page1.keyInvestorHighlights) {
    if (h.key === "shariah") continue;
    if (!hasOption(h.title) || !hasOption(h.description)) {
      missing.push({
        pageStep: 0,
        section: "Investor Highlights",
        field: h.key,
        tabId: "highlights",
      });
    }
  }

  if (!hasOption(draft.page2.issuerProfile?.companySize)) {
    missing.push({
      pageStep: 1,
      section: "Issuer Profile",
      field: "Company Size",
      tabId: "issuer_paymaster",
    });
  }
  if (!hasOption(draft.page2.invoicePaymaster?.deedOfAssignment)) {
    missing.push({
      pageStep: 1,
      section: "Invoice & Paymaster",
      field: "Deed of Assignment",
      tabId: "issuer_paymaster",
    });
  }

  if (options?.hasMarcAssessment === false) {
    missing.push({
      pageStep: 1,
      section: "Credit Insights",
      field: MARC_ASSESSMENT_REQUIRED_MESSAGE,
      tabId: "credit_invoice",
    });
  }

  const creditLabels: Array<[keyof typeof draft.page2.creditInsights, string]> = [
    ["litigationCheckOptionKey", "Litigation Check"],
    ["ccrisStatusOptionKey", "CCRIS Status"],
  ];
  for (const [key, label] of creditLabels) {
    if (!hasOption(draft.page2.creditInsights[key])) {
      missing.push({
        pageStep: 1,
        section: "Credit Insights",
        field: label,
        tabId: "credit_invoice",
      });
    }
  }

  for (const item of draft.page2.aboutInvoice?.items ?? []) {
    if (!hasOption(item.text)) {
      missing.push({
        pageStep: 1,
        section: "About the Invoice",
        field: item.id,
        tabId: "credit_invoice",
      });
    }
  }

  const years = options?.incomeStatementYears ?? [];
  const overrides = draft.page2.financialComparison?.overrides ?? {};
  const manuals = draft.page3.manualFinancialInputs?.years ?? {};
  const overrideLabels: Record<(typeof PAGE_TWO_OVERRIDE_FIELDS)[number], string> = {
    netDebtEquity: "Net Debt / Equity (x)",
    interestCoverage: "Interest Coverage (x)",
    dscr: "DSCR (x)",
    receivablesDays: "Receivables Days",
  };
  const page3Labels: Record<(typeof PAGE_THREE_OFFICER_FINANCIAL_FIELDS)[number], string> = {
    grossProfit: "Gross Profit",
    ebitda: "EBITDA",
    ebit: "EBIT",
    cashAndBank: "Cash & Bank",
    tradeReceivables: "Trade Receivables",
    totalEquity: "Total Equity",
    quickRatio: "Quick Ratio",
    payablesDays: "Payables Days",
  };

  for (const year of years) {
    const overrideRow =
      overrides[year] ??
      overrides[`${year}-12-31`] ??
      Object.entries(overrides).find(([key]) => key.startsWith(`${year}-`))?.[1] ??
      {};
    for (const field of PAGE_TWO_OVERRIDE_FIELDS) {
      const value = overrideRow[field];
      if (value == null || value === "") {
        missing.push({
          pageStep: 1,
          section: "Financial Comparison",
          field: overrideLabels[field],
          year: `FY${year}`,
          tabId: "financial",
        });
      }
    }
    const manualRow = manuals[year] ?? {};
    for (const field of PAGE_THREE_OFFICER_FINANCIAL_FIELDS) {
      const value = manualRow[field];
      if (value == null || value === "") {
        const section =
          field === "grossProfit" || field === "ebitda" || field === "ebit"
            ? "Income Statement"
            : field === "cashAndBank" ||
                field === "tradeReceivables" ||
                field === "totalEquity" ||
                field === "quickRatio"
              ? "Balance Sheet"
              : "Coverage & Efficiency";
        const tabId =
          section === "Income Statement"
            ? "income"
            : section === "Balance Sheet"
              ? "balance"
              : "coverage";
        missing.push({
          pageStep: 2,
          section,
          field: page3Labels[field],
          year: `FY${year}`,
          tabId,
        });
      }
    }
  }

  const takeawayLabels: Array<[keyof typeof draft.page3.investorTakeaways, string]> = [
    ["revenueProfitabilityOptionKey", "Revenue & Profitability"],
    ["liquidityOptionKey", "Liquidity"],
    ["leverageOptionKey", "Leverage"],
    ["debtServicingCapacityOptionKey", "Debt Servicing Capacity"],
    ["receivablesCollectionOptionKey", "Receivables Collection"],
    ["overallFinancialProfileOptionKey", "Overall Financial Profile"],
  ];
  for (const [key, label] of takeawayLabels) {
    if (!hasOption(draft.page3.investorTakeaways[key])) {
      missing.push({
        pageStep: 2,
        section: "Investor Takeaways",
        field: label,
        tabId: "takeaways",
      });
    }
  }

  return missing;
}

export function countMissingForTab(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
  tabId: string,
  options?: ProspectusCompletionOptions
): number {
  return buildProspectusMissingRequiredFields(draft, options).filter((m) => m.tabId === tabId)
    .length;
}

/** Count required missing + approximate total required officer fields for page headers. */
export function countProspectusRequiredFields(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
  options?: ProspectusCompletionOptions
): { missing: number; total: number; complete: number } {
  const missingList = buildProspectusMissingRequiredFields(draft, options);
  const years = options?.incomeStatementYears ?? [];
  const highlightSlots = 3;
  const page2Officer =
    1 + // company size
    1 + // DOA
    3 + // MARC assessment (one org blocker) + litigation + CCRIS
    4 + // about invoice
    years.length * PAGE_TWO_OVERRIDE_FIELDS.length;
  const page3Officer =
    years.length * PAGE_THREE_OFFICER_FINANCIAL_FIELDS.length +
    6; // takeaways
  const total = highlightSlots + page2Officer + page3Officer;
  const missing = missingList.length;
  return {
    missing,
    total,
    complete: Math.max(0, total - missing),
  };
}

export function formatProspectusPageCompletionLabel(
  draft: import("@cashsouk/types").ProspectusReviewStoredContent,
  pageStep: ProspectusWorkflowStepId,
  options?: ProspectusCompletionOptions
): string | undefined {
  if (pageStep === 3) return undefined;
  const missingOnPage = buildProspectusMissingRequiredFields(draft, options).filter(
    (item) => item.pageStep === pageStep
  );
  if (missingOnPage.length === 0) return "Complete";
  return `${missingOnPage.length} required field${missingOnPage.length === 1 ? "" : "s"} missing`;
}

