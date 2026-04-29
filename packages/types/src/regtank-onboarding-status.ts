/**
 * SECTION: RegTank individual onboarding status (mirror reg_tank_onboarding semantics)
 * WHY: Single mapping for liveness webhooks, CTOS party JSON, and UI labels
 * INPUT: Raw RegTank webhook status string
 * OUTPUT: Internal status string (same as reg_tank_onboarding.status)
 * WHERE USED: apps/api RegTank handlers, packages/types CTOS display, issuer UI
 */
import { normalizeRawStatus } from "./status-normalization";

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

/** Backward-compatible wrapper: now returns normalized raw status only. */
export function mapRegtankStatusToDisplay(status: string | undefined | null): string {
  return normalizeRawStatus(status);
}

/**
 * CTOS party supplement AML line (written by API KYC webhook CTOS path).
 * Prefer `onboarding_json.aml.rawStatus`; optional legacy `director_aml_status` string for EOD-linked rows.
 */
export function getCtosPartySupplementAmlRawStatus(
  onboardingJson: unknown,
  fallbackDirectorAmlStatus?: string | null
): string | null {
  if (!onboardingJson || typeof onboardingJson !== "object" || Array.isArray(onboardingJson)) {
    const fb = (fallbackDirectorAmlStatus ?? "").trim();
    return fb.length ? fb.toUpperCase() : null;
  }
  const ob = onboardingJson as Record<string, unknown>;
  const screening = ob.screening && typeof ob.screening === "object" && !Array.isArray(ob.screening)
    ? (ob.screening as Record<string, unknown>)
    : null;
  if (screening && typeof screening.status === "string" && screening.status.trim()) {
    return screening.status.trim().toUpperCase();
  }
  const aml = screening?.aml ?? ob.aml;
  if (aml && typeof aml === "object" && !Array.isArray(aml)) {
    const raw = (aml as Record<string, unknown>).rawStatus;
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim().toUpperCase();
    }
  }
  const fb = (fallbackDirectorAmlStatus ?? "").trim();
  return fb.length ? fb.toUpperCase() : null;
}

/** Backward-compatible wrapper: now returns normalized raw status only. */
export function getDisplayAmlStatus(raw?: string | null): string {
  return normalizeRawStatus(raw);
}

/** Read RegTank pipeline status from supplement JSON (`onboarding.status` or legacy `regtankStatus`). */
export function effectiveCtosRegtankStatusFromOnboardingJson(
  onboardingJson: unknown
): string | null {
  if (!onboardingJson || typeof onboardingJson !== "object" || Array.isArray(onboardingJson)) {
    return null;
  }
  const ob = onboardingJson as Record<string, unknown>;
  const nested = ob.onboarding;
  const fromOnb =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : null;
  const rs = (fromOnb?.status ?? fromOnb?.regtankStatus ?? ob.regtankStatus) as unknown;
  if (typeof rs === "string" && rs.trim()) return rs.trim();
  const legacy = ob.status;
  if (legacy === "approved") return "APPROVED";
  if (legacy === "rejected") return "REJECTED";
  if (legacy === "pending") return "IN_PROGRESS";
  return null;
}

/** Badge surface for normalized raw statuses. */
export function regtankDisplayStatusBadgeClass(displayLabel: string | undefined): string {
  if (!displayLabel) return "bg-muted text-muted-foreground";
  const s = normalizeRawStatus(displayLabel);
  if (s === "APPROVED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (s === "REJECTED" || s === "FAILED") {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
  if (
    s === "PENDING" ||
    s === "IN_PROGRESS" ||
    s === "PENDING_AML" ||
    s === "FORM_FILLING" ||
    s === "LIVENESS_PASSED" ||
    s === "PENDING_APPROVAL" ||
    s === "WAIT_FOR_APPROVAL" ||
    s === "EMAIL_SENT" ||
    s === "LIVENESS_STARTED" ||
    s === "SENT"
  ) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  }
  if (s === "NOT_STARTED" || s === "STATUS_UNAVAILABLE") {
    return "bg-muted text-muted-foreground dark:bg-muted/40";
  }
  return "bg-muted text-muted-foreground";
}
