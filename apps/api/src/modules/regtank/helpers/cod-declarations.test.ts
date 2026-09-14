import { isCodTransactionInformationArea, parseRegTankCodDeclarations } from "./cod-declarations";

describe("parseRegTankCodDeclarations", () => {
  it("maps personal Wealth Declaration and Compliance Declarations by display area", () => {
    const parsed = parseRegTankCodDeclarations([
      { displayArea: "Wealth Declaration", content: [{ fieldName: "Source of wealth" }] },
      { displayArea: "Compliance Declarations", content: [{ fieldName: "PEP" }] },
    ]);
    expect(parsed.wealthDeclaration?.displayArea).toBe("Wealth Declaration");
    expect(parsed.complianceDeclaration?.displayArea).toBe("Compliance Declarations");
  });

  it("stores issuer corporate PEP questions from Transaction Information as compliance, not wealth", () => {
    const parsed = parseRegTankCodDeclarations([
      {
        displayArea: "Transaction Information",
        content: [
          {
            fieldName: "Are any of the directors or shareholders classified as a Politically Exposed Person (PEP)?",
            fieldValue: "Yes",
          },
        ],
      },
    ]);
    expect(parsed.wealthDeclaration).toBeNull();
    expect(parsed.complianceDeclaration?.displayArea).toBe("Transaction Information");
    expect(isCodTransactionInformationArea(parsed.complianceDeclaration)).toBe(true);
  });

  it("prefers an explicit Compliance Declarations area over Transaction Information", () => {
    const parsed = parseRegTankCodDeclarations([
      { displayArea: "Transaction Information", content: [{ fieldName: "PEP" }] },
      { displayArea: "Compliance Declarations", content: [{ fieldName: "Named compliance" }] },
    ]);
    expect(parsed.complianceDeclaration?.displayArea).toBe("Compliance Declarations");
  });

  it("keeps Beneficiary Account Information as compliance when that area is present", () => {
    const parsed = parseRegTankCodDeclarations([
      { displayArea: "Beneficiary Account Information", content: [{ fieldName: "Beneficiary" }] },
    ]);
    expect(parsed.wealthDeclaration).toBeNull();
    expect(parsed.complianceDeclaration?.displayArea).toBe("Beneficiary Account Information");
  });
});
