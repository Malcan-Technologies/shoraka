import { buildProspectusIssuerProfile } from "./prospectus-issuer-profile";
import { SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT } from "./prospectus-issuer-profile.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES,
  PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING,
} from "./prospectus-issuer-profile.types";
import { buildProspectusIssuerProfileDocument } from "./render-prospectus-issuer-profile";

describe("prospectus Page 2 About the Issuer (DATA STAGE 1)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    expect(data.sectionHeading).toBe("ABOUT THE ISSUER");
    expect(data.sectionHeading).toBe(PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING);
  });

  it("maps company name from frozen issuer_snapshot.name only", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: { name: "ABC Engineering Sdn Bhd" },
      liveOrganizationName: "Live Org Name Must Be Ignored",
    });
    expect(data.companyName).toBe("ABC Engineering Sdn Bhd");
  });

  it("returns DNA for missing company name and ignores live org name", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {},
      liveOrganizationName: "Live Org Name Must Be Ignored",
    });
    expect(data.companyName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("maps registration_number as stored and ignores old SSM aliases", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        registration_number: "201401012345",
        old_registration_number: "1101234-X",
        ssm_number: "1101234-X",
      },
      oldRegistrationNumber: "1101234-X",
      liveRegistrationNumber: "999999999999",
    });
    expect(data.registrationNumber).toBe("201401012345");
    expect(data.registrationNumber).not.toContain("(");
    expect(data.registrationNumber).not.toContain("1101234-X");
  });

  it("returns DNA for missing registration and does not combine old SSM", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: { ssm_number: "1101234-X" },
      oldRegistrationNumber: "1101234-X",
    });
    expect(data.registrationNumber).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.registrationNumber).not.toBe("201401012345 (1101234-X)");
  });

  it("maps industry from issuer_snapshot.industry", () => {
    expect(
      buildProspectusIssuerProfile({
        issuerSnapshot: { industry: "Construction" },
      }).industry
    ).toBe("Construction");

    expect(
      buildProspectusIssuerProfile({
        issuerSnapshot: {},
      }).industry
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("keeps company size unresolved and ignores SME inference inputs", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: { name: "ABC Engineering Sdn Bhd", industry: "Construction" },
      employeeCount: 50,
      annualRevenue: 5_000_000,
      smeLabel: "SME",
    });
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.companySize).not.toBe("SME");
  });

  it("formats registered country when frozen country exists", () => {
    expect(
      buildProspectusIssuerProfile({
        issuerSnapshot: { country: "Malaysia" },
      }).registeredCountry
    ).toBe("Registered in Malaysia");
  });

  it("returns DNA for missing country and does not hardcode Malaysia", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: { name: "ABC Engineering Sdn Bhd" },
    });
    expect(data.registeredCountry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.registeredCountry).not.toContain("Registered in Malaysia");
    expect(data.registeredCountry).not.toBe("Registered in Data not available");
  });

  it("maps frozen business_description with trim and no rewrite", () => {
    const text =
      "ABC Engineering Sdn Bhd is a civil and structural engineering company providing construction and maintenance services.";
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        business_description: `  ${text}  `,
      },
    });
    expect(data.businessDescription).toBe(text);
  });

  it("returns DNA for missing business description and ignores live/product fallbacks", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {},
      liveWhatDoesCompanyDo: "Live Application description must be ignored.",
      productSnapshotDescription: "Product description must not replace issuer business description.",
    });
    expect(data.businessDescription).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("remains compatible with old Notes missing new snapshot fields", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        id: "org-old",
        name: "Legacy Issuer Sdn Bhd",
        type: "ISSUER",
        industry: "Manufacturing",
      },
    });
    expect(data.companyName).toBe("Legacy Issuer Sdn Bhd");
    expect(data.industry).toBe("Manufacturing");
    expect(data.registrationNumber).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.registeredCountry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.businessDescription).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("documents canonical sources", () => {
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.companyName.canonicalSource).toBe(
      "notes.issuer_snapshot.name"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.registrationNumber.canonicalSource).toBe(
      "notes.issuer_snapshot.registration_number"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.industry.canonicalSource).toBe(
      "notes.issuer_snapshot.industry"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.companySize.availability).toBe("unresolved");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.registeredCountry.canonicalSource).toBe(
      "notes.issuer_snapshot.country"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.businessDescription.canonicalSource).toBe(
      "notes.issuer_snapshot.business_description"
    );
  });

  it("HTML shows only approved fields and hides audit/extra issuer details", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    const html = buildProspectusIssuerProfileDocument(data);

    expect(html).toContain("ABOUT THE ISSUER");
    expect(html).toContain("Company Name:");
    expect(html).toContain("Registration Number:");
    expect(html).toContain("Industry:");
    expect(html).toContain("Company Size:");
    expect(html).toContain("Registered Country:");
    expect(html).toContain("Business Description:");

    expect(html).toContain("ABC Engineering Sdn Bhd");
    expect(html).toContain("201401012345");
    expect(html).toContain("Construction");
    expect(html).toContain("Registered in Malaysia");
    expect(html).toContain(PROSPECTUS_DATA_NOT_AVAILABLE);

    expect(html).not.toContain("org-sample-issuer");
    expect(html).not.toContain("1101234-X");
    expect(html).not.toContain("employee");
    expect(html).not.toContain("director");
    expect(html).not.toContain("shareholder");
    expect(html).not.toContain("Live Org Name");
    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("inferenceAllowed");
    expect(html).not.toContain("liveFallbackAllowed");
    expect(html).not.toContain("sourceType");
    expect(html).not.toContain("notes.issuer_snapshot");
    expect(html).not.toContain('"audit"');
  });

  it("audit records freeze rules without SME inference or hardcoded country", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    expect(data.audit.companyName.isFrozen).toBe(true);
    expect(data.audit.registrationNumber.oldRegistrationNumberSupported).toBe(false);
    expect(data.audit.companySize.inferenceAllowed).toBe(false);
    expect(data.audit.registeredCountry.hardcodedCountryAllowed).toBe(false);
    expect(data.audit.businessDescription.liveFallbackAllowed).toBe(false);
    expect(data.audit.snapshot.sourceType).toBe("note_creation_snapshot");
  });
});
