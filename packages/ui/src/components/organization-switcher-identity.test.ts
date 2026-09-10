import { organizationSwitcherSecondaryText } from "./organization-switcher-identity";

describe("organizationSwitcherSecondaryText", () => {
  it("puts onboarding status before the display reference", () => {
    expect(
      organizationSwitcherSecondaryText({
        type: "COMPANY",
        displayReference: "ISS-202608-DK3",
        status: "IN_PROGRESS",
      })
    ).toBe("In Progress · ISS-202608-DK3");

    expect(
      organizationSwitcherSecondaryText({
        type: "COMPANY",
        displayReference: "IVT-202608-D7F",
        status: "PENDING",
        regtankStatus: "EXPIRED",
      })
    ).toBe("Expired · IVT-202608-D7F");
  });

  it("keeps status-only captions when no reference is allocated", () => {
    expect(
      organizationSwitcherSecondaryText({
        type: "COMPANY",
        status: "COMPLETED",
      })
    ).toBe("Verified");

    expect(
      organizationSwitcherSecondaryText({
        type: "PERSONAL",
        status: "COMPLETED",
      })
    ).toBe("Verified");
  });

  it("falls back to company/personal type when no status or reference is present", () => {
    expect(organizationSwitcherSecondaryText({ type: "COMPANY" })).toBe("Company");
    expect(organizationSwitcherSecondaryText({ type: "PERSONAL" })).toBe("Personal");
  });
});
