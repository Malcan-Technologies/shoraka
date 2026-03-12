/**
 * Centralized application status computation.
 * Contract status always overrides invoice status.
 * Empty invoice arrays are never treated as finished.
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
  applicationStatus: ApplicationStatus
): ApplicationStatus {
  const allInvoicesFinal =
    invoices.length > 0 &&
    invoices.every((i) => TERMINAL_INVOICE_STATUSES.has(i.status));

  const allWithdrawn =
    invoices.length > 0 &&
    invoices.every((i) => i.status === InvoiceStatus.WITHDRAWN);

  const allRejected =
    invoices.length > 0 &&
    invoices.every((i) => i.status === InvoiceStatus.REJECTED);

  // contract rules (highest priority)

  if (contract?.status === ContractStatus.WITHDRAWN) {
    return ApplicationStatus.WITHDRAWN;
  }

  if (contract?.status === ContractStatus.REJECTED) {
    return ApplicationStatus.REJECTED;
  }

  if (contract?.status === ContractStatus.APPROVED) {
    if (invoices.length === 0) return ApplicationStatus.COMPLETED;
    if (allInvoicesFinal) return ApplicationStatus.COMPLETED;
  }

  // invoice-only rules

  if (!contract && invoices.length > 0) {
    if (allWithdrawn) return ApplicationStatus.WITHDRAWN;
    if (allRejected) return ApplicationStatus.REJECTED;
    if (allInvoicesFinal) return ApplicationStatus.COMPLETED;
  }

  return applicationStatus;
}
