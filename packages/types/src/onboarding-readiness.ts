import { normalizeRawStatus } from "./status-normalization";

/**
 * SECTION: Director/shareholder onboarding readiness
 * WHY: One source of truth for submit-ready onboarding states
 * INPUT: Raw onboarding.status string
 * OUTPUT: True when onboarding form is submitted and at/after review stage
 * WHERE USED: Banner visibility, proceed/submit gating, DS notification resolve
 */
export function isReadyOnboardingStatus(statusRaw: string | null | undefined): boolean {
  const s = normalizeRawStatus(statusRaw);
  if (!s) return false;
  return (
    s === "WAIT_FOR_APPROVAL" ||
    s === "WAITING_FOR_APPROVAL" ||
    s === "PENDING_APPROVAL" ||
    s === "APPROVED" ||
    s === "COMPLETED" ||
    s === "REJECTED"
  );
}
