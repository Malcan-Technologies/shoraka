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

  it("routes historical completed company with missing fee to fee", () => {
    const org = baseOrg({
      type: "COMPANY",
      name: "Acme",
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "COMPLETED",
    });
    expect(getOnboardingStep(org, "issuer")).toBe("fee");
    expect(getOnboardingRouteForOrg(org, "issuer")).toBe("/onboarding/fee");
  });

  it("routes rejected organizations to dashboard like origin/main", () => {
    const paid = baseOrg({
      type: "COMPANY",
      name: "Acme",
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "REJECTED",
    });
    expect(getOnboardingStep(paid, "issuer")).toBe("rejected");
    expect(getOnboardingRouteForOrg(paid, "issuer")).toBe("/");

    const unpaid = baseOrg({
      type: "COMPANY",
      name: "Acme",
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "REJECTED",
    });
    expect(getOnboardingStep(unpaid, "issuer")).toBe("rejected");
    expect(getOnboardingRouteForOrg(unpaid, "issuer")).toBe("/");
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

describe("issuer onboarding stepper DB-accurate steps", () => {
  it("keeps later steps completed when an earlier step is incomplete (example A)", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "COMPLETED",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(false);
    expect(stepById(steps, "fee").isCurrent).toBe(true);
    expect(stepById(steps, "verify").isCompleted).toBe(true);
    expect(stepById(steps, "approval").isCompleted).toBe(true);
  });

  it("keeps later incomplete steps incomplete when an earlier step is current (example B)", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "IN_PROGRESS",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isCurrent).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(false);
    expect(stepById(steps, "verify").isCompleted).toBe(false);
    expect(stepById(steps, "verify").isCurrent).toBe(false);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
    expect(stepById(steps, "approval").isCurrent).toBe(false);
  });

  it("does not mark fee completed from onboarding_status COMPLETED when fee timestamp is null", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "COMPLETED",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(false);
    expect(stepById(steps, "fee").isCurrent).toBe(true);
    expect(stepById(steps, "verify").isCompleted).toBe(true);
    expect(stepById(steps, "approval").isCompleted).toBe(true);
    expect(getOnboardingStepperSteps(org, "issuer", "fee").find((s) => s.isCurrent)?.id).toBe("fee");
  });

  it("shows fee current when agreement done and fee unpaid", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "PENDING",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isCurrent).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(false);
    expect(stepById(steps, "verify").isCompleted).toBe(false);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
  });

  it("shows onboarding current when agreement and fee are done", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "IN_PROGRESS",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "fee").isCompleted).toBe(true);
    expect(stepById(steps, "verify").isCurrent).toBe(true);
    expect(stepById(steps, "verify").isCompleted).toBe(false);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
  });

  it("shows approval current when verification is complete and admin is pending", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "PENDING_APPROVAL",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(stepById(steps, "verify").isCompleted).toBe(true);
    expect(stepById(steps, "approval").isCurrent).toBe(true);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
  });

  it("marks all steps completed only when each field says complete", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "COMPLETED",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(steps.every((step) => step.isCompleted)).toBe(true);
    expect(steps.every((step) => !step.isCurrent)).toBe(true);
    expect(steps.some((step) => step.isRejected)).toBe(false);
  });

  it("rejection uses own fields for completion and only marks verify rejected", () => {
    const paidRejected = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: new Date().toISOString(),
      onboardingStatus: "REJECTED",
    });
    const paidSteps = getOnboardingStepperSteps(paidRejected, "issuer");
    expect(stepById(paidSteps, "tnc").isCompleted).toBe(true);
    expect(stepById(paidSteps, "fee").isCompleted).toBe(true);
    expect(stepById(paidSteps, "verify").isRejected).toBe(true);
    expect(stepById(paidSteps, "verify").isCompleted).toBe(false);
    expect(stepById(paidSteps, "approval").isCompleted).toBe(false);
    expect(stepById(paidSteps, "approval").isRejected).toBeFalsy();
    expect(paidSteps.every((step) => !step.isCurrent)).toBe(true);
    expect(getOnboardingRouteForOrg(paidRejected, "issuer")).toBe("/");

    const feeMissingRejected = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "REJECTED",
    });
    const feeMissingSteps = getOnboardingStepperSteps(feeMissingRejected, "issuer");
    expect(stepById(feeMissingSteps, "tnc").isCompleted).toBe(true);
    expect(stepById(feeMissingSteps, "fee").isCompleted).toBe(false);
    expect(stepById(feeMissingSteps, "fee").isCurrent).toBe(false);
    expect(stepById(feeMissingSteps, "verify").isRejected).toBe(true);
    expect(stepById(feeMissingSteps, "approval").isCompleted).toBe(false);
    expect(feeMissingSteps.every((step) => !step.isCurrent)).toBe(true);
    expect(getOnboardingRouteForOrg(feeMissingRejected, "issuer")).toBe("/");

    const unpaidRejected = issuerCompanyOrg({
      tncAccepted: false,
      onboardingFeePaidAt: null,
      onboardingStatus: "REJECTED",
    });
    const unpaidSteps = getOnboardingStepperSteps(unpaidRejected, "issuer");
    expect(stepById(unpaidSteps, "tnc").isCompleted).toBe(false);
    expect(stepById(unpaidSteps, "tnc").isCurrent).toBe(false);
    expect(stepById(unpaidSteps, "fee").isCompleted).toBe(false);
    expect(stepById(unpaidSteps, "verify").isRejected).toBe(true);
    expect(stepById(unpaidSteps, "verify").isCompleted).toBe(false);
    expect(getOnboardingRouteForOrg(unpaidRejected, "issuer")).toBe("/");
  });

  it("personal issuer has no fee step and currents first incomplete required step", () => {
    const org = baseOrg({
      type: "PERSONAL",
      tncAccepted: true,
      onboardingStatus: "IN_PROGRESS",
    });

    const steps = getOnboardingStepperSteps(org, "issuer");
    expect(steps.find((step) => step.id === "fee")).toBeUndefined();
    expect(stepById(steps, "tnc").isCompleted).toBe(true);
    expect(stepById(steps, "verify").isCurrent).toBe(true);
    expect(stepById(steps, "approval").isCompleted).toBe(false);
  });

  it("ignores currentRouteStep override", () => {
    const org = issuerCompanyOrg({
      tncAccepted: true,
      onboardingFeePaidAt: null,
      onboardingStatus: "IN_PROGRESS",
    });

    const steps = getOnboardingStepperSteps(org, "issuer", "verify");
    expect(stepById(steps, "fee").isCurrent).toBe(true);
    expect(stepById(steps, "verify").isCurrent).toBe(false);
  });
});
