/**
 * Scope offer-acceptance and signing data to one invoice on invoice_only apps.
 * Without this, later chips reuse the first invoice that has offer details or
 * the application-wide primary envelope.
 */

export function resolveAcceptanceOfferDetails(args: {
  primaryEnvelopeInvoiceId?: string | null;
  offerDetails?: unknown;
  invoices?: { id: string; offer_details?: unknown }[];
  selectedInvoiceId?: string | null;
}): unknown {
  const { primaryEnvelopeInvoiceId, offerDetails, invoices = [], selectedInvoiceId } = args;
  if (selectedInvoiceId) {
    const selected = invoices.find((inv) => inv.id === selectedInvoiceId);
    return selected?.offer_details ?? null;
  }
  if (primaryEnvelopeInvoiceId) {
    return (
      invoices.find((inv) => inv.id === primaryEnvelopeInvoiceId)?.offer_details ??
      offerDetails ??
      null
    );
  }
  if (offerDetails != null) return offerDetails;
  return invoices.find((inv) => inv.offer_details != null)?.offer_details ?? null;
}

/** Standalone invoices keep one signing package per invoice. */
export function envelopesForSelectedInvoice<T extends { invoice_id?: string | null }>(
  envelopes: T[],
  selectedInvoiceId?: string | null
): T[] {
  if (!selectedInvoiceId) return envelopes;
  return envelopes.filter((envelope) => envelope.invoice_id === selectedInvoiceId);
}
