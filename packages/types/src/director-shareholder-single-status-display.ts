/**
 * SECTION: Director/shareholder single-line status (display only)
 * WHY: One badge when UI shows a single KYC/AML state; AML always wins over KYC
 * INPUT: Raw `screening.status` (AML) and `onboarding.status` (KYC) from people[]
 * OUTPUT: Group, human label, and badge Tailwind classes (no DB writes)
 * WHERE USED: Issuer director/shareholders section, admin onboarding people cards
 */

import { normalizeRawStatus } from "./status-normalization";

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

const AML_GROUP_LABEL: Record<AmlStatusGroup, string> = {
  NOT_STARTED: "AML: Not Started",
  IN_PROGRESS: "AML: In Progress",
  UNDER_REVIEW: "AML: Under Review",
  APPROVED: "AML: Approved",
  REJECTED: "AML: Rejected",
};

const KYC_GROUP_LABEL: Record<KycStatusGroup, string> = {
  NOT_STARTED: "KYC: Not Started",
  IN_PROGRESS: "KYC: In Progress",
  PENDING_REVIEW: "KYC: Pending Review",
  APPROVED: "KYC: Approved",
  REJECTED: "KYC: Rejected",
  EXPIRED: "KYC: Expired",
};

const GREEN =
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent";
const RED = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-transparent";
const AMBER = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-transparent";
const BLUE = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-transparent";
const MUTED = "bg-muted text-muted-foreground border-transparent dark:bg-muted/40";
const EXPIRED_GRAY =
  "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-transparent";

function badgeClassForAmlGroup(g: AmlStatusGroup): string {
  switch (g) {
    case "APPROVED":
      return GREEN;
    case "REJECTED":
      return RED;
    case "UNDER_REVIEW":
      return AMBER;
    case "IN_PROGRESS":
      return BLUE;
    case "NOT_STARTED":
    default:
      return MUTED;
  }
}

function badgeClassForKycGroup(g: KycStatusGroup): string {
  switch (g) {
    case "APPROVED":
      return GREEN;
    case "REJECTED":
      return RED;
    case "PENDING_REVIEW":
      return AMBER;
    case "IN_PROGRESS":
      return BLUE;
    case "EXPIRED":
      return EXPIRED_GRAY;
    case "NOT_STARTED":
    default:
      return MUTED;
  }
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
      label: AML_GROUP_LABEL[group],
      badgeClassName: badgeClassForAmlGroup(group),
    };
  }
  if (kycRaw) {
    const group = getKycGroup(kycRaw);
    return {
      source: "KYC",
      group,
      label: KYC_GROUP_LABEL[group],
      badgeClassName: badgeClassForKycGroup(group),
    };
  }
  return null;
}
