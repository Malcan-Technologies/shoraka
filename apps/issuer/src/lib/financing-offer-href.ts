/** Navigate to the application Offer tab for accept/decline (Financing never hosts the modal). */
export function financingOfferHref(
  applicationId: string,
  invoiceId?: string | null
): string {
  const params = new URLSearchParams({ tab: "offer" });
  if (invoiceId) params.set("invoiceId", invoiceId);
  return `/applications/${applicationId}?${params.toString()}`;
}
