/**
 * Application statuses in which Admin review actions are allowed.
 * One list for the API review guards, the Admin Financial edit lock and the Admin review UI.
 */
export const APPLICATION_REVIEWABLE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "CONTRACT_PENDING",
  "CONTRACT_SENT",
  "CONTRACT_ACCEPTED",
  "INVOICE_ACCEPTED",
  "SIGNING_PENDING",
  "INVOICE_PENDING",
  "INVOICES_SENT",
  "OFFER_EXPIRED",
  "RESUBMITTED",
  "AMENDMENT_REQUESTED",
] as const;

export type ApplicationReviewableStatus = (typeof APPLICATION_REVIEWABLE_STATUSES)[number];

const REVIEWABLE_STATUS_SET: ReadonlySet<string> = new Set(APPLICATION_REVIEWABLE_STATUSES);

export function isApplicationReviewableStatus(status: string | null | undefined): boolean {
  return REVIEWABLE_STATUS_SET.has(String(status ?? "").trim().toUpperCase());
}
