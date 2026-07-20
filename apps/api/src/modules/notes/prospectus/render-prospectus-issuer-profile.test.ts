import {
  PROSPECTUS_COMPANY_SIZE_VALUES,
  formatProspectusIndustryAndCompanySizeDisplay,
} from "@cashsouk/types";
import {
  buildProspectusIssuerProfile,
  formatProspectusIndustryAndCompanySize,
  sanitizeProspectusBusinessDescription,
} from "./prospectus-issuer-profile";
import { SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT } from "./prospectus-issuer-profile.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES,
  PROSPECTUS_ISSUER_PROFILE_INDUSTRY_SIZE_LABEL,
  PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING,
} from "./prospectus-issuer-profile.types";
import { buildProspectusIssuerProfileDocument } from "./render-prospectus-issuer-profile";

describe("prospectus Page 2 About the Issuer (DATA STAGE 1)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    expect(data.sectionHeading).toBe("ABOUT THE ISSUER");
    expect(data.sectionHeading).toBe(PROSPECTUS_ISSUER_PROFILE_SECTION_HEADING);
  });

  it("does not expose company name, registration number, or entity type fields", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        name: "ABC Engineering Sdn Bhd",
        registration_number: "201401012345",
        industry: "Construction",
        entity_type: "PRIVATE_LIMITED",
      },
      officerCompanySize: "Medium",
      liveOrganizationName: "Live Org Name Must Be Ignored",
      liveRegistrationNumber: "999999999999",
      oldRegistrationNumber: "1101234-X",
    });
    expect(data).not.toHaveProperty("companyName");
    expect(data).not.toHaveProperty("registrationNumber");
    expect(data).not.toHaveProperty("entityType");
    expect(data.industry).toBe("Construction");
    expect(data.industryAndCompanySize).toBe("Construction | Medium");
  });

  it("accepts all four officer Company Size values", () => {
    for (const size of PROSPECTUS_COMPANY_SIZE_VALUES) {
      expect(
        buildProspectusIssuerProfile({
          issuerSnapshot: { industry: "Construction" },
          officerCompanySize: size,
        }).companySize
      ).toBe(size);
    }
  });

  it("combines industry and company size with partial and empty rules", () => {
    expect(formatProspectusIndustryAndCompanySize("Construction", "SME")).toBe(
      "Construction | SME"
    );
    expect(formatProspectusIndustryAndCompanySizeDisplay("Construction", "Medium")).toBe(
      "Construction | Medium"
    );
    expect(formatProspectusIndustryAndCompanySize("Construction", null)).toBe("Construction");
    expect(formatProspectusIndustryAndCompanySize(null, "Medium")).toBe("Medium");
    expect(formatProspectusIndustryAndCompanySize(null, null)).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      formatProspectusIndustryAndCompanySize(
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE
      )
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("uses officer Company Size and ignores org/SME inference inputs", () => {
    const withOfficer = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: "Small",
      employeeCount: 50,
      annualRevenue: 5_000_000,
      smeLabel: "SME",
    });
    expect(withOfficer.companySize).toBe("Small");
    expect(withOfficer.industryAndCompanySize).toBe("Construction | Small");

    const emptyOfficer = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: null,
      smeLabel: "SME",
    });
    expect(emptyOfficer.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(emptyOfficer.industryAndCompanySize).toBe("Construction");
  });

  it("shows Company Size only when industry is missing", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {},
      officerCompanySize: "Large",
    });
    expect(data.industryAndCompanySize).toBe("Large");
  });

  it("rejects unknown officer Company Size values", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: "SME",
    });
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.industryAndCompanySize).toBe("Construction");
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
    expect(data.industryAndCompanySize).toBe("Manufacturing");
    expect(data.registeredCountry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.businessDescription).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("documents canonical non-identifying sources", () => {
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.industry.canonicalSource).toBe(
      "notes.issuer_snapshot.industry"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.companySize.canonicalSource).toBe(
      "prospectus_review.page2.issuerProfile.companySize"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.entityType.availability).toBe("hidden");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.industryAndCompanySize.label).toBe(
      PROSPECTUS_ISSUER_PROFILE_INDUSTRY_SIZE_LABEL
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("companyName");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("registrationNumber");
  });

  it("HTML shows non-identifying Canva fields only", () => {
    const data = buildProspectusIssuerProfile({
      ...SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT,
      officerCompanySize: "Medium",
    });
    const html = buildProspectusIssuerProfileDocument(data);

    expect(html).toContain("ABOUT THE ISSUER");
    expect(html).toContain('class="icon icon-issuer"');
    expect(html).toContain("Construction | Medium");
    expect(html).toContain("Registered in Malaysia");
    expect(html).toContain("civil and structural engineering company");

    expect(html).not.toContain("Entity Type:");
    expect(html).not.toContain("PRIVATE_LIMITED");
    expect(html).not.toContain("Company Name:");
    expect(html).not.toContain("Registration Number:");
    expect(html).not.toContain("201401012345");
    expect(html).not.toContain("1101234-X");
    expect(html).not.toContain("Live Org Name");
    expect(html).not.toContain("ABC Engineering Sdn Bhd");
    expect(html).not.toContain('"audit"');
  });

  it("audit records identity hidden and officer Company Size source", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    expect(data.audit.identityHidden.companyNameHidden).toBe(true);
    expect(data.audit.identityHidden.registrationNumberHidden).toBe(true);
    expect(data.audit.identityHidden.entityTypeHidden).toBe(true);
    expect(data.audit.companySize.isOfficerContent).toBe(true);
    expect(data.audit.companySize.inferenceAllowed).toBe(false);
    expect(data.audit.registeredCountry.hardcodedCountryAllowed).toBe(false);
    expect(data.audit.businessDescription.liveFallbackAllowed).toBe(false);
    expect(data.audit.snapshot.sourceType).toBe("note_creation_snapshot");
  });
});
