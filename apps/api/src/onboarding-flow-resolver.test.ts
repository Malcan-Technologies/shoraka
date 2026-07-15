import type { Organization } from "@cashsouk/config";
import {
  canAccessApplicantAccount,
  getOnboardingRouteForOrg,
  getOnboardingStep,
  getOnboardingStepRoute,
  getOnboardingStepperSteps,
} from "@cashsouk/config";

function baseOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    type: "PERSONAL",
    name: null,
    firstName: "Test",
    lastName: "User",
    registrationNumber: null,
    onboardingStatus: "PENDING",
    onboardedAt: null,
    isOwner: true,
    ownerId: "user-1",
    members: [],
    createdAt: new Date().toISOString(),
    tncAccepted: false,
    depositReceived: false,
    ...overrides,
  };
}

describe("onboarding flow resolver", () => {
  it("routes investor orgs without T&C to terms", () => {
    const org = baseOrg({ onboardingStatus: "IN_PROGRESS", tncAccepted: false });
    expect(getOnboardingStep(org, "investor")).toBe("terms");
    expect(getOnboardingRouteForOrg(org, "investor")).toBe("/onboarding/terms");
  });

  it("routes investor orgs with T&C to verify before RegTank completes", () => {
    const org = baseOrg({ onboardingStatus: "IN_PROGRESS", tncAccepted: true });
    expect(getOnboardingStep(org, "investor")).toBe("verify");
    expect(getOnboardingRouteForOrg(org, "investor")).toBe("/onboarding/verify");
  });

  it("routes issuer company orgs through fee before verify", () => {
    const org = baseOrg({
      type: "COMPANY",
      name: "Acme",
      tncAccepted: true,
      onboardingFeePaidAt: null,
    });
    expect(getOnboardingStep(org, "issuer")).toBe("fee");
    expect(getOnboardingStepRoute("fee")).toBe("/onboarding/fee");
  });

  it("routes pending approval to dashboard", () => {
    const org = baseOrg({ onboardingStatus: "PENDING_APPROVAL", tncAccepted: true });
    expect(getOnboardingStep(org, "investor")).toBe("approval");
    expect(getOnboardingRouteForOrg(org, "investor")).toBe("/");
  });

  it("routes completed investor without deposit to deposit step on dashboard", () => {
    const org = baseOrg({
      onboardingStatus: "COMPLETED",
      tncAccepted: true,
      depositReceived: false,
    });
    expect(getOnboardingStep(org, "investor")).toBe("deposit");
    expect(getOnboardingRouteForOrg(org, "investor")).toBe("/");
  });

  it("allows applicant account access only for AML/final/completed states", () => {
    expect(canAccessApplicantAccount("PENDING_AML")).toBe(true);
    expect(canAccessApplicantAccount("PENDING_FINAL_APPROVAL")).toBe(true);
    expect(canAccessApplicantAccount("COMPLETED")).toBe(true);
    expect(canAccessApplicantAccount("PENDING_APPROVAL")).toBe(false);
    expect(canAccessApplicantAccount("PENDING_AMENDMENT")).toBe(false);
    expect(canAccessApplicantAccount("PENDING_SSM_REVIEW")).toBe(false);
    expect(canAccessApplicantAccount("REJECTED")).toBe(false);
    expect(canAccessApplicantAccount(undefined)).toBe(false);
  });

  it("routes issuer personal orgs from terms directly to verify", () => {
    const org = baseOrg({ type: "PERSONAL", tncAccepted: true, onboardingStatus: "IN_PROGRESS" });
    expect(getOnboardingStep(org, "issuer")).toBe("verify");
    expect(getOnboardingRouteForOrg(org, "issuer")).toBe("/onboarding/verify");
  });
});

function issuerCompanyOrg(overrides: Partial<Organization> = {}): Organization {
  return baseOrg({
    type: "COMPANY",
    name: "Acme",
    tncAccepted: false,
    onboardingFeePaidAt: null,
    onboardingStatus: "PENDING",
    ...overrides,
  });
}

function stepById(steps: ReturnType<typeof getOnboardingStepperSteps>, id: string) {
  const step = steps.find((entry) => entry.id === id);
  if (!step) throw new Error(`Missing step ${id}`);
  return step;
}

describe("issuer onboarding stepper outstanding step", () => {
  it("shows agreement when agreement is missing", () => {
    const org = issuerCompanyOrg({ tncAccepted: false });
    expect(getOnboardingStep(org, "issuer")).toBe("terms");

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCurrent).toBe(true);
    expect(stepById(steps, "tnc").isCompleted).toBe(false);
    expect(stepById(steps, "fee").isCurrent).toBe(false);
    expect(stepById(steps, "fee").isCompleted).toBe(false);
    expect(stepById(steps, "fee").isRejected).toBeFalsy();
  });

  it("shows fee when agreement is done and fee is unpaid", () => {
    const org = issuerCompanyOrg({ tncAccepted: true, onboardingFeePaidAt: null });
    expect(getOnboardingStep(org, "issuer")).toBe("fee");

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "tnc").isRejected).toBeFalsy();
    expect(stepById(steps, "fee").isCurrent).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(false);
  });

  it("shows RegTank when agreement and fee are done but verification is incomplete", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "IN_PROGRESS",
    });
    expect(getOnboardingStep(org, "issuer")).toBe("verify");

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(true);
    expect(stepById(steps, "verify").isCurrent).toBe(true);
    expect(stepById(steps, "approval").isCurrent).toBe(false);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
    expect(stepById(steps, "approval").isRejected).toBeFalsy();
  });

  it("shows approval pending when RegTank is complete and admin review is pending", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "PENDING_APPROVAL",
    });
    expect(getOnboardingStep(org, "issuer")).toBe("approval");

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "verify").isCompleted).toBe(true);
    expect(stepById(steps, "approval").isCurrent).toBe(true);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
  });

  it("marks all steps completed when onboarding is complete", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "COMPLETED",
    });
    expect(getOnboardingStep(org, "issuer")).toBe("completed");

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(steps.every((step) => step.isCompleted)).toBe(true);
    expect(steps.some((step) => step.isRejected)).toBe(false);
  });

  it("does not mark completed steps red on rejection", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "REJECTED",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "tnc").isRejected).toBeFalsy();
    expect(stepById(steps, "fee").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isRejected).toBeFalsy();
    expect(stepById(steps, "verify").isRejected).toBe(true);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
    expect(stepById(steps, "approval").isRejected).toBeFalsy();
  });

  it("keeps unreached steps neutral instead of failed", () => {
    const org = issuerCompanyOrg({ tncAccepted: false });
    const steps = getOnboardingStepperSteps(org, "issuer");

    for (const step of steps) {
      if (step.id !== "tnc") {
        expect(step.isRejected).toBeFalsy();
        expect(step.isCompleted).toBe(false);
        expect(step.isCurrent).toBe(false);
      }
    }
  });
});
