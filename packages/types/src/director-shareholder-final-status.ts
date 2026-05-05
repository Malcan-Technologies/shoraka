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
    return { label: "Action Required", tone: "danger" };
  }

  if (source === "ONBOARDING" && value === "REJECTED") {
    return { label: "Action Required", tone: "danger" };
  }

  if (source === "AML" && REJECT_FAIL_DECLINE.has(value)) {
    return { label: "Rejected", tone: "danger" };
  }
  if (source === "ONBOARDING" && (value === "FAILED" || value === "DECLINED")) {
    return { label: "Rejected", tone: "danger" };
  }

  if (PENDING_REVIEW.has(value)) {
    return { label: "Pending Review", tone: "warning" };
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
 * Flat semantic fills for director/shareholder status chips (light + dark).
 * Aligns with portal badge usage: success / warning / info / danger / neutral / expired.
 */
export function getFinalStatusBadgeClassName(tone: DirectorShareholderFinalStatusTone): string {
  switch (tone) {
    case "success":
      return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200";
    case "warning":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/35 dark:text-amber-200";
    case "info":
      return "bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
    case "danger":
      return "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200";
    case "expired":
      return "bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200";
    case "neutral":
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  }
}
