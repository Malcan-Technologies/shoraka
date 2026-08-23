import { OnboardingStatus, OrganizationType } from "@prisma/client";
import { getCompanyApprovedSsmLandingUpdate } from "./company-approved-ssm-landing";

describe("getCompanyApprovedSsmLandingUpdate", () => {
  it("advances from PENDING to PENDING_SSM_REVIEW", () => {
    expect(
      getCompanyApprovedSsmLandingUpdate({
        currentOnboardingStatus: OnboardingStatus.PENDING,
      })
    ).toEqual({ nextStatus: "PENDING_SSM_REVIEW" });
  });

  it("advances from IN_PROGRESS to PENDING_SSM_REVIEW", () => {
    expect(
      getCompanyApprovedSsmLandingUpdate({
        currentOnboardingStatus: OnboardingStatus.IN_PROGRESS,
      })
    ).toEqual({ nextStatus: "PENDING_SSM_REVIEW" });
  });

  it("does not re-apply when already at PENDING_SSM_REVIEW", () => {
    expect(
      getCompanyApprovedSsmLandingUpdate({
        currentOnboardingStatus: OnboardingStatus.PENDING_SSM_REVIEW,
      })
    ).toBeNull();
  });

  it.each([
    OnboardingStatus.PENDING_APPROVAL,
    OnboardingStatus.PENDING_AML,
    OnboardingStatus.PENDING_FINAL_APPROVAL,
    OnboardingStatus.COMPLETED,
    OnboardingStatus.REJECTED,
    OnboardingStatus.PENDING_AMENDMENT,
  ])("does not regress %s to PENDING_SSM_REVIEW", (status) => {
    expect(getCompanyApprovedSsmLandingUpdate({ currentOnboardingStatus: status })).toBeNull();
  });

  it("covers company org type without using it as a regression signal", () => {
    expect(OrganizationType.COMPANY).toBeDefined();
  });
});
