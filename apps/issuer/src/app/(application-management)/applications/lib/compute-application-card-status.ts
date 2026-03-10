/**
 * Computes the single status badge and button flags for an application card.
 *
 * Input: applicationStatus, contractStatus, invoiceStatuses (from adapter or API).
 * Output: badgeKey, displayLabel, showReviewOffer, showMakeAmendments.
 *
 * Example: SENT + SENT + [SENT] returns badgeKey "sent", showReviewOffer true.
 * Priority order: Rejected > Action Required > Offer Received > ... > Approved.
 * One card shows one badge; we pick the highest-priority status.
 */

/** Returned to adapter/page. badgeKey maps to STATUS_BADGES in config. */
export type CardStatusResult = {
  badgeKey: string;
  displayLabel: string;
  showReviewOffer: boolean;
  showMakeAmendments: boolean;
};

/** Input from adapter. Statuses from Prisma Application, Contract, Invoice. */
export interface CardStatusInput {
  applicationStatus: string;
  contractStatus?: string | null;
  invoiceStatuses: string[];
}

/**
 * When multiple invoices exist, pick the highest-priority status.
 * Example: [SENT, DRAFT, APPROVED] returns SENT (offer received takes precedence).
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
 * Main function. Checks statuses in priority order; first match returns.
 * Contract REJECTED overrides everything; invoice rejection does not reject the app.
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

  /* Contract or invoice SENT shows "Offer Received". */
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
