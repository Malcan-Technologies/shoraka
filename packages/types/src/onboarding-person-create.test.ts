import { buildDirectorShareholderDisplayRowForEmailEligibility } from "./application-people-display";
import type { ApplicationPersonRow } from "./application-people-display";
import {
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
