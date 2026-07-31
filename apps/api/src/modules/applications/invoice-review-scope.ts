/**
 * Scope keys for per-invoice application_review_items (invoice_details:{index}:{number}).
 * Must stay aligned with admin invoice-review-list and AdminService.collectInvoiceScopeKeys.
 */

export function buildInvoiceScopeKey(idx: number, invoiceNo: string | number): string {
  const sanitized = String(invoiceNo).replace(/:/g, "_");
  return `invoice_details:${idx}:${sanitized}`;
}

export function collectInvoiceScopeKeys(
  invoices: readonly { details?: unknown }[]
): string[] {
  return invoices.map((invoice, idx) => {
    const details = invoice.details as { number?: string | number } | null | undefined;
    const invoiceNo = details?.number ?? idx + 1;
    return buildInvoiceScopeKey(idx, invoiceNo);
  });
}

export function resolveInvoiceScopeKeyForId(
  invoices: readonly { id: string; details?: unknown }[],
  invoiceId: string
): string | null {
  const idx = invoices.findIndex((invoice) => invoice.id === invoiceId);
  if (idx < 0) return null;
  const details = invoices[idx]?.details as { number?: string | number } | null | undefined;
  const invoiceNo = details?.number ?? idx + 1;
  return buildInvoiceScopeKey(idx, invoiceNo);
}
