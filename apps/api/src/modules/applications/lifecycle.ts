/**
 * Centralized application status computation.
 *
 * In simple terms: Given contract + invoices, what should application.status be?
 * - Contract exists (and not invoice_only) → contract status wins (WITHDRAWN/REJECTED/APPROVED). Invoices don't override.
 * - Contract APPROVED + 0 invoices → COMPLETED (contract-only flow; no invoice step).
 * - No contract OR invoice_only → invoice statuses decide (all withdrawn → WITHDRAWN, all rejected → REJECTED, all final → COMPLETED).
 *
 * Invoice_only apps have a contract for customer_details but no offer flow; use invoice-based lifecycle.
 */

import {
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
} from "@cashsouk/types";

const TERMINAL_INVOICE_STATUSES = new Set([
  InvoiceStatus.APPROVED,
  InvoiceStatus.REJECTED,
  InvoiceStatus.WITHDRAWN,
]);

export function computeApplicationStatus(
  contract: { status: ContractStatus } | null,
  invoices: { status: InvoiceStatus }[],
  applicationStatus: ApplicationStatus,
  options?: { isInvoiceOnly?: boolean }
): ApplicationStatus {
  const isInvoiceOnly = options?.isInvoiceOnly ?? false;

  const allInvoicesFinal =
    invoices.length > 0 &&
    invoices.every((i) => TERMINAL_INVOICE_STATUSES.has(i.status));

  const allWithdrawn =
    invoices.length > 0 &&
    invoices.every((i) => i.status === InvoiceStatus.WITHDRAWN);

  const allRejected =
    invoices.length > 0 &&
    invoices.every((i) => i.status === InvoiceStatus.REJECTED);

  if (contract && !isInvoiceOnly) {
    /** Contract-based lifecycle: invoices do NOT control application status. */
    if (contract.status === ContractStatus.WITHDRAWN) {
      return ApplicationStatus.WITHDRAWN;
    }
    if (contract.status === ContractStatus.REJECTED) {
      return ApplicationStatus.REJECTED;
    }
    if (contract.status === ContractStatus.APPROVED) {
      if (invoices.length === 0) return ApplicationStatus.COMPLETED;
      if (allInvoicesFinal) return ApplicationStatus.COMPLETED;
    }
    /** Contract still active (SUBMITTED, OFFER_SENT, etc.). */
    return applicationStatus;
  }

  /** Invoice-only lifecycle: when no contract exists OR invoice_only (contract exists for customer_details only). */
  if (invoices.length > 0) {
    if (allWithdrawn) return ApplicationStatus.WITHDRAWN;
    if (allRejected) return ApplicationStatus.REJECTED;
    if (allInvoicesFinal) return ApplicationStatus.COMPLETED;
  }
  return applicationStatus;
}
