/**
 * SECTION: Director/shareholder unified badge
 * WHY: Default AML-first for portals; admin onboarding-approval step can show KYC-only before AML review
 * INPUT: screening (AML) + onboarding (KYC/KYB) on a people row
 * OUTPUT: label + tone for Badge
 * WHERE USED: Admin table, issuer profile, investor cards, onboarding review dialog
 */

import { normalizeRawStatus } from "./status-normalization";

export type DirectorShareholderFinalStatusTone =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"
  | "expired";

export type DirectorShareholderEffectiveStatusSource = "AML" | "ONBOARDING";

/** `aml_first`: screening wins when non-empty. `kyc_only`: badge from onboarding/KYB only (admin step 3 — onboarding approval). */
export type DirectorShareholderFinalStatusDisplayMode = "aml_first" | "kyc_only";

export type GetFinalStatusLabelOptions = {
  displayMode?: DirectorShareholderFinalStatusDisplayMode;
};

const PENDING_REVIEW = new Set([
  "WAIT_FOR_APPROVAL",
  "WAITING_FOR_APPROVAL",
  "PENDING_APPROVAL",
  "UNDER_REVIEW",
  "RISK_ASSESSED",
  "PENDING",
  "UNRESOLVED",
  "NO_MATCH",
]);

const IN_PROGRESS = new Set([
  "IN_PROGRESS",
  "PROCESSING",
  "ID_UPLOADED",
  "LIVENESS_STARTED",
  "LIVENESS_PASSED",
  "EMAIL_SENT",
  "SENT",
  "FORM_FILLING",
]);

const VERIFIED = new Set(["APPROVED", "AML_APPROVED", "CLEAR"]);

const REJECT_FAIL_DECLINE = new Set(["REJECTED", "FAILED", "DECLINED"]);

export type DirectorShareholderStatusPerson = {
  onboarding?: { status?: string | null } | null;
  screening?: { status?: string | null } | null;
};

/**
 * Effective pipeline token: non-empty AML wins; otherwise onboarding (KYC/KYB).
 */
export function getDirectorShareholderEffectiveStatus(
  person: DirectorShareholderStatusPerson
): { source: DirectorShareholderEffectiveStatusSource; value: string } {
  const aml = normalizeRawStatus(person.screening?.status);
  if (aml) return { source: "AML", value: aml };
  const onboarding = normalizeRawStatus(person.onboarding?.status);
  return { source: "ONBOARDING", value: onboarding };
}

function labelFromEffective(effective: {
  source: DirectorShareholderEffectiveStatusSource;
  value: string;
}): { label: string; tone: DirectorShareholderFinalStatusTone } {
  const { source, value } = effective;

  if (!value) {
    return { label: "Not Started", tone: "neutral" };
  }

  if (value === "EXPIRED" || value === "TIMEOUT") {
    return { label: "Expired", tone: "expired" };
  }

  if (value === "ACTION_REQUIRED" || value === "ACTION_NEEDED") {
    return { label: "Action Required", tone: "warning" };
  }

  if (source === "ONBOARDING" && value === "REJECTED") {
    return { label: "Action Required", tone: "warning" };
  }

  if (source === "AML" && REJECT_FAIL_DECLINE.has(value)) {
    return { label: "Rejected", tone: "danger" };
  }
  if (source === "ONBOARDING" && (value === "FAILED" || value === "DECLINED")) {
    return { label: "Rejected", tone: "danger" };
  }

  if (PENDING_REVIEW.has(value)) {
    return { label: "Pending Review", tone: "info" };
  }

  if (IN_PROGRESS.has(value)) {
    return { label: "In Progress", tone: "info" };
  }

  if (VERIFIED.has(value)) {
    return { label: "Verified", tone: "success" };
  }

  return { label: "In Progress", tone: "info" };
}

export function getFinalStatusLabel(
  person: DirectorShareholderStatusPerson,
  options?: GetFinalStatusLabelOptions
): { label: string; tone: DirectorShareholderFinalStatusTone } {
  const effective =
    options?.displayMode === "kyc_only"
      ? { source: "ONBOARDING" as const, value: normalizeRawStatus(person.onboarding?.status) }
      : getDirectorShareholderEffectiveStatus(person);
  return labelFromEffective(effective);
}

/**
 * Viewer-centric StatusBadge tokens for KYC/AML chips.
 * warning = you must act (yellow) · info = waiting (blue) · expired = failed (red).
 */
export function getFinalStatusToken(
  tone: DirectorShareholderFinalStatusTone
): "action" | "submitted" | "success" | "rejected" | "neutral" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "action";
    case "info":
      return "submitted";
    case "danger":
    case "expired":
      return "rejected";
    default:
      return "neutral";
  }
}

/**
 * Flat semantic fills for director/shareholder status chips.
 * Prefer StatusBadge + getFinalStatusToken; this remains for className call sites.
 */
export function getFinalStatusBadgeClassName(tone: DirectorShareholderFinalStatusTone): string {
  switch (getFinalStatusToken(tone)) {
    case "success":
      return "border-transparent bg-status-success-bg text-status-success-text";
    case "action":
      return "border-transparent bg-status-action-bg text-status-action-text";
    case "submitted":
      return "border-transparent bg-status-submitted-bg text-status-submitted-text";
    case "rejected":
      return "border-transparent bg-status-rejected-bg text-status-rejected-text";
    default:
      return "border-transparent bg-status-neutral-bg text-status-neutral-text";
  }
}
