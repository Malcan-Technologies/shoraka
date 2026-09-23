/**
 * Choose the offer blob for Letter of Offer generate.
 * Facility-linked invoices skip offer_acceptance; authorised parties live on the facility offer.
 */

export function letterOfOfferGenerateTarget(input: {
  sourceInvoiceId: string | null;
  sourceContractId: string | null;
  invoiceContractId: string | null | undefined;
}): { invoiceId: string | null; contractId: string | null } {
  const invoiceId = input.sourceInvoiceId?.trim() || null;
  const invoiceContractId = input.invoiceContractId?.trim() || null;
  const facilityId = input.sourceContractId?.trim() || invoiceContractId || null;
  if (invoiceId && !invoiceContractId) {
    return { invoiceId, contractId: null };
  }
  return { invoiceId: null, contractId: facilityId };
}
