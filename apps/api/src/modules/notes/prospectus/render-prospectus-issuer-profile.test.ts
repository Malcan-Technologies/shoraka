import {
  buildProspectusIssuerProfile,
  sanitizeProspectusBusinessDescription,
} from "./prospectus-issuer-profile";
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

  it("does not expose company name or registration number fields", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        name: "ABC Engineering Sdn Bhd",
        registration_number: "201401012345",
        industry: "Construction",
      },
      liveOrganizationName: "Live Org Name Must Be Ignored",
      liveRegistrationNumber: "999999999999",
      oldRegistrationNumber: "1101234-X",
    });
    expect(data).not.toHaveProperty("companyName");
    expect(data).not.toHaveProperty("registrationNumber");
    expect(data.industry).toBe("Construction");
  });

  it("maps industry and optional entity type from frozen snapshot", () => {
    expect(
      buildProspectusIssuerProfile({
        issuerSnapshot: { industry: "Construction", entity_type: "PRIVATE_LIMITED" },
      }).entityType
    ).toBe("PRIVATE_LIMITED");

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

  it("strips leading issuer name from business description", () => {
    expect(
      sanitizeProspectusBusinessDescription(
        "ABC Engineering Sdn Bhd — Civil engineering works.",
        "ABC Engineering Sdn Bhd"
      )
    ).toBe("Civil engineering works.");

    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        name: "ABC Engineering Sdn Bhd",
        business_description: "ABC Engineering Sdn Bhd — Civil engineering works.",
      },
    });
    expect(data.businessDescription).toBe("Civil engineering works.");
    expect(data.businessDescription).not.toContain("ABC Engineering Sdn Bhd");
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
    expect(data.industry).toBe("Manufacturing");
    expect(data.entityType).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.registeredCountry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.businessDescription).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("documents canonical non-identifying sources", () => {
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.industry.canonicalSource).toBe(
      "notes.issuer_snapshot.industry"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.entityType.canonicalSource).toBe(
      "notes.issuer_snapshot.entity_type"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.companySize.availability).toBe("unresolved");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("companyName");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("registrationNumber");
  });

  it("HTML shows non-identifying fields only", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    const html = buildProspectusIssuerProfileDocument(data);

    expect(html).toContain("ABOUT THE ISSUER");
    expect(html).toContain("Industry:");
    expect(html).toContain("Entity Type:");
    expect(html).toContain("Company Size:");
    expect(html).toContain("Registered Country:");
    expect(html).toContain("Business Description:");

    expect(html).not.toContain("Company Name:");
    expect(html).not.toContain("Registration Number:");
    expect(html).not.toContain("201401012345");
    expect(html).not.toContain("1101234-X");
    expect(html).not.toContain("Live Org Name");
    expect(html).not.toContain('"audit"');
  });

  it("audit records identity hidden and freeze rules", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    expect(data.audit.identityHidden.companyNameHidden).toBe(true);
    expect(data.audit.identityHidden.registrationNumberHidden).toBe(true);
    expect(data.audit.companySize.inferenceAllowed).toBe(false);
    expect(data.audit.registeredCountry.hardcodedCountryAllowed).toBe(false);
    expect(data.audit.businessDescription.liveFallbackAllowed).toBe(false);
    expect(data.audit.snapshot.sourceType).toBe("note_creation_snapshot");
  });
});
