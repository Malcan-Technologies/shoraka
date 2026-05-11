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

