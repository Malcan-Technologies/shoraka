/** Facility-offer “Responded by” copy when the acceptor may only be known via signing. */
export function resolveOfferRespondedByLabel(
  respondedByUserName: string | null | undefined,
  respondedAt: unknown
): string {
  return (
    respondedByUserName ?? (respondedAt ? "Accepted via signing package" : "No response yet")
  );
}
