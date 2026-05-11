import { OrganizationType, OnboardingStatus } from "@prisma/client";
import {
  getUrlGeneratedAmendmentUpdate,
  getWaitForApprovalNextStatus,
} from "./cod-amendment-transition";

describe("cod-amendment-transition", () => {
  it("URL_GENERATED does not start amendment when amendmentStarted is false", () => {
    expect(
      getUrlGeneratedAmendmentUpdate({
        portalType: "investor",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING_SSM_REVIEW,
        amendmentStarted: false,
      })
    ).toBe(null);
  });

  it("URL_GENERATED -> PENDING_AMENDMENT from PENDING_SSM_REVIEW (company/investor)", () => {
    const update = getUrlGeneratedAmendmentUpdate({
      portalType: "investor",
      orgType: OrganizationType.COMPANY,
      currentOnboardingStatus: OnboardingStatus.PENDING_SSM_REVIEW,
      amendmentStarted: true,
    });

    expect(update).not.toBe(null);
    expect(update?.nextStatus).toBe(OnboardingStatus.PENDING_AMENDMENT);
    expect(update?.reset.onboarding_approved).toBe(false);
    expect(update?.reset.aml_approved).toBe(false);
    expect(update?.reset.ssm_approved).toBe(false);
  });

  it("URL_GENERATED -> PENDING_AMENDMENT from PENDING_APPROVAL (company/issuer)", () => {
    const update = getUrlGeneratedAmendmentUpdate({
      portalType: "issuer",
      orgType: OrganizationType.COMPANY,
      currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
      amendmentStarted: true,
    });

    expect(update).not.toBe(null);
    expect(update?.nextStatus).toBe(OnboardingStatus.PENDING_AMENDMENT);
    expect(update?.reset.onboarding_approved).toBe(false);
    expect(update?.reset.aml_approved).toBe(false);
    expect(update?.reset.ssm_checked).toBe(false);
  });

  it("WAIT_FOR_APPROVAL from PENDING_AMENDMENT returns to PENDING_SSM_REVIEW (company)", () => {
    const next = getWaitForApprovalNextStatus({
      orgType: OrganizationType.COMPANY,
      currentOnboardingStatus: OnboardingStatus.PENDING_AMENDMENT,
    });

    expect(next).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
  });

  it("WAIT_FOR_APPROVAL from PENDING_APPROVAL returns to PENDING_SSM_REVIEW for company", () => {
    const next = getWaitForApprovalNextStatus({
      orgType: OrganizationType.COMPANY,
      currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
    });
    expect(next).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
  });
});

