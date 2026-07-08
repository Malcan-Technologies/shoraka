/** Signed offer PDF is available after envelope completion auto-accepts the offer. */
export function isSignedOfferLetterAvailable(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "APPROVED";
}
