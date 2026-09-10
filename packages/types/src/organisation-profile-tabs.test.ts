import {
  isOrganisationProfileTab,
  organisationProfileTabFromSearchParam,
  organisationProfileTabs,
  PROFILE_BANKING_HREF,
  PROFILE_PEOPLE_HREF,
  PROFILE_TAB_PEOPLE,
} from "./organisation-profile-tabs";

describe("organisation profile tabs", () => {
  it("includes People & Access only for company organisations", () => {
    expect(isOrganisationProfileTab("people", true)).toBe(true);
    expect(isOrganisationProfileTab("people", false)).toBe(false);
    expect(organisationProfileTabFromSearchParam("people", false)).toBe("profile");
    expect(organisationProfileTabFromSearchParam("people", true)).toBe(PROFILE_TAB_PEOPLE);
    expect(PROFILE_BANKING_HREF).toBe("/profile?tab=banking");
    expect(PROFILE_PEOPLE_HREF).toBe("/profile?tab=people");
  });

  it("treats issuer as company-only (never a personal-issuer tab set)", () => {
    expect(organisationProfileTabs(true)).toEqual([
      "profile",
      "banking",
      "people",
      "documents",
    ]);
    expect(organisationProfileTabs(false)).not.toContain("people");
  });
});
