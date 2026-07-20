import { PROSPECTUS_COMPANY_SIZE_VALUES } from "@cashsouk/types";
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
    expect(data).not.toHaveProperty("industryAndCompanySize");
    expect(data.industry).toBe("Construction");
    expect(data.companySize).toBe("Medium");
  });

  it("accepts all four officer Company Size values as separate field", () => {
    for (const size of PROSPECTUS_COMPANY_SIZE_VALUES) {
      const data = buildProspectusIssuerProfile({
        issuerSnapshot: { industry: "Construction" },
        officerCompanySize: size,
      });
      expect(data.companySize).toBe(size);
      expect(data.industry).toBe("Construction");
      expect(`${data.industry} | ${data.companySize}`).not.toBe(data.industry);
    }
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
    expect(withOfficer.industry).toBe("Construction");

    const emptyOfficer = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: null,
      smeLabel: "SME",
    });
    expect(emptyOfficer.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(emptyOfficer.industry).toBe("Construction");
  });

  it("rejects unknown officer Company Size values", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: { industry: "Construction" },
      officerCompanySize: "SME",
    });
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.industry).toBe("Construction");
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

  it("remains compatible with old Notes missing Company Size", () => {
    const data = buildProspectusIssuerProfile({
      issuerSnapshot: {
        id: "org-old",
        name: "Legacy Issuer Sdn Bhd",
        type: "ISSUER",
        industry: "Manufacturing",
      },
    });
    expect(data.industry).toBe("Manufacturing");
    expect(data.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.registeredCountry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.businessDescription).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("documents canonical non-identifying sources", () => {
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.industry.canonicalSource).toBe(
      "notes.issuer_snapshot.industry"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.companySize.canonicalSource).toBe(
      "prospectus_review.page2.issuerProfile.companySize"
    );
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES.entityType.availability).toBe("hidden");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("industryAndCompanySize");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("companyName");
    expect(PROSPECTUS_ISSUER_PROFILE_FIELD_SOURCES).not.toHaveProperty("registrationNumber");
  });

  it("HTML shows separate Industry and Company Size fields", () => {
    const data = buildProspectusIssuerProfile({
      ...SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT,
      officerCompanySize: "Medium",
    });
    const html = buildProspectusIssuerProfileDocument(data);

    expect(html).toContain("ABOUT THE ISSUER");
    expect(html).toContain("<strong>Industry</strong>");
    expect(html).toContain("<strong>Company Size</strong>");
    expect(html).toContain("Construction");
    expect(html).toContain("Medium");
    expect(html).not.toContain("Construction | Medium");
    expect(html).toContain("Registered in Malaysia");
    expect(html).toContain("civil and structural engineering company");

    expect(html).not.toContain("Entity Type:");
    expect(html).not.toContain("Company Name:");
    expect(html).not.toContain("Registration Number:");
    expect(html).not.toContain("ABC Engineering Sdn Bhd");
  });

  it("audit records identity hidden and officer Company Size source", () => {
    const data = buildProspectusIssuerProfile(SAMPLE_PROSPECTUS_ISSUER_PROFILE_INPUT);
    expect(data.audit.identityHidden.companyNameHidden).toBe(true);
    expect(data.audit.companySize.isOfficerContent).toBe(true);
    expect(data.audit.companySize.requiredForApproval).toBe(true);
    expect(data.audit.companySize.inferenceAllowed).toBe(false);
  });
});
