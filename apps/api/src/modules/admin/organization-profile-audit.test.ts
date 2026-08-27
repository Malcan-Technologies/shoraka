import { buildOrganizationProfileAuditEvidence } from "./organization-profile-audit";

describe("buildOrganizationProfileAuditEvidence", () => {
  it("stores previous and next values for changed fields only", () => {
    const evidence = buildOrganizationProfileAuditEvidence({
      previous: {
        name: "Old Co",
        phoneNumber: "+601111",
        firstName: "Ada",
        lastName: "Tan",
        corporateOnboardingData: { basicInfo: { website: "https://old.example", industry: "Retail" } },
      },
      next: {
        name: "New Co",
        phoneNumber: "+601111",
        firstName: "Ada",
        lastName: "Tan",
        corporateOnboardingData: { basicInfo: { website: "https://new.example", industry: "Retail" } },
      },
      corporatePatch: { website: "https://new.example" },
      organizationReference: "ISS-202608-DK3",
    });
    expect(evidence.updatedFields).toEqual(["name", "corporateOnboardingData.website"]);
    expect(evidence.previousValues).toEqual({
      name: "Old Co",
      "corporateOnboardingData.website": "https://old.example",
    });
    expect(evidence.nextValues).toEqual({
      name: "New Co",
      "corporateOnboardingData.website": "https://new.example",
    });
    expect(evidence.organizationReference).toBe("ISS-202608-DK3");
  });

  it("does not dump bank account JSON when only the bank-changed flag is set", () => {
    const evidence = buildOrganizationProfileAuditEvidence({
      previous: { phoneNumber: "+601111" },
      next: { phoneNumber: "+601111" },
      bankFieldsChanged: true,
    });
    expect(evidence.updatedFields).toEqual(["bankAccountDetails"]);
    expect(evidence.previousValues).toEqual({});
    expect(evidence.nextValues).toEqual({});
  });
});
