import {
  InvoiceStatus,
  isInvoiceOnlyFinancingStructure,
  type SigningPackageOfferKind,
} from "@cashsouk/types";

export type SigningPackageOfferSource = {
  packageKind: SigningPackageOfferKind;
  offerDetails: unknown;
};

/**
 * Invoice-only applications still have a holder `contract_id` for customer details.
 * Authorised representatives (including the company-seal applier) live on the invoice offer.
 */
export function resolveSigningPackageOfferSource(input: {
  financingStructure?: unknown;
  contractId?: string | null;
  contractOfferDetails?: unknown;
  invoices: Array<{
    id: string;
    status?: string | null;
    offer_details?: unknown;
  }>;
}): SigningPackageOfferSource {
  const invoiceOnly = isInvoiceOnlyFinancingStructure(input.financingStructure);
  if (invoiceOnly || !input.contractId) {
    const invoice =
      input.invoices.find((item) => item.status === InvoiceStatus.OFFER_SENT) ??
      input.invoices.find((item) => item.offer_details != null);
    return {
      packageKind: "invoice",
      offerDetails: invoice?.offer_details ?? null,
    };
  }
  return {
    packageKind: "contract",
    offerDetails: input.contractOfferDetails ?? null,
  };
}
