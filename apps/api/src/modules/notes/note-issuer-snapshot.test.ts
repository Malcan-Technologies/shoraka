import {
  buildNoteIssuerSnapshot,
  resolveBusinessDescriptionFromBusinessDetails,
} from "./note-issuer-snapshot";

describe("note issuer snapshot (Note create freeze for Page 2 Stage 1)", () => {
  it("writes registration_number from IssuerOrganization.registration_number", () => {
    const snapshot = buildNoteIssuerSnapshot({
      organization: {
        id: "org-1",
        name: "ABC Engineering Sdn Bhd",
        type: "ISSUER",
        registration_number: "201401012345",
        country: "Malaysia",
        corporate_onboarding_data: {
          basicInfo: { industry: "Construction", ssmRegistrationNumber: "ignored-alias" },
        },
      },
      businessDetails: {
        about_your_business: {
          what_does_company_do: "Builds bridges and roads for public agencies.",
        },
      },
    });

    expect(snapshot.registration_number).toBe("201401012345");
    expect(snapshot.registration_number).not.toBe("ignored-alias");
  });

  it("writes country from IssuerOrganization.country", () => {
    const snapshot = buildNoteIssuerSnapshot({
      organization: {
        id: "org-1",
        name: "ABC Engineering Sdn Bhd",
        type: "ISSUER",
        registration_number: "201401012345",
        country: " Malaysia ",
        corporate_onboarding_data: {
          addresses: { business: { country: "Singapore" } },
        },
      },
      businessDetails: null,
    });

    expect(snapshot.country).toBe("Malaysia");
  });

  it("writes business_description from Application what_does_company_do", () => {
    expect(
      resolveBusinessDescriptionFromBusinessDetails({
        about_your_business: {
          what_does_company_do: "  Civil engineering firm.  ",
        },
        why_raising_funds: { financing_for: "Working capital" },
      })
    ).toBe("Civil engineering firm.");

    const snapshot = buildNoteIssuerSnapshot({
      organization: {
        id: "org-1",
        name: "ABC Engineering Sdn Bhd",
        type: "ISSUER",
        registration_number: null,
        country: null,
        corporate_onboarding_data: { basicInfo: { industry: "Construction" } },
      },
      businessDetails: {
        about_your_business: {
          what_does_company_do: "ABC Engineering Sdn Bhd is a civil and structural engineering company.",
        },
      },
    });

    expect(snapshot.business_description).toBe(
      "ABC Engineering Sdn Bhd is a civil and structural engineering company."
    );
    expect(snapshot.name).toBe("ABC Engineering Sdn Bhd");
    expect(snapshot.industry).toBe("Construction");
  });

  it("keeps nulls for missing new fields without dropping existing keys", () => {
    const snapshot = buildNoteIssuerSnapshot({
      organization: {
        id: "org-legacy",
        name: "Legacy Issuer",
        type: "ISSUER",
        corporate_onboarding_data: null,
      },
      businessDetails: null,
    });

    expect(snapshot).toEqual({
      id: "org-legacy",
      name: "Legacy Issuer",
      type: "ISSUER",
      industry: null,
      registration_number: null,
      country: null,
      business_description: null,
    });
  });
});
