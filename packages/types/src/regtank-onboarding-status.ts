/**
 * SECTION: RegTank individual onboarding status (mirror reg_tank_onboarding semantics)
 * WHY: Persist and display the same string RegTank sends (normalized only)
 * INPUT: Raw RegTank webhook status string
 * OUTPUT: normalizeRawStatus(status) for reg_tank_onboarding.status
 * WHERE USED: apps/api RegTank handlers, packages/types CTOS display, issuer UI
 */
import { normalizeRawStatus } from "./status-normalization";
import { parseCtosPartySupplement } from "./ctos-party-supplement-json";

/** Persists webhook `status` with trim / upper / spaces→underscore only (no semantic remap). */
export function mapRegtankIndividualLivenessRawToInternalStatus(status: string): string {
  return normalizeRawStatus(status);
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
  const sup = parseCtosPartySupplement(onboardingJson);
  const st = sup.screening?.status;
  if (typeof st === "string" && st.trim()) {
    const n = normalizeRawStatus(st);
    return n || null;
  }
  const n = normalizeRawStatus(fallbackDirectorAmlStatus);
  return n || null;
}

/** Backward-compatible wrapper: now returns normalized raw status only. */
export function getDisplayAmlStatus(raw?: string | null): string {
  return normalizeRawStatus(raw);
}

/** RegTank onboarding pipeline status from supplement root `status`. */
export function effectiveCtosRegtankStatusFromOnboardingJson(
  onboardingJson: unknown
): string | null {
  const st = parseCtosPartySupplement(onboardingJson).status;
  if (typeof st === "string" && st.trim()) {
    const n = normalizeRawStatus(st);
    return n || null;
  }
  return null;
}

/** Badge surface for normalized raw statuses (no invented labels). */
export function regtankDisplayStatusBadgeClass(displayLabel: string | undefined): string {
  const s = normalizeRawStatus(displayLabel);
  if (!s) return "bg-muted text-muted-foreground";
  if (s === "APPROVED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (s === "REJECTED" || s === "FAILED") {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
}
