import type { OrganizationDetailResponse } from "@cashsouk/types";
import { buildDraft, buildSectionPayload } from "./organization-profile-payload";

function companyOrg(
  overrides: Partial<OrganizationDetailResponse> = {}
): OrganizationDetailResponse {
  return {
    id: "org-1",
    displayReference: "ISS-1",
    portal: "issuer",
    type: "COMPANY",
    name: "Acme Sdn Bhd",
    registrationNumber: "1234567-A",
    onboardingStatus: "COMPLETED",
    onboardedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: {
      userId: "user-1",
      email: "owner@acme.test",
      firstName: "Ada",
      lastName: "Lovelace",
    },
    firstName: "Ada",
    lastName: "Lovelace",
    middleName: null,
    nationality: null,
    country: null,
    idIssuingCountry: null,
    gender: null,
    address: "1 Jalan Test",
    dateOfBirth: null,
    phoneNumber: "+60123456789",
    documentType: null,
    documentNumber: null,
    kycId: null,
    bankAccountDetails: {
      displayArea: "Bank Account Details",
      content: [
        { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "CIMB Bank Berhad" },
        {
          cn: false,
          fieldName: "Bank account number",
          fieldType: "number",
          fieldValue: "111122223333",
        },
        { cn: false, fieldName: "Account type", fieldType: "picklist", fieldValue: "Savings" },
      ],
    },
    wealthDeclaration: null,
    complianceDeclaration: null,
    documentInfo: null,
    livenessCheckInfo: null,
    kycResponse: null,
    members: [],
    isSophisticatedInvestor: false,
    sophisticatedInvestorReason: null,
    walletBalance: null,
    investedAmount: null,
    approvedFacilityAmount: null,
    activeNotesAmount: null,
    regtankPortalUrl: null,
    regtankRequestId: null,
    codRequestId: null,
    corporateOnboardingData: {
      basicInfo: {
        website: "https://acme.test",
        industry: "Manufacturing",
        entityType: "Sdn Bhd",
        numberOfEmployees: 12,
        annualRevenue: "1000000",
        tinNumber: "TIN-1",
        businessName: "Acme",
      },
      addresses: {
        business: { line1: "1 Business St", city: "KL", country: "MY" },
        registered: { line1: "2 Registered St", city: "KL", country: "MY" },
      },
      personInCharge: {
        name: "Pic Name",
        position: "CFO",
        email: "pic@acme.test",
        contactNumber: "+60999",
      },
    },
    ...overrides,
  } as OrganizationDetailResponse;
}

describe("buildSectionPayload", () => {
  it("sends only company fields when the company card is saved", () => {
    const org = companyOrg();
    const draft = buildDraft(org);
    draft.website = "https://new.acme.test";
    draft.picName = "Should not be sent";

    const payload = buildSectionPayload(org, draft, "company");

    expect(payload).toEqual({
      corporateOnboardingData: {
        website: "https://new.acme.test",
        industry: "Manufacturing",
        entityType: "Sdn Bhd",
        numberOfEmployees: 12,
        annualRevenue: "1000000",
        tinNumber: "TIN-1",
        businessName: "Acme",
      },
    });
    expect(payload.corporateOnboardingData).not.toHaveProperty("personInCharge");
    expect(payload.corporateOnboardingData).not.toHaveProperty("addresses");
  });

  it("sends only person-in-charge fields when the PIC card is saved", () => {
    const org = companyOrg();
    const draft = buildDraft(org);
    draft.picName = "New PIC";
    draft.website = "https://should-not-send.test";

    const payload = buildSectionPayload(org, draft, "pic");

    expect(payload).toEqual({
      corporateOnboardingData: {
        personInCharge: {
          name: "New PIC",
          position: "CFO",
          email: "pic@acme.test",
          contactNumber: "+60999",
        },
      },
    });
  });

  it("sends only contact fields when the contact card is saved", () => {
    const org = companyOrg();
    const draft = buildDraft(org);
    draft.phoneNumber = "+60000";
    draft.firstName = "Ignored";

    expect(buildSectionPayload(org, draft, "contact")).toEqual({
      phoneNumber: "+60000",
    });
  });

  it("sends only bank details when the bank card is saved", () => {
    const org = companyOrg();
    const draft = buildDraft(org);
    draft.bankName = "Maybank / Malayan Banking Berhad";
    draft.accountNumber = "999988887777";
    draft.name = "Ignored Co";

    expect(buildSectionPayload(org, draft, "bank")).toEqual({
      bankAccountDetails: {
        content: [
          { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "Maybank / Malayan Banking Berhad" },
          {
            cn: false,
            fieldName: "Bank account number",
            fieldType: "number",
            fieldValue: "999988887777",
          },
          { cn: false, fieldName: "Account type", fieldType: "picklist", fieldValue: "Savings" },
        ],
        displayArea: "Bank Account Details",
      },
    });
  });

  it("reads RegTank camelCase aliases and patches bank fields in place", () => {
    const org = companyOrg({
      bankAccountDetails: {
        displayArea: "Bank Account Details",
        content: [
          { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "Affin Bank Berhad", alias: "Bank" },
          {
            cn: false,
            fieldName: "bankAccountNumber",
            fieldType: "text",
            fieldValue: "123456789012",
            alias: "Bank account number",
          },
          {
            cn: false,
            fieldName: "accountType",
            fieldType: "picklist",
            fieldValue: "Savings",
            alias: "Account type",
          },
          { cn: false, fieldName: "swiftCode", fieldType: "text", fieldValue: "PHBMMYKL", alias: "SWIFT" },
        ],
      },
    });
    const draft = buildDraft(org);
    expect(draft.accountNumber).toBe("123456789012");
    expect(draft.accountType).toBe("Savings");

    draft.bankName = "CIMB Bank Berhad";
    const payload = buildSectionPayload(org, draft, "bank");

    expect(payload.bankAccountDetails).toEqual({
      displayArea: "Bank Account Details",
      content: [
        { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "CIMB Bank Berhad", alias: "Bank" },
        {
          cn: false,
          fieldName: "bankAccountNumber",
          fieldType: "text",
          fieldValue: "123456789012",
          alias: "Bank account number",
        },
        {
          cn: false,
          fieldName: "accountType",
          fieldType: "picklist",
          fieldValue: "Savings",
          alias: "Account type",
        },
        { cn: false, fieldName: "swiftCode", fieldType: "text", fieldValue: "PHBMMYKL", alias: "SWIFT" },
      ],
    });
  });

  it("does not clear employee count when the draft value is invalid", () => {
    const org = companyOrg();
    const draft = buildDraft(org);
    draft.website = "https://new.acme.test";
    draft.numberOfEmployees = "12x";

    expect(buildSectionPayload(org, draft, "company").corporateOnboardingData?.numberOfEmployees).toBe(12);
  });

  it("sends only about-your-business fields when the about card is saved", () => {
    const org = companyOrg();
    const draft = buildDraft(org);
    draft.whatDoesCompanyDo = "We manufacture equipment.";
    draft.website = "https://should-not-send.test";

    const payload = buildSectionPayload(org, draft, "about");

    expect(payload).toEqual({
      corporateOnboardingData: {
        aboutYourBusiness: {
          whatDoesCompanyDo: "We manufacture equipment.",
          mainCustomers: "",
          singleCustomerOver50Revenue: null,
          accountingSoftware: "",
        },
      },
    });
    expect(payload.corporateOnboardingData).not.toHaveProperty("website");
  });
});
