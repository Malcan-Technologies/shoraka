/**
 * SECTION: RegTank individual onboarding status (mirror reg_tank_onboarding semantics)
 * WHY: Single mapping for liveness webhooks, CTOS party JSON, and UI labels
 * INPUT: Raw RegTank webhook status string
 * OUTPUT: Internal status string (same as reg_tank_onboarding.status)
 * WHERE USED: apps/api RegTank handlers, packages/types CTOS display, issuer UI
 */

/** Same mapping as individual-onboarding-handler / handleWebhookUpdate for reg_tank_onboarding.status */
export function mapRegtankIndividualLivenessRawToInternalStatus(status: string): string {
  const statusUpper = status.toUpperCase();
  let internalStatus = statusUpper;
  if (
    statusUpper === "PROCESSING" ||
    statusUpper === "ID_UPLOADED" ||
    statusUpper === "LIVENESS_STARTED"
  ) {
    internalStatus = "FORM_FILLING";
  } else if (statusUpper === "LIVENESS_PASSED") {
    internalStatus = "LIVENESS_PASSED";
  } else if (statusUpper === "WAIT_FOR_APPROVAL") {
    internalStatus = "PENDING_APPROVAL";
  } else if (statusUpper === "APPROVED") {
    internalStatus = "PENDING_AML";
  } else if (statusUpper === "REJECTED") {
    internalStatus = statusUpper;
  }
  return internalStatus;
}

/** Human-readable label for profile / CTOS rows (aligned with org onboarding UX). */
export function mapRegtankStatusToDisplay(status: string | undefined | null): string {
  const s = (status || "").trim();
  switch (s) {
    case "IN_PROGRESS":
    case "PENDING":
      return "Pending";
    case "PENDING_AML":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "FORM_FILLING":
    case "LIVENESS_PASSED":
    case "PENDING_APPROVAL":
      return "Pending";
    default:
      return "Pending";
  }
}

/** Read regtankStatus from supplement JSON; migrate legacy lowercase `status` if present. */
export function effectiveCtosRegtankStatusFromOnboardingJson(
  onboardingJson: unknown
): string | null {
  if (!onboardingJson || typeof onboardingJson !== "object" || Array.isArray(onboardingJson)) {
    return null;
  }
  const ob = onboardingJson as Record<string, unknown>;
  const rs = ob.regtankStatus;
  if (typeof rs === "string" && rs.trim()) return rs.trim();
  const legacy = ob.status;
  if (legacy === "approved") return "APPROVED";
  if (legacy === "rejected") return "REJECTED";
  if (legacy === "pending") return "IN_PROGRESS";
  return null;
}

/** Badge surface for display labels from mapRegtankStatusToDisplay (matches admin KYC/AML palette). */
export function regtankDisplayStatusBadgeClass(displayLabel: string | undefined): string {
  if (!displayLabel) return "bg-muted text-muted-foreground";
  const s = displayLabel.toLowerCase();
  if (s === "approved") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (s === "rejected") {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
  if (s === "pending") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  }
  return "bg-muted text-muted-foreground";
}
