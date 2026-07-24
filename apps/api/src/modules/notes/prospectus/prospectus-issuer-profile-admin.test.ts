import {
  buildProspectusIssuerProfile,
  toAdminIssuerProfileRows,
} from "./prospectus-issuer-profile";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-issuer-profile.types";

describe("toAdminIssuerProfileRows", () => {
  it("maps separate Industry and Company Size investor-visible fields", () => {
    const profile = buildProspectusIssuerProfile({
      issuerSnapshot: {
        name: "Hidden Issuer Sdn Bhd",
        registration_number: "201401012345",
        industry: "Construction",
        entity_type: "PRIVATE_LIMITED",
        country: "Malaysia",
        business_description:
          "Hidden Issuer Sdn Bhd — Infrastructure contractor for public works.",
      },
      officerCompanySize: "Medium",
    });

    expect(toAdminIssuerProfileRows(profile)).toEqual([
      { label: "Industry", value: "Construction" },
      { label: "Company Size", value: "Medium" },
      { label: "Registered Country", value: "Registered in Malaysia" },
      {
        label: "Business Description",
        value: "Infrastructure contractor for public works.",
      },
    ]);
  });

  it("uses DNA for missing Company Size on old content", () => {
    const rows = toAdminIssuerProfileRows(
      buildProspectusIssuerProfile({
        issuerSnapshot: { industry: "Manufacturing" },
      })
    );
    expect(rows.find((r) => r.label === "Industry")?.value).toBe("Manufacturing");
    expect(rows.find((r) => r.label === "Company Size")?.value).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(rows.some((r) => r.label === "Industry | Company Size")).toBe(false);
  });
});
