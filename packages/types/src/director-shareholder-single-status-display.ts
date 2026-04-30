/**
 * SECTION: Director/shareholder single-line status (display only)
 * WHY: One badge when UI shows a single KYC/AML state; AML always wins over KYC
 * INPUT: Raw `screening.status` (AML) and `onboarding.status` (KYC) from people[]
 * OUTPUT: Group, human label, and badge Tailwind classes (no DB writes)
 * WHERE USED: Issuer director/shareholders section, admin onboarding people cards
 */

import { normalizeRawStatus } from "./status-normalization";
import { regtankDisplayStatusBadgeClass } from "./regtank-onboarding-status";
import { toTitleCase } from "./title-case";

export type AmlStatusGroup = "NOT_STARTED" | "IN_PROGRESS" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export type KycStatusGroup =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type DirectorShareholderSingleSource = "AML" | "KYC";

export type DirectorShareholderSingleStatusPresentation = {
  source: DirectorShareholderSingleSource;
  group: AmlStatusGroup | KycStatusGroup;
  label: string;
  badgeClassName: string;
};

const AML_APPROVED = ["APPROVED", "AML_APPROVED", "CLEAR"] as const;
const AML_REJECTED = ["REJECTED", "FAILED", "DECLINED"] as const;
const AML_UNDER_REVIEW = [
  "WAIT_FOR_APPROVAL",
  "UNDER_REVIEW",
  "RISK_ASSESSED",
  "PENDING_APPROVAL",
] as const;
const AML_IN_PROGRESS = [
  "PENDING",
  "IN_PROGRESS",
  "PROCESSING",
  "ID_UPLOADED",
  "LIVENESS_STARTED",
  "LIVENESS_PASSED",
  "EMAIL_SENT",
  "SENT",
  "FORM_FILLING",
] as const;

const KYC_APPROVED = ["APPROVED"] as const;
const KYC_REJECTED = ["REJECTED", "FAILED", "DECLINED"] as const;
const KYC_EXPIRED = ["EXPIRED", "TIMEOUT"] as const;
const KYC_PENDING_REVIEW = ["WAIT_FOR_APPROVAL", "WAITING_FOR_APPROVAL", "PENDING_APPROVAL"] as const;
const KYC_IN_PROGRESS = [
  "IN_PROGRESS",
  "PROCESSING",
  "ID_UPLOADED",
  "LIVENESS_STARTED",
  "LIVENESS_PASSED",
  "EMAIL_SENT",
  "SENT",
  "FORM_FILLING",
  "PENDING",
] as const;

function inList(s: string, list: readonly string[]): boolean {
  return (list as readonly string[]).includes(s);
}

/** Maps normalized AML pipeline / ACURIS screening token to a coarse UI group. */
export function getAmlGroup(statusRaw: string): AmlStatusGroup {
  const s = normalizeRawStatus(statusRaw);
  if (!s) return "NOT_STARTED";
  if (inList(s, AML_APPROVED)) return "APPROVED";
  if (inList(s, AML_REJECTED)) return "REJECTED";
  if (inList(s, AML_UNDER_REVIEW)) return "UNDER_REVIEW";
  if (inList(s, AML_IN_PROGRESS)) return "IN_PROGRESS";
  return "IN_PROGRESS";
}

/** Maps normalized RegTank / supplement onboarding token to a coarse UI group. */
export function getKycGroup(statusRaw: string): KycStatusGroup {
  const s = normalizeRawStatus(statusRaw);
  if (!s) return "NOT_STARTED";
  if (inList(s, KYC_APPROVED)) return "APPROVED";
  if (inList(s, KYC_REJECTED)) return "REJECTED";
  if (inList(s, KYC_EXPIRED)) return "EXPIRED";
  if (inList(s, KYC_PENDING_REVIEW)) return "PENDING_REVIEW";
  if (inList(s, KYC_IN_PROGRESS)) return "IN_PROGRESS";
  return "IN_PROGRESS";
}

/** Title Case label for badge; `group` enum unchanged for consumers (display-only). */
function displayLabelForGroup(group: AmlStatusGroup | KycStatusGroup): string {
  return toTitleCase(group);
}

/** Reuse shared RegTank badge colors (same helper as raw status badges). */
function badgeClassForStatusGroup(group: AmlStatusGroup | KycStatusGroup): string {
  if (group === "APPROVED") return regtankDisplayStatusBadgeClass("APPROVED");
  if (group === "REJECTED") return regtankDisplayStatusBadgeClass("REJECTED");
  if (group === "NOT_STARTED") return regtankDisplayStatusBadgeClass("");
  return regtankDisplayStatusBadgeClass("WAIT_FOR_APPROVAL");
}

export type DirectorShareholderSingleStatusInput = {
  screening?: { status?: string | null } | null;
  onboarding?: { status?: string | null } | null;
};

/**
 * AML (`screening.status`) overrides KYC (`onboarding.status`) for the single badge.
 * Returns null when both sources are empty after normalization.
 */
export function getDirectorShareholderSingleStatusPresentation(
  person: DirectorShareholderSingleStatusInput
): DirectorShareholderSingleStatusPresentation | null {
  const amlRaw = normalizeRawStatus(person.screening?.status);
  const kycRaw = normalizeRawStatus(person.onboarding?.status);

  if (amlRaw) {
    const group = getAmlGroup(amlRaw);
    return {
      source: "AML",
      group,
      label: displayLabelForGroup(group),
      badgeClassName: badgeClassForStatusGroup(group),
    };
  }
  if (kycRaw) {
    const group = getKycGroup(kycRaw);
    return {
      source: "KYC",
      group,
      label: displayLabelForGroup(group),
      badgeClassName: badgeClassForStatusGroup(group),
    };
  }
  return null;
}

/**
 * Tooltip copy derived from final display label only.
 * Keep this aligned across Admin and Issuer surfaces.
 */
export function getDirectorShareholderStatusTooltip(label: string): string {
  switch (label) {
    case "Approved":
      return "All required checks completed";
    case "Under Review":
      return "Onboarding is under review";
    case "Pending Review":
      return "Awaiting review";
    case "In Progress":
      return "Onboarding is in progress";
    case "Rejected":
      return "Onboarding was rejected - action required";
    case "Expired":
      return "Onboarding expired - action required";
    default:
      return "Status information unavailable";
  }
}
