import { updateAdminOrganizationProfileSchema } from "./schemas";
import { mergeCorporateOnboardingData, summarizeProfilePatch } from "./organization-admin-profile";

describe("updateAdminOrganizationProfileSchema", () => {
  it("accepts allowed profile fields", () => {
    const parsed = updateAdminOrganizationProfileSchema.parse({
      name: "Acme Sdn Bhd",
      phoneNumber: "+60123456789",
      firstName: "Aisha",
      lastName: "Tan",
      middleName: null,
      corporateOnboardingData: {
        website: "https://acme.example",
        numberOfEmployees: 12,
        personInCharge: { name: "Aisha", email: "pic@acme.example" },
      },
    });
    expect(parsed.name).toBe("Acme Sdn Bhd");
    expect(parsed.corporateOnboardingData?.website).toBe("https://acme.example");
  });

  it("rejects locked identity fields", () => {
    const result = updateAdminOrganizationProfileSchema.safeParse({
      registrationNumber: "1234567-A",
      documentNumber: "900101-14-1234",
      kycId: "kyc-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("mergeCorporateOnboardingData", () => {
  it("preserves existing SSM and only patches provided keys", () => {
    const merged = mergeCorporateOnboardingData(
      {
        basicInfo: { ssmRegisterNumber: "1234567-A", website: "https://old.example" },
        addresses: { business: { city: "KL" } },
      },
      { website: "https://new.example", tinNumber: "C123" }
    );
    const basicInfo = merged.basicInfo as Record<string, unknown>;
    expect(basicInfo.ssmRegisterNumber).toBe("1234567-A");
    expect(basicInfo.website).toBe("https://new.example");
    expect(basicInfo.tinNumber).toBe("C123");
    expect((merged.addresses as Record<string, unknown>).business).toEqual({ city: "KL" });
  });

  it("merges aboutYourBusiness without dropping existing narrative fields", () => {
    const merged = mergeCorporateOnboardingData(
      {
        aboutYourBusiness: {
          whatDoesCompanyDo: "Makes parts",
          mainCustomers: "Miners",
          singleCustomerOver50Revenue: false,
          accountingSoftware: "Xero",
        },
      },
      { aboutYourBusiness: { accountingSoftware: "SAP" } }
    );
    const about = merged.aboutYourBusiness as Record<string, unknown>;
    expect(about.whatDoesCompanyDo).toBe("Makes parts");
    expect(about.mainCustomers).toBe("Miners");
    expect(about.singleCustomerOver50Revenue).toBe(false);
    expect(about.accountingSoftware).toBe("SAP");
  });
});

describe("summarizeProfilePatch", () => {
  it("flags bank changes without including account numbers", () => {
    const summary = summarizeProfilePatch({
      name: "New",
      bankAccountDetails: {
        content: [
          { cn: false, fieldName: "Bank account number", fieldType: "text", fieldValue: "1234567890" },
        ],
        displayArea: "bank",
      },
    });
    expect(summary.updatedFields).toEqual(["name", "bankAccountDetails"]);
    expect(summary.bankFieldsChanged).toBe(true);
  });
});
