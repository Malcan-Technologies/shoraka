/**
 * SECTION: RegTank individual onboarding status (mirror reg_tank_onboarding semantics)
 * WHY: Persist and display the same string RegTank sends (normalized only)
 * INPUT: Raw RegTank webhook status string
 * OUTPUT: normalizeRawStatus(status) for reg_tank_onboarding.status
 * WHERE USED: apps/api RegTank handlers, packages/types CTOS display, issuer UI
 */
import { normalizeRawStatus } from "./status-normalization";

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
  if (!onboardingJson || typeof onboardingJson !== "object" || Array.isArray(onboardingJson)) {
    const n = normalizeRawStatus(fallbackDirectorAmlStatus);
    return n || null;
  }
  const ob = onboardingJson as Record<string, unknown>;
  const screening = ob.screening && typeof ob.screening === "object" && !Array.isArray(ob.screening)
    ? (ob.screening as Record<string, unknown>)
    : null;
  if (screening && typeof screening.status === "string" && screening.status.trim()) {
    const n = normalizeRawStatus(screening.status);
    return n || null;
  }
  const aml = screening?.aml ?? ob.aml;
  if (aml && typeof aml === "object" && !Array.isArray(aml)) {
    const raw = (aml as Record<string, unknown>).rawStatus;
    if (typeof raw === "string" && raw.trim()) {
      const n = normalizeRawStatus(raw);
      return n || null;
    }
  }
  const n = normalizeRawStatus(fallbackDirectorAmlStatus);
  return n || null;
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
  if (typeof rs === "string" && rs.trim()) {
    const n = normalizeRawStatus(rs);
    return n || null;
  }
  const legacy = ob.status;
  if (typeof legacy === "string" && legacy.trim()) {
    const n = normalizeRawStatus(legacy);
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
