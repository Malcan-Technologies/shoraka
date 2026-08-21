import { resolveIssuerFacilityLink } from "./facility-tied";

describe("resolveIssuerFacilityLink", () => {
  it("returns null when the invoice or note is not under a facility", () => {
    expect(resolveIssuerFacilityLink({ contractId: null })).toBeNull();
    expect(resolveIssuerFacilityLink({ contractId: "   " })).toBeNull();
  });

  it("links to the facility detail page with the canonical reference", () => {
    expect(
      resolveIssuerFacilityLink({
        contractId: "con_1",
        displayReference: "CON-ARF-202608-LD1",
      })
    ).toEqual({
      href: "/financing/contracts/con_1",
      label: "CON-ARF-202608-LD1",
    });
  });
});
