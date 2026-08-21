import { isUserAccountTabId, userAccountTabStatus, userOrganizationsTabStatus } from "./user-account-tabs";

describe("isUserAccountTabId", () => {
  it("accepts account and organizations", () => {
    expect(isUserAccountTabId("account")).toBe(true);
    expect(isUserAccountTabId("organizations")).toBe(true);
  });

  it("rejects unknown tab ids", () => {
    expect(isUserAccountTabId("profile")).toBe(false);
    expect(isUserAccountTabId("")).toBe(false);
  });
});

describe("userAccountTabStatus", () => {
  it("marks unverified email as action and verified as success", () => {
    expect(userAccountTabStatus(false)).toEqual({
      statusToken: "action",
      statusLabel: "Needs action",
    });
    expect(userAccountTabStatus(true)).toEqual({
      statusToken: "success",
      statusLabel: "Done",
    });
  });
});

describe("userOrganizationsTabStatus", () => {
  it("uses action when any organization needs admin review", () => {
    expect(
      userOrganizationsTabStatus([
        { onboardingStatus: "COMPLETED" },
        { onboardingStatus: "PENDING_APPROVAL" },
      ]).statusToken
    ).toBe("action");
  });

  it("returns neutral when the user has no organizations", () => {
    expect(userOrganizationsTabStatus([])).toEqual({
      statusToken: "neutral",
      statusLabel: "Not started",
    });
  });
});
