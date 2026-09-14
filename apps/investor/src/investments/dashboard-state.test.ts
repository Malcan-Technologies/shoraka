import {
  approvalPipelineStages,
  currentOnboardingStepHref,
  investorDashboardWelcomeSubhead,
  onboardingStepProgress,
  resolveInvestorDashboardState,
} from "./dashboard-state";

describe("resolveInvestorDashboardState", () => {
  it("resolves onboarding when the step is still a user action", () => {
    expect(resolveInvestorDashboardState({ step: "deposit", investmentCount: 0 })).toBe(
      "onboarding"
    );
    expect(resolveInvestorDashboardState({ step: "verify", investmentCount: 0 })).toBe(
      "onboarding"
    );
    expect(resolveInvestorDashboardState({ step: "terms", investmentCount: 2 })).toBe(
      "onboarding"
    );
  });

  it("resolves approval for the pending-review step", () => {
    expect(resolveInvestorDashboardState({ step: "approval", investmentCount: 0 })).toBe(
      "approval"
    );
    expect(resolveInvestorDashboardState({ step: "approval", investmentCount: 4 })).toBe(
      "approval"
    );
  });

  it("resolves new when completed with an empty book", () => {
    expect(resolveInvestorDashboardState({ step: "completed", investmentCount: 0 })).toBe("new");
  });

  it("resolves active when completed with holdings", () => {
    expect(resolveInvestorDashboardState({ step: "completed", investmentCount: 1 })).toBe(
      "active"
    );
  });

  it("resolves rejected", () => {
    expect(resolveInvestorDashboardState({ step: "rejected", investmentCount: 0 })).toBe(
      "rejected"
    );
  });
});

describe("investorDashboardWelcomeSubhead", () => {
  it("mentions next-90-day cashflow when the book is active and cash is due", () => {
    expect(
      investorDashboardWelcomeSubhead({
        state: "active",
        remainingStepCount: 0,
        next90DayCashflowLabel: "RM 12,000.00",
      })
    ).toContain("RM 12,000.00");
  });

  it("uses a generic earning line when no cashflow is due", () => {
    expect(
      investorDashboardWelcomeSubhead({
        state: "active",
        remainingStepCount: 0,
        next90DayCashflowLabel: null,
      })
    ).toBe("Your portfolio is earning. Browse notes when you are ready to commit more capital.");
  });

  it("uses remaining-step copy for onboarding", () => {
    expect(
      investorDashboardWelcomeSubhead({
        state: "onboarding",
        remainingStepCount: 2,
        next90DayCashflowLabel: null,
      })
    ).toBe("2 steps left before you can invest.");
    expect(
      investorDashboardWelcomeSubhead({
        state: "onboarding",
        remainingStepCount: 1,
        next90DayCashflowLabel: null,
      })
    ).toBe("One step left before you can invest.");
  });
});

describe("onboarding helpers", () => {
  it("computes progress from completed steps", () => {
    expect(
      onboardingStepProgress([{ isCompleted: true }, { isCompleted: true }, { isCompleted: false }])
    ).toEqual({ completed: 2, total: 3, percent: 67 });
  });

  it("links continue to existing onboarding routes", () => {
    expect(currentOnboardingStepHref("verify")).toBe("/onboarding/verify");
    expect(currentOnboardingStepHref("deposit")).toBe("#first-deposit");
    expect(currentOnboardingStepHref("approval")).toBeNull();
  });
});

describe("approvalPipelineStages", () => {
  it("marks AML as current while PENDING_AML", () => {
    const stages = approvalPipelineStages({ onboardingStatus: "PENDING_AML" });
    expect(stages.find((stage) => stage.id === "aml")?.status).toBe("current");
    expect(stages.find((stage) => stage.id === "final")?.status).toBe("pending");
  });

  it("marks final approval as current after AML", () => {
    const stages = approvalPipelineStages({
      onboardingStatus: "PENDING_FINAL_APPROVAL",
      amlApproved: true,
    });
    expect(stages.find((stage) => stage.id === "aml")?.status).toBe("done");
    expect(stages.find((stage) => stage.id === "final")?.status).toBe("current");
    expect(stages.find((stage) => stage.id === "wallet")?.status).toBe("pending");
  });
});
