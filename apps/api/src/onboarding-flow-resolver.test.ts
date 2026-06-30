import type { Organization } from "@cashsouk/config";
import {
  getOnboardingRouteForOrg,
  getOnboardingStep,
  getOnboardingStepRoute,
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
});
