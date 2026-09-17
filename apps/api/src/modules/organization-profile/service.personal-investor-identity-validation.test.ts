import { validatePersonalInvestorIdentityNumberByDocumentType } from "./service";

describe("Personal Investor identityNumber validation by document_type", () => {
  it("accepts NRIC/MyKad exactly 12 digits", () => {
    expect(
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "NATIONAL_ID",
        identityNumber: "800101011234",
      })
    ).toBe("800101011234");
  });

  it("rejects NRIC with wrong length and non-digits", () => {
    expect(() =>
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "NATIONAL_ID",
        identityNumber: "80010101123",
      })
    ).toThrow(/exactly 12 digits/i);

    expect(() =>
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "NATIONAL_ID",
        identityNumber: "800101011234X",
      })
    ).toThrow(/exactly 12 digits/i);

    expect(() =>
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "NATIONAL_ID",
        identityNumber: "800101-01-1234",
      })
    ).toThrow(/exactly 12 digits/i);
  });

  it("treats Driving License as 12 digits digits-only", () => {
    expect(
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "DRIVER_LICENSE",
        identityNumber: "800101011234",
      })
    ).toBe("800101011234");

    expect(
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "DRIVING_LICENSE",
        identityNumber: "800101011234",
      })
    ).toBe("800101011234");

    expect(() =>
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "DRIVER_LICENSE",
        identityNumber: "a0000000000&*",
      })
    ).toThrow(/exactly 12 digits/i);

    expect(() =>
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "DRIVER_LICENSE",
        identityNumber: "80010101123",
      })
    ).toThrow(/exactly 12 digits/i);
  });

  it("keeps existing Passport behavior (trim only, no digits enforcement)", () => {
    expect(
      validatePersonalInvestorIdentityNumberByDocumentType({
        documentType: "PASSPORT",
        identityNumber: "AB-12 34",
      })
    ).toBe("AB-12 34");
  });
});

