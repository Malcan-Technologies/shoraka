/**
 * Pure helpers for acceptance document review ↔ offer phase alignment.
 * Item reject/reset follows the same rules as supporting documents (derived section status).
 */

/** Docs + people must all be APPROVED; any AMENDMENT_REQUESTED flags CHANGES_REQUESTED. */
export function resolveAcceptanceReviewApprovalGate(input: {
  docKeys: readonly string[];
  partyKeys: readonly string[];
  statusByKey: ReadonlyMap<string, string>;
}): { hasAmendment: boolean; allApproved: boolean } {
  const requiredKeys = [...input.docKeys, ...input.partyKeys];
  const hasAmendment = requiredKeys.some(
    (key) => input.statusByKey.get(key) === "AMENDMENT_REQUESTED"
  );
  const allApproved =
    requiredKeys.length > 0 &&
    requiredKeys.every((key) => input.statusByKey.get(key) === "APPROVED");
  return { hasAmendment, allApproved };
}

export type OfferAcceptancePhaseTarget =
  | "CHANGES_REQUESTED"
  | "APPROVED_FOR_SIGNING"
  | "PENDING_ADMIN_REVIEW";

/**
 * Next offer_acceptance.status for one contract or invoice ceremony.
 * Callers must pass that entity's own authorized-party keys — never a sibling offer's.
 */
export function resolveOfferAcceptancePhaseTarget(input: {
  current: { status: string; submitted_at?: string | null } | null | undefined;
  hasAmendment: boolean;
  allApproved: boolean;
  requiredKeyCount: number;
}): OfferAcceptancePhaseTarget | null {
  const current = input.current;
  if (!current) return null;
  if (
    current.status === "PENDING_ISSUER" ||
    current.status === "REJECTED" ||
    current.status === "DECLINED" ||
    current.status === "COMPLETED" ||
    current.status === "SIGNING_IN_PROGRESS"
  ) {
    return null;
  }
  if (!current.submitted_at && current.status !== "APPROVED_FOR_SIGNING") {
    return null;
  }

  if (input.hasAmendment) {
    if (
      current.status === "PENDING_ADMIN_REVIEW" ||
      current.status === "APPROVED_FOR_SIGNING" ||
      current.status === "CHANGES_REQUESTED"
    ) {
      return "CHANGES_REQUESTED";
    }
    return null;
  }

  if (current.status === "CHANGES_REQUESTED") {
    return "PENDING_ADMIN_REVIEW";
  }

  if (input.allApproved) {
    if (
      current.status === "PENDING_ADMIN_REVIEW" ||
      current.status === "APPROVED_FOR_SIGNING"
    ) {
      return "APPROVED_FOR_SIGNING";
    }
    return null;
  }

  if (current.status === "APPROVED_FOR_SIGNING" && input.requiredKeyCount > 0) {
    return "PENDING_ADMIN_REVIEW";
  }
  return null;
}
