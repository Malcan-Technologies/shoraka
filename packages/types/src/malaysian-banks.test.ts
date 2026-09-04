import { MALAYSIAN_BANKS, malaysianBankLabel, malaysianBankSwift } from "./malaysian-banks";

const SWIFT_RE = /^[A-Z]{4}MY[A-Z0-9]{2}$/;

describe("malaysianBankSwift", () => {
  it("keeps picklist values and labels unique so exact match cannot collide", () => {
    const values = MALAYSIAN_BANKS.map((bank) => bank.value);
    const labels = MALAYSIAN_BANKS.map((bank) => bank.label);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("maps every picklist bank to an 8-character Malaysia BIC", () => {
    for (const bank of MALAYSIAN_BANKS) {
      expect(bank.swift).toMatch(SWIFT_RE);
      expect(malaysianBankSwift(bank.value)).toBe(bank.swift);
      expect(malaysianBankSwift(bank.label)).toBe(bank.swift);
      expect(malaysianBankSwift(` ${bank.value} `)).toBe(bank.swift);
    }
  });

  it("does not guess from a similar or partial name", () => {
    expect(malaysianBankSwift("Maybank Islamic Berhad")).toBe("");
    expect(malaysianBankSwift("Bank Islam Malaysia")).toBe("");
    expect(malaysianBankSwift("Bank")).toBe("");
    expect(malaysianBankSwift("")).toBe("");
    expect(malaysianBankSwift("Unknown Credit Union")).toBe("");
  });
});

describe("malaysianBankLabel", () => {
  it("returns the short label for a picklist value", () => {
    expect(malaysianBankLabel("CIMB Bank Berhad")).toBe("CIMB Bank");
    expect(malaysianBankLabel("Some Other Bank")).toBe("Some Other Bank");
  });
});
