import { OrganizationType, OnboardingStatus } from "@prisma/client";
import {
  getUrlGeneratedAmendmentUpdate,
  getWaitForApprovalNextStatus,
  getCodWaitForApprovalUpdate,
  shouldApplyCodApprovedOnboardingFlag,
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

  describe("getCodWaitForApprovalUpdate (D3 monotonic guard)", () => {
    it("applies the review reset from a fresh PENDING status (company)", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "investor",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING,
      });
      expect(update).not.toBeNull();
      expect(update?.nextStatus).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
      expect(update?.reset.onboarding_approved).toBe(false);
      expect(update?.reset.ssm_approved).toBe(false);
    });

    it("applies the review reset when already at PENDING_SSM_REVIEW (idempotent duplicate)", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "issuer",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING_SSM_REVIEW,
      });
      expect(update).not.toBeNull();
      expect(update?.nextStatus).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
      expect(update?.reset.ssm_checked).toBe(false);
    });

    it("applies the review reset when resubmitted from PENDING_AMENDMENT", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "investor",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING_AMENDMENT,
      });
      expect(update).not.toBeNull();
      expect(update?.nextStatus).toBe(OnboardingStatus.PENDING_SSM_REVIEW);
    });

    it("does NOT regress an organization already at PENDING_APPROVAL (D3 fix)", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "investor",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
      });
      expect(update).toBeNull();
    });

    it("does NOT regress an organization already at PENDING_AML", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "issuer",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING_AML,
      });
      expect(update).toBeNull();
    });

    it("does NOT regress an organization already at PENDING_FINAL_APPROVAL", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "investor",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      });
      expect(update).toBeNull();
    });

    it("does NOT touch a COMPLETED organization", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "investor",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.COMPLETED,
      });
      expect(update).toBeNull();
    });

    it("does NOT touch a REJECTED organization", () => {
      const update = getCodWaitForApprovalUpdate({
        portalType: "issuer",
        orgType: OrganizationType.COMPANY,
        currentOnboardingStatus: OnboardingStatus.REJECTED,
      });
      expect(update).toBeNull();
    });
  });

  describe("shouldApplyCodApprovedOnboardingFlag (idempotent COD APPROVED)", () => {
    it("applies when org is on PENDING_APPROVAL and not yet approved", () => {
      expect(
        shouldApplyCodApprovedOnboardingFlag({
          currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
          onboardingApproved: false,
        })
      ).toBe(true);
    });

    it("does not re-apply when org is on PENDING_APPROVAL but already approved (duplicate APPROVED webhook)", () => {
      expect(
        shouldApplyCodApprovedOnboardingFlag({
          currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
          onboardingApproved: true,
        })
      ).toBe(false);
    });

    it("does not apply once the org has already advanced past PENDING_APPROVAL (out-of-order APPROVED after advance)", () => {
      expect(
        shouldApplyCodApprovedOnboardingFlag({
          currentOnboardingStatus: OnboardingStatus.PENDING_AML,
          onboardingApproved: true,
        })
      ).toBe(false);
    });

    it("does not apply while org is still awaiting SSM review", () => {
      expect(
        shouldApplyCodApprovedOnboardingFlag({
          currentOnboardingStatus: OnboardingStatus.PENDING_SSM_REVIEW,
          onboardingApproved: false,
        })
      ).toBe(false);
    });
  });
});

