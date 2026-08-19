/** Hint when a Financing CTA opens the application Offer tab. */
export const OFFER_REVIEW_ON_APPLICATION_HINT = "You'll review this on your application.";

/** Navigate to the application Offer tab for accept/decline (Financing never hosts the modal). */
export function financingOfferHref(
  applicationId: string,
  invoiceId?: string | null
): string {
  const params = new URLSearchParams({ tab: "offer" });
  if (invoiceId) params.set("invoiceId", invoiceId);
  return `/applications/${applicationId}?${params.toString()}`;
}
