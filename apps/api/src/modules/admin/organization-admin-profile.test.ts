import { updateAdminOrganizationProfileSchema } from "./schemas";
import {
  extractMasterProfilePatch,
  mergeCorporateOnboardingData,
  stripMasterOnlyProfileFields,
  summarizeProfilePatch,
} from "./organization-admin-profile";

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

  it("accepts CashSouk master profile fields on the same organization patch", () => {
    const parsed = updateAdminOrganizationProfileSchema.parse({
      name: "Acme Sdn Bhd",
      scCompanyType: "PRIVATE_LIMITED",
      companyCategory: "NON_TECHNOLOGY",
      dateOfIncorporation: "2020-03-12",
    });
    expect(parsed.scCompanyType).toBe("PRIVATE_LIMITED");
  });

  it("rejects unknown companyEmail on the organization patch", () => {
    expect(updateAdminOrganizationProfileSchema.safeParse({ companyEmail: "ops@acme.example" }).success).toBe(
      false
    );
  });

  it("allows an unrelated patch to omit contact email", () => {
    const parsed = updateAdminOrganizationProfileSchema.parse({
      name: "Acme Sdn Bhd",
    });
    expect(parsed.corporateOnboardingData?.contactPerson).toBeUndefined();
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

  it("writes contactPerson without replacing personInCharge evidence", () => {
    const merged = mergeCorporateOnboardingData(
      {
        personInCharge: { name: "RegTank Pic", email: "pic@regtank.test" },
        contactPerson: { name: "Ops", email: "ops@acme.test", contact: "+60111" },
      },
      { contactPerson: { email: "new@acme.test" } }
    );
    expect(merged.personInCharge).toEqual({ name: "RegTank Pic", email: "pic@regtank.test" });
    expect(merged.contactPerson).toEqual({
      name: "Ops",
      email: "new@acme.test",
      contact: "+60111",
    });
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

describe("extractMasterProfilePatch", () => {
  it("routes company-type fields onto the CashSouk master patch", () => {
    const patch = extractMasterProfilePatch({
      name: "Acme Sdn Bhd",
      phoneNumber: "+60123456789",
      scCompanyType: "PRIVATE_LIMITED",
      companyCategory: "NON_TECHNOLOGY",
      dateOfIncorporation: "2020-03-12",
      corporateOnboardingData: {
        website: "https://acme.example",
        addresses: {
          registered: { line1: "1 Jalan Test", state: "Selangor", postalCode: "50000" },
        },
        aboutYourBusiness: { whatDoesCompanyDo: "Makes parts" },
      },
    });
    expect(patch.name).toBe("Acme Sdn Bhd");
    expect(patch.scCompanyType).toBe("PRIVATE_LIMITED");
    expect(patch.registeredAddress).toEqual({
      line1: "1 Jalan Test",
      state: "Selangor",
      postalCode: "50000",
    });
    expect(patch.companyActivities).toBe("Makes parts");
  });

  it("strips master-only keys from the operational organization payload", () => {
    const operational = stripMasterOnlyProfileFields({
      name: "Acme Sdn Bhd",
      scCompanyType: "PRIVATE_LIMITED",
      corporateOnboardingData: { website: "https://acme.example" },
    });
    expect(operational.name).toBe("Acme Sdn Bhd");
    expect(operational.scCompanyType).toBeUndefined();
    expect(operational.corporateOnboardingData?.website).toBe("https://acme.example");
  });
});
