import {
  getBankAccountField,
  patchBankAccountDetails,
} from "./bank-account-details";

describe("bank account details helpers", () => {
  it("reads values by canonical name or RegTank alias", () => {
    const details = {
      displayArea: "Bank Account Details",
      content: [
        { cn: false, fieldName: "bankAccountNumber", fieldType: "text", fieldValue: "123456789012", alias: "Bank account number" },
        { cn: false, fieldName: "accountType", fieldType: "picklist", fieldValue: "Savings", alias: "Account type" },
      ],
    };

    expect(getBankAccountField(details, "Bank account number")).toBe("123456789012");
    expect(getBankAccountField(details, "Account type")).toBe("Savings");
  });

  it("patches matching fields in place and keeps extra rows", () => {
    const existing = {
      displayArea: "Bank Account Details",
      content: [
        { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "Affin Bank Berhad", alias: "Bank" },
        { cn: false, fieldName: "bankAccountNumber", fieldType: "text", fieldValue: "111", alias: "Bank account number" },
        { cn: false, fieldName: "swiftCode", fieldType: "text", fieldValue: "PHBMMYKL", alias: "SWIFT" },
      ],
    };

    expect(
      patchBankAccountDetails(existing, {
        bankName: "CIMB Bank Berhad",
        accountNumber: "999988887777",
        accountType: "Checking",
      })
    ).toEqual({
      displayArea: "Bank Account Details",
      content: [
        { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: "CIMB Bank Berhad", alias: "Bank" },
        { cn: false, fieldName: "bankAccountNumber", fieldType: "text", fieldValue: "999988887777", alias: "Bank account number" },
        { cn: false, fieldName: "swiftCode", fieldType: "text", fieldValue: "PHBMMYKL", alias: "SWIFT" },
        { cn: false, fieldName: "Account type", fieldType: "picklist", fieldValue: "Checking" },
      ],
    });
  });
});
