/**
 * Re-exports shared status presentation from @cashsouk/config.
 * Admin ApplicationStatusBadge, ReviewStepStatusBadge use getReviewStatusPresentation.
 *
 * Admin vs Issuer display:
 * - Admin: raw labels (Contract Pending, Contract Sent, Invoice Pending, Invoices Sent).
 * - Issuer card: collapsed to "Under Review" for those; uses getStatusPresentationByBadgeKey.
 */

export type { StatusPresentation } from "@cashsouk/config";
import { getStatusPresentation } from "@cashsouk/config";

export const getReviewStatusPresentation = getStatusPresentation;
