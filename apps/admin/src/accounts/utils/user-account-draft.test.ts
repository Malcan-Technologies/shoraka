import type { UserDetailResponse } from "@cashsouk/types";
import {
  buildOnboardingPayload,
  buildUserAccountDraft,
  hasOnboardingChanges,
  hasProfileChanges,
  isValidUserId,
  normalizeUserId,
  sectionHasChanges,
  userIdValidationMessage,
} from "./user-account-draft";

const user: UserDetailResponse = {
  user_id: "ABCDE",
  email: "ada@example.com",
  email_verified: true,
  cognito_sub: "sub-1",
  cognito_username: "ada",
  roles: ["INVESTOR"],
  first_name: "Ada",
  last_name: "Lovelace",
  phone: "+60123456789",
  investor_account: ["onboarded"],
  issuer_account: [],
  password_changed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  stats: {
    accessLogs: 1,
    investments: 2,
    loans: 0,
    investorOrganizations: 1,
    issuerOrganizations: 0,
  },
  organizations: { investor: [], issuer: [] },
};

describe("buildUserAccountDraft", () => {
  it("maps profile fields and onboarding flags from account arrays", () => {
    expect(buildUserAccountDraft(user)).toEqual({
      userId: "ABCDE",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+60123456789",
      investorOnboarded: true,
      issuerOnboarded: false,
    });
  });
});

describe("user ID helpers", () => {
  it("normalizes and validates a 5-letter id", () => {
    expect(normalizeUserId(" ab1 ")).toBe("AB1");
    expect(isValidUserId("abcde")).toBe(true);
    expect(isValidUserId("ABCD")).toBe(false);
    expect(userIdValidationMessage("ABCD")).toBe("User ID must be exactly 5 uppercase letters.");
    expect(userIdValidationMessage("abcde")).toBeNull();
  });
});

describe("section change detection", () => {
  const original = buildUserAccountDraft(user);

  it("detects profile and onboarding changes independently", () => {
    expect(hasProfileChanges({ ...original, firstName: "Grace" }, original)).toBe(true);
    expect(hasOnboardingChanges({ ...original, issuerOnboarded: true }, original)).toBe(true);
    expect(sectionHasChanges("profile", { ...original, phone: "+1" }, original)).toBe(true);
    expect(sectionHasChanges("onboarding", original, original)).toBe(false);
  });

  it("only includes changed onboarding flags in the payload", () => {
    expect(
      buildOnboardingPayload({ ...original, issuerOnboarded: true }, original)
    ).toEqual({
      investorOnboarded: undefined,
      issuerOnboarded: true,
    });
  });
});
