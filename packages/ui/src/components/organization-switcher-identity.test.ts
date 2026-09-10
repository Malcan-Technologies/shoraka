import { organizationSwitcherSecondaryText } from "./organization-switcher-identity";

describe("organizationSwitcherSecondaryText", () => {
  it("joins display reference and onboarding status without using the company name", () => {
    expect(
      organizationSwitcherSecondaryText({
        type: "COMPANY",
        displayReference: "ISS-202608-DK3",
        status: "IN_PROGRESS",
      })
    ).toBe("ISS-202608-DK3 · In Progress");

    expect(
      organizationSwitcherSecondaryText({
        type: "COMPANY",
        displayReference: "IVT-202608-D7F",
        status: "PENDING",
        regtankStatus: "EXPIRED",
      })
    ).toBe("IVT-202608-D7F · Expired");
  });

  it("falls back to company/personal type when no reference is present", () => {
    expect(organizationSwitcherSecondaryText({ type: "COMPANY" })).toBe("Company");
    expect(organizationSwitcherSecondaryText({ type: "PERSONAL" })).toBe("Personal");
  });
});
