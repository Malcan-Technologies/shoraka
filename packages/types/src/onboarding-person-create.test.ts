import { buildDirectorShareholderDisplayRowForEmailEligibility } from "./application-people-display";
import type { ApplicationPersonRow } from "./application-people-display";
import {
  addCompanyPersonUsesOnboardingFlow,
  isMinimalOnboardingPersonCreate,
  validateOnboardingPersonCreate,
} from "./onboarding-person-create";

const preIdDirector: ApplicationPersonRow = {
  matchKey: "user:550e8400-e29b-41d4-a716-446655440000",
  name: "Pre Id",
  entityType: "INDIVIDUAL",
  roles: ["DIRECTOR"],
  sharePercentage: null,
  status: "",
  action: null,
  screening: null,
  onboarding: { status: null, id: null },
  requestId: null,
  requestIdType: null,
  icFrontUrl: null,
  icBackUrl: null,
  email: "preid@example.com",
};

describe("add company person role flow", () => {
  it("Director only → onboarding flow", () => {
    expect(addCompanyPersonUsesOnboardingFlow({ isDirector: true })).toBe(true);
    expect(isMinimalOnboardingPersonCreate({ isDirector: true })).toBe(true);
  });

  it("Shareholder only → onboarding flow", () => {
    expect(addCompanyPersonUsesOnboardingFlow({ isShareholder: true })).toBe(true);
    expect(isMinimalOnboardingPersonCreate({ isShareholder: true })).toBe(true);
  });

  it("Director + Management Team → onboarding flow", () => {
    expect(
      addCompanyPersonUsesOnboardingFlow({ isDirector: true, isShareholder: false })
    ).toBe(true);
    expect(
      isMinimalOnboardingPersonCreate({ isDirector: true, isManagement: true })
    ).toBe(true);
  });

  it("Shareholder + Board of Director → onboarding flow", () => {
    expect(addCompanyPersonUsesOnboardingFlow({ isShareholder: true })).toBe(true);
    expect(
      isMinimalOnboardingPersonCreate({ isShareholder: true, isBoard: true })
    ).toBe(true);
  });

  it("Director + Shareholder → onboarding flow", () => {
    expect(
      addCompanyPersonUsesOnboardingFlow({ isDirector: true, isShareholder: true })
    ).toBe(true);
    expect(
      isMinimalOnboardingPersonCreate({ isDirector: true, isShareholder: true })
    ).toBe(true);
  });

  it("Board of Director only → manual flow", () => {
    expect(addCompanyPersonUsesOnboardingFlow({})).toBe(false);
    expect(isMinimalOnboardingPersonCreate({ isBoard: true })).toBe(false);
  });

  it("Management Team only → manual flow", () => {
    expect(addCompanyPersonUsesOnboardingFlow({ isDirector: false, isShareholder: false })).toBe(
      false
    );
    expect(isMinimalOnboardingPersonCreate({ isManagement: true })).toBe(false);
  });

  it("Board of Director + Management Team → manual flow", () => {
    expect(isMinimalOnboardingPersonCreate({ isBoard: true, isManagement: true })).toBe(false);
  });

  it("corporate shareholder stays on the manual create path", () => {
    expect(
      addCompanyPersonUsesOnboardingFlow({ entityType: "CORPORATE", isShareholder: true })
    ).toBe(false);
    expect(
      isMinimalOnboardingPersonCreate({ entityType: "CORPORATE", isShareholder: true })
    ).toBe(false);
  });
});

describe("minimal onboarding person create", () => {
  it("detects pre-ID director/shareholder creates", () => {
    expect(
      isMinimalOnboardingPersonCreate({ name: "A", isDirector: true, email: "a@b.test" })
    ).toBe(true);
    expect(
      isMinimalOnboardingPersonCreate({
        name: "A",
        isDirector: true,
        identityNumber: "900101101234",
      })
    ).toBe(false);
    expect(isMinimalOnboardingPersonCreate({ name: "A", isBoard: true })).toBe(false);
  });

  it("requires name and Person Email", () => {
    const issues = validateOnboardingPersonCreate({ isDirector: true });
    expect(issues.some((i) => i.field === "name")).toBe(true);
    expect(issues.some((i) => i.field === "email")).toBe(true);
  });

  it("accepts Director, Shareholder >=5%, and both roles without government ID", () => {
    expect(
      validateOnboardingPersonCreate({
        name: "Ahmad Bin Ali",
        email: "ahmad@example.com",
        isShareholder: false,
      })
    ).toHaveLength(0);
    expect(
      validateOnboardingPersonCreate({
        name: "Ahmad Bin Ali",
        email: "ahmad@example.com",
        isShareholder: true,
        shareholdingPercentage: "25",
      })
    ).toHaveLength(0);
    expect(
      isMinimalOnboardingPersonCreate({
        name: "Ahmad Bin Ali",
        email: "ahmad@example.com",
        isDirector: true,
        isShareholder: true,
      })
    ).toBe(true);
  });

  it("preserves the existing <5% shareholder rejection", () => {
    const issues = validateOnboardingPersonCreate({
      name: "Small Holder",
      email: "small@example.com",
      isShareholder: true,
      shareholdingPercentage: "4",
    });
    expect(issues.some((i) => i.field === "shareholdingPercentage")).toBe(true);
  });
});

describe("pre-ID people display", () => {
  it("does not treat generated party_key as NRIC and still allows Send", () => {
    const row = buildDirectorShareholderDisplayRowForEmailEligibility(preIdDirector, null);
    expect(row.id).toBe(preIdDirector.matchKey);
    expect(row.idNumber).toBeNull();
    expect(row.identityWarning).toBeUndefined();
    expect(row.canSendOnboarding).toBe(true);
    expect(row.ctosIndividualKycEligible).toBe(true);
  });

  it("shows identity_number when present without changing matchKey", () => {
    const row = buildDirectorShareholderDisplayRowForEmailEligibility(
      { ...preIdDirector, identityNumber: "900101101234" },
      null
    );
    expect(row.id).toBe(preIdDirector.matchKey);
    expect(row.idNumber).toBe("900101101234");
  });
});
