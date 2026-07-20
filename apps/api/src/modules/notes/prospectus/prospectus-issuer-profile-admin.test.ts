/**
 * SECTION: Admin Issuer Profile mapping from Page 2 Stage 1 builder
 * WHY: Admin must show investor-visible values only — no local recalculation
 */

import {
  buildProspectusIssuerProfile,
  toAdminIssuerProfileRows,
} from "./prospectus-issuer-profile";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-issuer-profile.types";

describe("toAdminIssuerProfileRows", () => {
  it("maps investor-visible fields with shared formatting and DNA tokens", () => {
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
      liveOrganizationName: "Live Org Must Be Ignored",
      liveRegistrationNumber: "999999999999",
    });

    const rows = toAdminIssuerProfileRows(profile);

    expect(rows).toEqual([
      { label: "Industry", value: "Construction" },
      { label: "Entity Type", value: "PRIVATE_LIMITED" },
      { label: "Company Size", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "Registered Country", value: "Registered in Malaysia" },
      {
        label: "Business Description",
        value: "Infrastructure contractor for public works.",
      },
    ]);
    expect(rows.some((r) => r.value.includes("Hidden Issuer"))).toBe(false);
    expect(rows.some((r) => r.value.includes("201401012345"))).toBe(false);
    expect(rows.some((r) => r.label.toLowerCase().includes("name"))).toBe(false);
    expect(rows.some((r) => r.label.toLowerCase().includes("registration"))).toBe(false);
  });

  it("uses DNA for missing optional fields and never falls back to live org data", () => {
    const rows = toAdminIssuerProfileRows(
      buildProspectusIssuerProfile({
        issuerSnapshot: { industry: "Manufacturing" },
        liveWhatDoesCompanyDo: "Must not appear",
        productSnapshotDescription: "Must not appear",
        smeLabel: "SME",
      })
    );

    expect(rows.find((r) => r.label === "Industry")?.value).toBe("Manufacturing");
    expect(rows.find((r) => r.label === "Entity Type")?.value).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(rows.find((r) => r.label === "Company Size")?.value).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(rows.find((r) => r.label === "Registered Country")?.value).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(rows.find((r) => r.label === "Business Description")?.value).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(rows.some((r) => r.value === "SME")).toBe(false);
    expect(rows.some((r) => r.value.includes("Must not appear"))).toBe(false);
  });
});
