import {
  describePaymasterMismatch,
  isMalaysianSsmNumber,
  namesDiffer,
  normalizeRegistrationNumber,
  parseSubmittedIdentity,
} from "./identity";

describe("paymaster identity", () => {
  it("normalizes SSM to digits and accepts 12-digit Malaysian numbers", () => {
    expect(normalizeRegistrationNumber("2022-01234567")).toBe("202201234567");
    expect(isMalaysianSsmNumber("202201234567")).toBe(true);
    expect(isMalaysianSsmNumber("123")).toBe(false);
  });

  it("does not treat name as identity", () => {
    expect(namesDiffer("Petronas", "PETRONAS")).toBe(false);
    expect(namesDiffer("Petronas", "Other Co")).toBe(true);
  });

  it("parses submitted identity from customer details", () => {
    const parsed = parseSubmittedIdentity({
      name: "Acme Sdn Bhd",
      ssm_number: "202201234567",
      country: "MY",
      entity_type: "Company",
    });
    expect(parsed?.registrationNumber).toBe("202201234567");
  });

  it("flags descriptive mismatch without treating it as a new identity", () => {
    const mismatch = describePaymasterMismatch(
      {
        legal_name: "Acme Sdn Bhd",
        entity_type: "Company",
        registration_country: "MY",
      },
      {
        legalName: "Acme Trading",
        registrationNumber: "202201234567",
        registrationCountry: "SG",
        entityType: "LLP",
      }
    );
    expect(mismatch).toEqual({ name: true, entityType: true, country: true });
  });
});
