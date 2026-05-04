/**
 * SECTION: Director/shareholder unified badge
 * WHY: AML drives the visible status when present; onboarding fills gaps; resend rules live in application-people-display
 * INPUT: screening (AML) + onboarding (KYC/KYB) on a people row
 * OUTPUT: label + tone for Badge
 * WHERE USED: Admin table, issuer profile, investor cards, onboarding status rows
 */

import { normalizeRawStatus } from "./status-normalization";

export type DirectorShareholderFinalStatusTone = "success" | "warning" | "danger" | "neutral" | "expired";

export type DirectorShareholderEffectiveStatusSource = "AML" | "ONBOARDING";

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

export function getFinalStatusLabel(person: DirectorShareholderStatusPerson): {
  label: string;
  tone: DirectorShareholderFinalStatusTone;
} {
  const { source, value } = getDirectorShareholderEffectiveStatus(person);

  if (!value) {
    return { label: "Not Started", tone: "neutral" };
  }

  if (value === "EXPIRED" || value === "TIMEOUT") {
    return { label: "Expired", tone: "expired" };
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
    return { label: "Pending Review", tone: "warning" };
  }

  if (IN_PROGRESS.has(value)) {
    return { label: "In Progress", tone: "warning" };
  }

  if (VERIFIED.has(value)) {
    return { label: "Verified", tone: "success" };
  }

  return { label: "In Progress", tone: "warning" };
}

export function getFinalStatusBadgeClassName(tone: DirectorShareholderFinalStatusTone): string {
  switch (tone) {
    case "success":
      return "bg-green-100 text-green-700";
    case "danger":
      return "bg-red-100 text-red-700";
    case "warning":
      return "bg-amber-100 text-amber-700";
    case "expired":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
