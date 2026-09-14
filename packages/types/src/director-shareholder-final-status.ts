/**
 * SECTION: Director/shareholder unified badge
 * WHY: Default AML-first for portals; admin onboarding-approval step can show KYC-only before AML review
 * INPUT: screening (AML) + onboarding (KYC/KYB) on a people row
 * OUTPUT: label + tone for Badge
 * WHERE USED: Admin table, issuer profile, investor cards, onboarding review dialog
 */

import { isKycOnboardingNotStartedToken } from "./kyc-onboarding-lifecycle";
import { normalizeRawStatus } from "./status-normalization";

export type DirectorShareholderFinalStatusTone =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"
  | "expired";

/** Who the related-party status is waiting on. Portal theme then picks yellow vs blue. */
export type RelatedPartyStatusActor = "admin" | "user" | "none";

export type RelatedPartyStatusViewer = "admin" | "user";

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
  "URL_GENERATED",
  "ID_UPLOADED",
  "LIVENESS_STARTED",
  "LIVENESS_PASSED",
  "EMAIL_SENT",
  "SENT",
  "FORM_FILLING",
]);

const APPROVED_DONE = new Set(["APPROVED", "AML_APPROVED", "CLEAR"]);

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
  if (aml && !isKycOnboardingNotStartedToken(aml)) return { source: "AML", value: aml };
  const onboarding = normalizeRawStatus(person.onboarding?.status);
  return {
    source: "ONBOARDING",
    value: isKycOnboardingNotStartedToken(onboarding) ? "" : onboarding,
  };
}

export type DirectorShareholderFinalStatusPresentation = {
  label: string;
  tone: DirectorShareholderFinalStatusTone;
  actor: RelatedPartyStatusActor;
};

function labelFromEffective(effective: {
  source: DirectorShareholderEffectiveStatusSource;
  value: string;
}): DirectorShareholderFinalStatusPresentation {
  const { source, value } = effective;

  if (!value || isKycOnboardingNotStartedToken(value)) {
    return { label: "Not Started", tone: "neutral", actor: "none" };
  }

  if (value === "EXPIRED" || value === "TIMEOUT") {
    return { label: "Expired", tone: "expired", actor: "none" };
  }

  if (value === "ACTION_REQUIRED" || value === "ACTION_NEEDED") {
    return { label: "Action Required", tone: "warning", actor: "user" };
  }

  if (source === "ONBOARDING" && value === "REJECTED") {
    return { label: "Action Required", tone: "warning", actor: "user" };
  }

  if (value === "FAILED") {
    return { label: "Failed", tone: "danger", actor: "none" };
  }
  if (value === "REJECTED" || value === "DECLINED") {
    return { label: "Rejected", tone: "danger", actor: "none" };
  }

  if (PENDING_REVIEW.has(value)) {
    return { label: "Pending Review", tone: "info", actor: "admin" };
  }

  if (IN_PROGRESS.has(value)) {
    return { label: "In Progress", tone: "warning", actor: "user" };
  }

  if (value === "COMPLETED") {
    return { label: "Completed", tone: "success", actor: "none" };
  }

  if (APPROVED_DONE.has(value)) {
    return { label: "Approved", tone: "success", actor: "none" };
  }

  return { label: "In Progress", tone: "warning", actor: "user" };
}

export function getFinalStatusLabel(
  person: DirectorShareholderStatusPerson,
  options?: GetFinalStatusLabelOptions
): DirectorShareholderFinalStatusPresentation {
  const effective =
    options?.displayMode === "kyc_only"
      ? {
          source: "ONBOARDING" as const,
          value: isKycOnboardingNotStartedToken(person.onboarding?.status)
            ? ""
            : normalizeRawStatus(person.onboarding?.status),
        }
      : getDirectorShareholderEffectiveStatus(person);
  return labelFromEffective(effective);
}

/**
 * Viewer-centric StatusBadge tokens for KYC/AML chips.
 * warning = you must act (yellow) · info = waiting (blue) · expired = failed (red).
 */
export function getFinalStatusToken(
  tone: DirectorShareholderFinalStatusTone
): "action" | "submitted" | "success" | "rejected" | "neutral" | "active" {
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
 * Ivan's portal colour rule for related-party verification:
 * admin-action pending → yellow on admin / blue on issuer-investor
 * user-action pending → blue on admin / yellow on issuer-investor
 */
export function getRelatedPartyStatusToken(
  presentation: Pick<DirectorShareholderFinalStatusPresentation, "tone"> & {
    actor?: RelatedPartyStatusActor;
  },
  viewer: RelatedPartyStatusViewer
): "action" | "submitted" | "success" | "rejected" | "neutral" | "active" {
  if (presentation.actor === "admin") {
    return viewer === "admin" ? "action" : "submitted";
  }
  if (presentation.actor === "user") {
    return viewer === "admin" ? "submitted" : "action";
  }
  return getFinalStatusToken(presentation.tone);
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
