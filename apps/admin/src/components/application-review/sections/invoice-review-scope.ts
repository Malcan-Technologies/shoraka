/**
 * Per-invoice review-item keys (`invoice_details:{index}:{number}`).
 * Must stay aligned with InvoiceSection and API invoice-review-scope.
 * Keep this module free of UI/config imports so the stage model stays unit-testable.
 */

export function buildInvoiceScopeKey(idx: number, invoiceNo: string | number): string {
  const sanitized = String(invoiceNo).replace(/:/g, "_");
  return `invoice_details:${idx}:${sanitized}`;
}

function invoiceNumber(invoice: { details?: unknown } | undefined): string | number | null {
  const details = invoice?.details as Record<string, unknown> | null | undefined;
  if (!details) return null;
  const value = details.number ?? details.Number;
  if (value == null || value === "") return null;
  return value as string | number;
}

export function invoiceReviewScopeKey(
  invoice: { details?: unknown },
  idx: number
): string {
  const invoiceNo = invoiceNumber(invoice);
  return buildInvoiceScopeKey(idx, invoiceNo == null ? idx + 1 : invoiceNo);
}

export function resolveInvoiceReviewItemStatus(
  invoices: readonly { id: string; details?: unknown }[],
  invoiceId: string | null | undefined,
  reviewItems: readonly { item_id: string; status: string }[] | undefined
): string {
  if (!invoiceId) return "PENDING";
  const idx = invoices.findIndex((invoice) => invoice.id === invoiceId);
  if (idx < 0) return "PENDING";
  const invoice = invoices[idx];
  if (!invoice) return "PENDING";
  const scopeKey = invoiceReviewScopeKey(invoice, idx);
  return reviewItems?.find((item) => item.item_id === scopeKey)?.status ?? "PENDING";
}
