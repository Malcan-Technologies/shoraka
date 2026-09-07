import {
  certificatePartyDisplayReference,
  resolveCertificateCompanyRegistration,
} from "./certificate-identity";

describe("certificatePartyDisplayReference", () => {
  const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
  const investorCuid = "cmkm0fc2r00059v8jzc71b39c";

  it("uses the allocated organization display reference", () => {
    expect(certificatePartyDisplayReference("ISS-202608-DK3", issuerCuid)).toBe("ISS-202608-DK3");
    expect(certificatePartyDisplayReference("IVT-202609-A12", investorCuid)).toBe("IVT-202609-A12");
  });

  it("never freezes a Prisma/CUID primary key", () => {
    expect(certificatePartyDisplayReference(null, issuerCuid)).toBe("—");
    expect(certificatePartyDisplayReference("  ", investorCuid)).toBe("—");
    expect(certificatePartyDisplayReference(issuerCuid, issuerCuid)).toBe("—");
    expect(certificatePartyDisplayReference(investorCuid, investorCuid)).toBe("—");
    expect(certificatePartyDisplayReference(null)).toBe("—");
    expect(certificatePartyDisplayReference("ISS-202608-DK3")).toBe("ISS-202608-DK3");
  });

  it("rejects a CUID or UUID even when it is stored as display_reference", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(certificatePartyDisplayReference(issuerCuid, "other-org-id")).toBe("—");
    expect(certificatePartyDisplayReference(uuid, issuerCuid)).toBe("—");
    expect(certificatePartyDisplayReference(uuid)).toBe("—");
    expect(certificatePartyDisplayReference("kyc_cmknlimvf0003grp0hsbmc1dp")).toBe("—");
  });
});

describe("resolveCertificateCompanyRegistration", () => {
  it("prefers frozen issuer_snapshot.registration_number", () => {
    expect(
      resolveCertificateCompanyRegistration({
        issuerSnapshot: { registration_number: "201401012345" },
        issuerOrganization: {
          registration_number: "999999999999",
          corporate_onboarding_data: { basicInfo: { ssmRegistrationNumber: "111111111111" } },
        },
      })
    ).toBe("201401012345");
  });

  it("uses the live org column when the frozen snapshot has no number", () => {
    expect(
      resolveCertificateCompanyRegistration({
        issuerSnapshot: { name: "Toyota", registration_number: null },
        issuerOrganization: { registration_number: "202401054321", corporate_onboarding_data: null },
      })
    ).toBe("202401054321");
  });

  it("uses COD SSM aliases when the org column is empty (Letter of Offer Toyota shape)", () => {
    expect(
      resolveCertificateCompanyRegistration({
        issuerSnapshot: { name: "Toyota" },
        issuerOrganization: {
          registration_number: "",
          corporate_onboarding_data: { basicInfo: { ssmRegistrationNumber: "123412341234" } },
        },
      })
    ).toBe("123412341234");
    expect(
      resolveCertificateCompanyRegistration({
        issuerSnapshot: {},
        issuerOrganization: {
          registration_number: null,
          corporate_onboarding_data: { basicInfo: { ssmRegisterNumber: "555555555555" } },
        },
      })
    ).toBe("555555555555");
  });

  it("returns — when no canonical registration number exists", () => {
    expect(
      resolveCertificateCompanyRegistration({
        issuerSnapshot: { name: "Toyota", registration_number: null },
        issuerOrganization: { registration_number: null, corporate_onboarding_data: { basicInfo: {} } },
      })
    ).toBe("—");
  });

  it("does not treat bank account numbers as company registration", () => {
    expect(
      resolveCertificateCompanyRegistration({
        issuerSnapshot: {
          name: "Toyota",
          registration_number: null,
          bank_account_number: "1234567890",
          account_number: "9876543210",
        },
        issuerOrganization: {
          registration_number: null,
          corporate_onboarding_data: {
            basicInfo: { bankAccountNumber: "111122223333" },
            bankDetails: { accountNumber: "444455556666" },
          },
        },
      })
    ).toBe("—");
  });
});
