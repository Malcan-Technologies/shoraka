/**
 * SECTION: Group RegTank statuses for UI display
 * WHY: Keep UI grouping separate from raw status persistence
 * INPUT: "EMAIL_SENT"
 * OUTPUT: "PENDING"
 * WHERE USED: UI mapping layer (not webhook persistence)
 */
export type RegtankStatusGroup =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export function groupRegtankStatus(status: string): RegtankStatusGroup {
  const normalized = (status || "").trim().toUpperCase();

  if (normalized === "APPROVED" || normalized === "AML_APPROVED" || normalized === "COMPLETED") {
    return "APPROVED";
  }

  if (normalized === "REJECTED" || normalized === "FAILED" || normalized === "DECLINED") {
    return "REJECTED";
  }

  if (normalized === "EXPIRED" || normalized === "TIMEOUT") {
    return "EXPIRED";
  }

  if (
    normalized === "WAIT_FOR_APPROVAL" ||
    normalized === "PENDING_APPROVAL" ||
    normalized === "UNDER_REVIEW" ||
    normalized === "RISK ASSESSED"
  ) {
    return "UNDER_REVIEW";
  }

  return "PENDING";
}
