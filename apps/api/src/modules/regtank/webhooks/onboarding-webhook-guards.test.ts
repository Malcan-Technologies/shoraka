import { OrganizationType } from "@prisma/client";
import {
  isCancelledOnboardingRow,
  isIndividualWebhookFamilyMatch,
  isCodWebhookFamilyMatch,
  isEodParentFamilyMatch,
  isAmlWebhookOnboardingTypeConsistent,
} from "./onboarding-webhook-guards";

function row(overrides: Partial<{
  status: string;
  onboarding_type: string;
  organization_type: OrganizationType;
}>) {
  return {
    status: "APPROVED",
    onboarding_type: "INDIVIDUAL",
    organization_type: OrganizationType.PERSONAL,
    ...overrides,
  };
}

describe("isCancelledOnboardingRow", () => {
  it("is true only for CANCELLED status", () => {
    expect(isCancelledOnboardingRow(row({ status: "CANCELLED" }))).toBe(true);
    expect(isCancelledOnboardingRow(row({ status: "APPROVED" }))).toBe(false);
    expect(isCancelledOnboardingRow(row({ status: "REJECTED" }))).toBe(false);
  });
});

describe("isIndividualWebhookFamilyMatch", () => {
  it("accepts INDIVIDUAL regardless of organization_type (personal or company-authorized-individual)", () => {
    expect(isIndividualWebhookFamilyMatch(row({ onboarding_type: "INDIVIDUAL", organization_type: OrganizationType.PERSONAL }))).toBe(true);
    expect(isIndividualWebhookFamilyMatch(row({ onboarding_type: "INDIVIDUAL", organization_type: OrganizationType.COMPANY }))).toBe(true);
  });

  it("rejects CORPORATE rows", () => {
    expect(isIndividualWebhookFamilyMatch(row({ onboarding_type: "CORPORATE" }))).toBe(false);
  });
});

describe("isCodWebhookFamilyMatch", () => {
  it("requires both CORPORATE onboarding_type and COMPANY organization_type", () => {
    expect(isCodWebhookFamilyMatch(row({ onboarding_type: "CORPORATE", organization_type: OrganizationType.COMPANY }))).toBe(true);
  });

  it("rejects an INDIVIDUAL onboarding row", () => {
    expect(isCodWebhookFamilyMatch(row({ onboarding_type: "INDIVIDUAL", organization_type: OrganizationType.PERSONAL }))).toBe(false);
  });

  it("rejects CORPORATE onboarding_type with a non-COMPANY organization_type", () => {
    expect(isCodWebhookFamilyMatch(row({ onboarding_type: "CORPORATE", organization_type: OrganizationType.PERSONAL }))).toBe(false);
  });
});

describe("isEodParentFamilyMatch", () => {
  it("requires the parent onboarding_type to be CORPORATE", () => {
    expect(isEodParentFamilyMatch(row({ onboarding_type: "CORPORATE" }))).toBe(true);
    expect(isEodParentFamilyMatch(row({ onboarding_type: "INDIVIDUAL" }))).toBe(false);
  });
});

describe("isAmlWebhookOnboardingTypeConsistent", () => {
  it("allows INDIVIDUAL rows regardless of organization_type", () => {
    expect(
      isAmlWebhookOnboardingTypeConsistent(row({ onboarding_type: "INDIVIDUAL", organization_type: OrganizationType.PERSONAL }))
    ).toBe(true);
    expect(
      isAmlWebhookOnboardingTypeConsistent(row({ onboarding_type: "INDIVIDUAL", organization_type: OrganizationType.COMPANY }))
    ).toBe(true);
  });

  it("requires CORPORATE rows to be organization_type COMPANY", () => {
    expect(
      isAmlWebhookOnboardingTypeConsistent(row({ onboarding_type: "CORPORATE", organization_type: OrganizationType.COMPANY }))
    ).toBe(true);
    expect(
      isAmlWebhookOnboardingTypeConsistent(row({ onboarding_type: "CORPORATE", organization_type: OrganizationType.PERSONAL }))
    ).toBe(false);
  });
});
