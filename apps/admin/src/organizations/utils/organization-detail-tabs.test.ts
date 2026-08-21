import {
  isOrgDetailTabId,
  isOrgPeopleTabAvailable,
  organizationTabStatus,
} from "./organization-detail-tabs";

describe("isOrgDetailTabId", () => {
  it("accepts organization, people, linked-records, acceptances, and activity", () => {
    expect(isOrgDetailTabId("organization")).toBe(true);
    expect(isOrgDetailTabId("people")).toBe(true);
    expect(isOrgDetailTabId("linked-records")).toBe(true);
    expect(isOrgDetailTabId("acceptances")).toBe(true);
    expect(isOrgDetailTabId("activity")).toBe(true);
  });

  it("rejects unknown tab ids", () => {
    expect(isOrgDetailTabId("members")).toBe(false);
    expect(isOrgDetailTabId("")).toBe(false);
  });
});

describe("isOrgPeopleTabAvailable", () => {
  it("is only available for company organisations", () => {
    expect(isOrgPeopleTabAvailable("COMPANY")).toBe(true);
    expect(isOrgPeopleTabAvailable("PERSONAL")).toBe(false);
    expect(isOrgPeopleTabAvailable(undefined)).toBe(false);
  });
});

describe("organizationTabStatus", () => {
  it("maps completed onboarding to the Onboarded success token", () => {
    const result = organizationTabStatus("COMPLETED");
    expect(result.statusToken).toBe("success");
    expect(result.statusLabel).toBe("Done");
  });
});
