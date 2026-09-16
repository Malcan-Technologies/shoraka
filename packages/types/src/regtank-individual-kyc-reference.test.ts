import { isIndividualKycReference } from "./regtank-individual-kyc-reference";

describe("isIndividualKycReference", () => {
  it("accepts KYC... and normalizes case", () => {
    expect(isIndividualKycReference("KYC1001")).toBe(true);
    expect(isIndividualKycReference("kYc1001")).toBe(true);
  });

  it("accepts DJKYC... and normalizes case", () => {
    expect(isIndividualKycReference("DJKYC08238")).toBe(true);
    expect(isIndividualKycReference("djkYC08238")).toBe(true);
  });

  it("rejects unrelated, empty, or non-string values", () => {
    expect(isIndividualKycReference(null)).toBe(false);
    expect(isIndividualKycReference(undefined)).toBe(false);
    expect(isIndividualKycReference("")).toBe(false);
    expect(isIndividualKycReference(" KYB001 ")).toBe(false);
    expect(isIndividualKycReference("COD123")).toBe(false);
    expect(isIndividualKycReference(123)).toBe(false);
  });
});

