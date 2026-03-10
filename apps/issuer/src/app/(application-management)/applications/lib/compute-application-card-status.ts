/**
 * Computes the single status badge for an application card.
 * Card shows exactly one status — the highest-priority current state.
 * Priority: REJECTED > AMENDMENT_REQUESTED > SENT > UNDER_REVIEW > SUBMITTED > DRAFT > APPROVED.
 * Invoice rejection does not reject the application; only contract rejection does.
 */

export type CardStatusResult = {
  /** Badge key for STATUS_BADGES lookup (e.g. rejected, pending_amendment, sent). */
  badgeKey: string;
  /** Display label shown on the card. */
  displayLabel: string;
  /** True when Review Offer button should show (Contract or Invoice SENT). */
  showReviewOffer: boolean;
  /** True when Make Amendments button should show (Contract or Invoice AMENDMENT_REQUESTED). */
  showMakeAmendments: boolean;
};

/** Application, contract, and invoices as received from API or adapter. */
export interface CardStatusInput {
  applicationStatus: string;
  contractStatus?: string | null;
  invoiceStatuses: string[];
}

/**
 * Aggregates invoice statuses to the highest-priority one.
 * When many invoices exist, we must pick one status before comparing with contract/application.
 */
function aggregateInvoiceStatus(invoiceStatuses: string[]): string | null {
  if (invoiceStatuses.length === 0) return null;

  const priorityOrder = [
    "REJECTED",
    "AMENDMENT_REQUESTED",
    "SENT",
    "SUBMITTED",
    "DRAFT",
    "APPROVED",
  ];
  for (const status of priorityOrder) {
    if (invoiceStatuses.includes(status)) return status;
  }
  return invoiceStatuses[0] ?? null;
}

/**
 * Computes the single application card status from application, contract, and invoices.
 * Business rules:
 * - Contract REJECTED → application is REJECTED (invoice rejection does not).
 * - Contract or any invoice AMENDMENT_REQUESTED → card shows Action Required.
 * - Contract or any invoice SENT → card shows Offer Received.
 */
export function computeApplicationCardStatus(input: CardStatusInput): CardStatusResult {
  const appStatus = String(input.applicationStatus ?? "DRAFT").toUpperCase();
  const contractStatus = input.contractStatus
    ? String(input.contractStatus).toUpperCase()
    : null;
  const aggregatedInvoice = aggregateInvoiceStatus(
    input.invoiceStatuses.map((s) => String(s ?? "DRAFT").toUpperCase())
  );

  /* Contract rejection rejects the application. Invoice rejection does not. */
  if (appStatus === "REJECTED" || contractStatus === "REJECTED") {
    return {
      badgeKey: "rejected",
      displayLabel: "Rejected",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }

  /* Amendment requested on contract or any invoice overrides other statuses. */
  if (
    contractStatus === "AMENDMENT_REQUESTED" ||
    aggregatedInvoice === "AMENDMENT_REQUESTED"
  ) {
    return {
      badgeKey: "pending_amendment",
      displayLabel: "Action Required",
      showReviewOffer: false,
      showMakeAmendments: true,
    };
  }

  /* Contract or invoice SENT → Offer Received. Wording updated for user clarity. */
  if (contractStatus === "SENT" || aggregatedInvoice === "SENT") {
    return {
      badgeKey: "sent",
      displayLabel: "Offer Received",
      showReviewOffer: true,
      showMakeAmendments: false,
    };
  }

  /* Application-level statuses in priority order. */
  if (appStatus === "UNDER_REVIEW") {
    return {
      badgeKey: "under_review",
      displayLabel: "Under Review",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }
  if (appStatus === "SUBMITTED") {
    return {
      badgeKey: "submitted",
      displayLabel: "Submitted",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }
  if (appStatus === "RESUBMITTED") {
    return {
      badgeKey: "resubmitted",
      displayLabel: "Resubmitted",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }
  if (appStatus === "DRAFT") {
    return {
      badgeKey: "draft",
      displayLabel: "Draft",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }
  if (appStatus === "APPROVED") {
    return {
      badgeKey: "accepted",
      displayLabel: "Approved",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }
  if (appStatus === "ARCHIVED") {
    return {
      badgeKey: "withdrawn",
      displayLabel: "Withdrawn",
      showReviewOffer: false,
      showMakeAmendments: false,
    };
  }

  return {
    badgeKey: "draft",
    displayLabel: "Draft",
    showReviewOffer: false,
    showMakeAmendments: false,
  };
}
