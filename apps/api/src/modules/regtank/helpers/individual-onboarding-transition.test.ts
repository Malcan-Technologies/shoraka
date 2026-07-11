import { OnboardingStatus } from "@prisma/client";
import {
  getIndividualWaitForApprovalUpdate,
  decideIndividualApprovedOutcome,
} from "./individual-onboarding-transition";

describe("individual-onboarding-transition", () => {
  describe("getIndividualWaitForApprovalUpdate (WAIT_FOR_APPROVAL / LIVENESS_PASSED monotonic guard)", () => {
    it("applies from PENDING (fresh onboarding)", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.PENDING,
      });
      expect(update).toEqual({ nextStatus: "PENDING_APPROVAL" });
    });

    it("applies from IN_PROGRESS", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.IN_PROGRESS,
      });
      expect(update).toEqual({ nextStatus: "PENDING_APPROVAL" });
    });

    it("applies (idempotently) when already at PENDING_APPROVAL", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
      });
      expect(update).toEqual({ nextStatus: "PENDING_APPROVAL" });
    });

    it("does NOT regress an organization already at PENDING_AML", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.PENDING_AML,
      });
      expect(update).toBeNull();
    });

    it("does NOT regress an organization already at PENDING_FINAL_APPROVAL", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
      });
      expect(update).toBeNull();
    });

    it("does NOT touch a COMPLETED organization", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.COMPLETED,
      });
      expect(update).toBeNull();
    });

    it("does NOT touch a REJECTED organization", () => {
      const update = getIndividualWaitForApprovalUpdate({
        currentOnboardingStatus: OnboardingStatus.REJECTED,
      });
      expect(update).toBeNull();
    });
  });

  describe("decideIndividualApprovedOutcome (idempotent, monotonic APPROVED handling)", () => {
    it("heals from PENDING (APPROVED arrived before WAIT_FOR_APPROVAL)", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.PENDING,
          onboardingApproved: false,
        })
      ).toBe("heal-to-pending-approval");
    });

    it("heals from IN_PROGRESS", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.IN_PROGRESS,
          onboardingApproved: false,
        })
      ).toBe("heal-to-pending-approval");
    });

    it("sets approved and advances from PENDING_APPROVAL when not yet approved", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
          onboardingApproved: false,
        })
      ).toBe("set-approved-and-advance");
    });

    it("does not re-apply when already approved while on PENDING_APPROVAL (duplicate APPROVED)", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.PENDING_APPROVAL,
          onboardingApproved: true,
        })
      ).toBe("advance-only");
    });

    it("does not regress an org already at PENDING_AML (healing/idempotent advance only)", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.PENDING_AML,
          onboardingApproved: true,
        })
      ).toBe("advance-only");
    });

    it("does not regress an org already at PENDING_FINAL_APPROVAL", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.PENDING_FINAL_APPROVAL,
          onboardingApproved: true,
        })
      ).toBe("advance-only");
    });

    it("does not regress a COMPLETED org", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.COMPLETED,
          onboardingApproved: true,
        })
      ).toBe("advance-only");
    });

    it("does not resurrect a REJECTED org from a late APPROVED webhook", () => {
      expect(
        decideIndividualApprovedOutcome({
          currentOnboardingStatus: OnboardingStatus.REJECTED,
          onboardingApproved: false,
        })
      ).toBe("advance-only");
    });
  });
});
