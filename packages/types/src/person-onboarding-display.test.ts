import {
  PERSON_IDENTITY_NOT_AVAILABLE,
  PERSON_IDENTITY_PENDING_ONBOARDING,
  isPersonKycApproved,
  personIdentityDisplay,
  shouldDeferOnboardingPersonComrep,
} from "./person-onboarding-display";
import { computeIssuerPersonCompleteness } from "./comrep-profile";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";

const director = {
  partyKey: generatedKey,
  name: "Ahmad Bin Ali",
  entityType: "INDIVIDUAL" as const,
  isDirector: true,
  isShareholder: false,
  isBoard: false,
  isManagement: false,
  identityPrefix: null,
  identityNumber: null,
  dateOfBirth: null,
  dateOfIncorporation: null,
  gender: null,
  nationality: null,
  countryOfIncorporation: null,
  address: null,
  shareType: null,
  shareTypeOther: null,
  shareholdingUnits: null,
  shareholdingAmount: null,
  shareholdingPercentage: null,
  designation: null,
  designationOther: null,
  appointmentDate: null,
};

describe("person onboarding display and completeness gating", () => {
  it("does not show user:{uuid} as a government ID", () => {
    const pending = personIdentityDisplay({
      partyKey: generatedKey,
      identityNumber: null,
      kycOnboardingStatus: null,
    });
    expect(pending.value).toBe(PERSON_IDENTITY_PENDING_ONBOARDING);
    expect(pending.governmentId).toBeNull();
    expect(pending.value).not.toContain("user:");
  });

  it("shows Pending onboarding before KYC approval and Not available after", () => {
    expect(
      personIdentityDisplay({
        partyKey: generatedKey,
        identityNumber: null,
        kycOnboardingStatus: "IN_PROGRESS",
      }).value
    ).toBe(PERSON_IDENTITY_PENDING_ONBOARDING);
    expect(
      personIdentityDisplay({
        partyKey: generatedKey,
        identityNumber: null,
        kycOnboardingStatus: "WAIT_FOR_APPROVAL",
      }).value
    ).toBe(PERSON_IDENTITY_PENDING_ONBOARDING);
    expect(
      personIdentityDisplay({
        partyKey: generatedKey,
        identityNumber: null,
        kycOnboardingStatus: "APPROVED",
      }).value
    ).toBe(PERSON_IDENTITY_NOT_AVAILABLE);
  });

  it("shows the seeded identity_number after approval", () => {
    expect(
      personIdentityDisplay({
        partyKey: generatedKey,
        identityNumber: "900101101234",
        kycOnboardingStatus: "APPROVED",
      }).value
    ).toBe("900101101234");
  });

  it("gates ComRep missing fields until KYC APPROVED", () => {
    expect(
      shouldDeferOnboardingPersonComrep({
        entityType: "INDIVIDUAL",
        isDirector: true,
        kycOnboardingStatus: null,
      })
    ).toBe(true);
    expect(
      shouldDeferOnboardingPersonComrep({
        entityType: "INDIVIDUAL",
        isDirector: true,
        kycOnboardingStatus: "IN_PROGRESS",
      })
    ).toBe(true);
    expect(
      shouldDeferOnboardingPersonComrep({
        entityType: "INDIVIDUAL",
        isDirector: true,
        kycOnboardingStatus: "WAIT_FOR_APPROVAL",
      })
    ).toBe(true);
    expect(
      shouldDeferOnboardingPersonComrep({
        entityType: "INDIVIDUAL",
        isDirector: true,
        kycOnboardingStatus: "APPROVED",
      })
    ).toBe(false);
    expect(isPersonKycApproved("APPROVED")).toBe(true);
  });

  it("does not count ComRep gaps for a Not Started onboarding Person", () => {
    expect(
      computeIssuerPersonCompleteness({
        ...director,
        kycOnboardingStatus: null,
      })
    ).toHaveLength(0);
    expect(
      computeIssuerPersonCompleteness({
        ...director,
        kycOnboardingStatus: "IN_PROGRESS",
      })
    ).toHaveLength(0);
    expect(
      computeIssuerPersonCompleteness({
        ...director,
        kycOnboardingStatus: "WAIT_FOR_APPROVAL",
      })
    ).toHaveLength(0);
  });

  it("shows remaining ComRep fields after KYC APPROVED", () => {
    const missing = computeIssuerPersonCompleteness({
      ...director,
      kycOnboardingStatus: "APPROVED",
    });
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some((item) => item.field === "identityNumber")).toBe(true);
  });

  it("has no missing ComRep warning when KYC APPROVED and the Person is complete", () => {
    expect(
      computeIssuerPersonCompleteness({
        ...director,
        identityPrefix: "NRIC",
        identityNumber: "900101101234",
        dateOfBirth: "1990-01-01",
        gender: "MALE",
        nationality: "MALAYSIA",
        address: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
        kycOnboardingStatus: "APPROVED",
      })
    ).toHaveLength(0);
  });

  it("does not gate corporate shareholders or omit status (legacy callers)", () => {
    expect(
      computeIssuerPersonCompleteness({
        ...director,
        entityType: "CORPORATE",
        isDirector: false,
        isShareholder: true,
        identityPrefix: "ROC",
        identityNumber: "202001234567",
        kycOnboardingStatus: null,
      }).length
    ).toBeGreaterThan(0);
    expect(computeIssuerPersonCompleteness(director).length).toBeGreaterThan(0);
  });
});
