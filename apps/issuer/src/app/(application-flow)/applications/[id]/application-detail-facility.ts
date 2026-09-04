import type {
  NormalizedApplication,
  NormalizedInvoice,
} from "@/app/(application-management)/applications/status";

export function isIssuerFacilityFinancing(
  application: Pick<NormalizedApplication, "type">
): boolean {
  return application.type === "Facility financing";
}

export function hasIssuerFacilityOffer(
  application: Pick<NormalizedApplication, "type" | "contractStatus">
): boolean {
  return isIssuerFacilityFinancing(application) && application.contractStatus === "OFFER_SENT";
}

export function resolveInvoiceOfferReviewContractId(
  invoice: Pick<NormalizedInvoice, "contractId"> | null | undefined
): string | undefined {
  return invoice?.contractId ?? undefined;
}

export function resolveOfferReviewContractId(input: {
  offerType: "contract" | "invoice";
  application: Pick<NormalizedApplication, "type" | "contractId">;
  invoice: Pick<NormalizedInvoice, "contractId"> | null | undefined;
}): string | undefined {
  if (input.offerType === "contract") {
    if (!isIssuerFacilityFinancing(input.application)) return undefined;
    return input.application.contractId ?? undefined;
  }
  return resolveInvoiceOfferReviewContractId(input.invoice);
}
