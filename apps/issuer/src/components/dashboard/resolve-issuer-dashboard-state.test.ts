import {
  issuerDashboardSubhead,
  onboardingStepCta,
  resolveApprovalReviewIndex,
  resolveIssuerDashboardState,
  resolveOnboardingSubmittedAt,
} from "./resolve-issuer-dashboard-state";

describe("resolveIssuerDashboardState", () => {
  it("maps rejected before other statuses", () => {
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "rejected",
        onboardingStatus: "REJECTED",
        applicationCount: 0,
      })
    ).toBe("rejected");
  });

  it("maps pending amendment even when the flow step is approval", () => {
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "approval",
        onboardingStatus: "PENDING_AMENDMENT",
        applicationCount: 0,
      })
    ).toBe("pending_amendment");
  });

  it("maps approval from step or admin-wait statuses", () => {
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "approval",
        onboardingStatus: "PENDING_APPROVAL",
        applicationCount: 0,
      })
    ).toBe("approval");
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "approval",
        onboardingStatus: "PENDING_AML",
        applicationCount: 0,
      })
    ).toBe("approval");
  });

  it("maps completed with an empty book to new", () => {
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "completed",
        onboardingStatus: "COMPLETED",
        applicationCount: 0,
        liveNoteCount: 0,
      })
    ).toBe("new");
  });

  it("maps completed with applications or live notes to active", () => {
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "completed",
        onboardingStatus: "COMPLETED",
        applicationCount: 1,
      })
    ).toBe("active");
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "completed",
        onboardingStatus: "COMPLETED",
        applicationCount: 0,
        liveNoteCount: 2,
      })
    ).toBe("active");
  });

  it("maps remaining in-app steps to onboarding", () => {
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "verify",
        onboardingStatus: "IN_PROGRESS",
        applicationCount: 0,
      })
    ).toBe("onboarding");
    expect(
      resolveIssuerDashboardState({
        onboardingStep: "fee",
        onboardingStatus: "IN_PROGRESS",
        applicationCount: 0,
      })
    ).toBe("onboarding");
  });
});

describe("issuerDashboardSubhead", () => {
  it("uses live remaining-step copy for onboarding", () => {
    expect(
      issuerDashboardSubhead({ state: "onboarding", remainingOnboardingSteps: 2 })
    ).toBe("2 steps left before you can apply for financing.");
  });

  it("combines pending action and next repayment for active", () => {
    expect(
      issuerDashboardSubhead({
        state: "active",
        remainingOnboardingSteps: 0,
        pendingTitle: "An offer is waiting for your decision.",
        nextRepaymentLine: "RM 186,400 is due on 18 Sep 2026.",
      })
    ).toBe("An offer is waiting for your decision. RM 186,400 is due on 18 Sep 2026.");
    expect(
      issuerDashboardSubhead({
        state: "active",
        remainingOnboardingSteps: 0,
        pendingTitle: "11 actions required",
        nextRepaymentLine: "RM 57,170 is due on 26 Jul 2026.",
      })
    ).toBe("11 actions required. RM 57,170 is due on 26 Jul 2026.");
  });
});

describe("onboardingStepCta", () => {
  it("routes remaining steps to existing onboarding pages", () => {
    expect(onboardingStepCta("fee")).toEqual({ href: "/onboarding/fee", label: "Pay fee" });
    expect(onboardingStepCta("approval")).toBeNull();
  });
});

describe("resolveApprovalReviewIndex", () => {
  it("advances the static review stepper from live onboarding status", () => {
    expect(
      resolveApprovalReviewIndex({ onboardingStatus: "PENDING_APPROVAL" })
    ).toBe(1);
    expect(resolveApprovalReviewIndex({ onboardingStatus: "PENDING_AML" })).toBe(2);
    expect(
      resolveApprovalReviewIndex({ onboardingStatus: "PENDING_FINAL_APPROVAL" })
    ).toBe(3);
  });
});

describe("resolveOnboardingSubmittedAt", () => {
  it("returns a live org timestamp when present and omits invented fields", () => {
    expect(resolveOnboardingSubmittedAt({ submittedAt: "2026-09-07T01:14:00.000Z" })).toBe(
      "2026-09-07T01:14:00.000Z"
    );
    expect(resolveOnboardingSubmittedAt({})).toBeNull();
  });
});
