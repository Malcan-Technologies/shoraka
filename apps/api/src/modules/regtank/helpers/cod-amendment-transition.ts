import { OnboardingStatus, OrganizationType } from "@prisma/client";
import type { PortalType } from "../types";

export type UrlGeneratedAmendmentUpdate = {
  nextStatus: "PENDING_AMENDMENT";
  reset: {
    onboarding_approved: false;
    aml_approved: false;
    ssm_approved?: false;
    ssm_checked?: false;
  };
};

/**
 * Decide whether `URL_GENERATED` should start the amendment loop.
 *
 * This is a pure helper (easy to unit test). The COD webhook handler still:
 * - loads webhook payload history
 * - parses org + portal type
 * - writes to Prisma
 */
export function getUrlGeneratedAmendmentUpdate(params: {
  portalType: PortalType;
  orgType: OrganizationType;
  currentOnboardingStatus: OnboardingStatus;
  amendmentStarted: boolean;
}): UrlGeneratedAmendmentUpdate | null {
  const { portalType, orgType, currentOnboardingStatus, amendmentStarted } = params;

  if (!amendmentStarted) return null;
  if (orgType !== OrganizationType.COMPANY) return null;

  const isInReviewState =
    currentOnboardingStatus === "PENDING_SSM_REVIEW" || currentOnboardingStatus === "PENDING_APPROVAL";
  if (!isInReviewState) return null;

  return {
    nextStatus: "PENDING_AMENDMENT",
    reset: {
      onboarding_approved: false,
      aml_approved: false,
      ...(portalType === "investor" ? { ssm_approved: false } : { ssm_checked: false }),
    },
  };
}

/**
 * Decide the onboarding_status on `WAIT_FOR_APPROVAL`.
 * For corporate onboarding, we always return to `PENDING_SSM_REVIEW`.
 */
export function getWaitForApprovalNextStatus(params: {
  orgType: OrganizationType;
  currentOnboardingStatus: OnboardingStatus;
}): "PENDING_SSM_REVIEW" | "PENDING_APPROVAL" {
  const { orgType } = params;
  if (orgType === OrganizationType.COMPANY) return "PENDING_SSM_REVIEW";
  return "PENDING_APPROVAL";
}

/**
 * Organization stages that have not yet passed the "awaiting review" gate.
 * A `WAIT_FOR_APPROVAL` COD webhook is only allowed to (re)apply the review-stage
 * reset while the organization is in one of these stages.
 */
const PRE_REVIEW_ONBOARDING_STATUSES: ReadonlySet<OnboardingStatus> = new Set([
  OnboardingStatus.PENDING,
  OnboardingStatus.IN_PROGRESS,
  OnboardingStatus.PENDING_SSM_REVIEW,
  OnboardingStatus.PENDING_AMENDMENT,
]);

export type CodWaitForApprovalUpdate = {
  nextStatus: "PENDING_SSM_REVIEW" | "PENDING_APPROVAL";
  reset: {
    onboarding_approved: false;
    ssm_approved?: false;
    ssm_checked?: false;
  };
};

/**
 * Decide whether a `WAIT_FOR_APPROVAL` COD webhook may (re)apply the "awaiting review"
 * reset to onboarding_status/onboarding_approved/ssm flags.
 *
 * Duplicate or out-of-order COD webhooks must never regress an organization that has
 * already progressed past review (PENDING_APPROVAL, PENDING_AML, PENDING_FINAL_APPROVAL,
 * COMPLETED) or is terminal (REJECTED). Returns `null` when the reset must be skipped —
 * callers should still persist informational data (director/corporate JSON) but leave
 * the onboarding_status/onboarding_approved/ssm flags untouched.
 */
export function getCodWaitForApprovalUpdate(params: {
  portalType: PortalType;
  orgType: OrganizationType;
  currentOnboardingStatus: OnboardingStatus;
}): CodWaitForApprovalUpdate | null {
  const { portalType, orgType, currentOnboardingStatus } = params;

  if (!PRE_REVIEW_ONBOARDING_STATUSES.has(currentOnboardingStatus)) {
    return null;
  }

  const nextStatus = getWaitForApprovalNextStatus({ orgType, currentOnboardingStatus });

  return {
    nextStatus,
    reset: {
      onboarding_approved: false,
      ...(portalType === "investor" ? { ssm_approved: false } : { ssm_checked: false }),
    },
  };
}

/**
 * Decide whether a `APPROVED` COD webhook may set the `onboarding_approved` milestone
 * flag and create an audit log entry.
 *
 * Only applies once, from `PENDING_APPROVAL` with `onboarding_approved` not yet set.
 * A duplicate `APPROVED` delivery (or one arriving after the org already advanced) must
 * be a safe no-op here — the caller should still run the shared sequencing helper
 * (`advanceOnboardingStatusFromFlags`), which is itself idempotent.
 */
export function shouldApplyCodApprovedOnboardingFlag(params: {
  currentOnboardingStatus: OnboardingStatus;
  onboardingApproved: boolean;
}): boolean {
  return (
    params.currentOnboardingStatus === OnboardingStatus.PENDING_APPROVAL && !params.onboardingApproved
  );
}

