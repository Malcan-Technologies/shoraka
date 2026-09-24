import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS } from "./financial-field-labels";
import {
  ISSUER_FINANCIAL_NEGATIVE_ALLOWED_KEYS,
  issuerFinancialFieldAllowsNegative,
  issuerFinancialMoneyInputAccepted,
  issuerFinancialNegativeAllowedKeysMatchComrepSubset,
  issuerFinancialRawFieldValueError,
} from "./issuer-financial-raw-field-value";

const repoRoot = join(__dirname, "../../..");

describe("issuer financial raw field value rules", () => {
  it("accepts a positive integer, zero, and a 2-decimal amount", () => {
    expect(issuerFinancialRawFieldValueError("bsfatot", 100)).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", 0)).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", "0")).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", "10.25")).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", "1,000.50")).toBeNull();
  });

  it("treats blank as not a value error", () => {
    expect(issuerFinancialRawFieldValueError("bsfatot", "")).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", "   ")).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", null)).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", undefined)).toBeNull();
  });

  it("rejects a negative on a field the issuer form does not allow", () => {
    expect(issuerFinancialFieldAllowsNegative("bsfatot")).toBe(false);
    expect(issuerFinancialRawFieldValueError("bsfatot", -1)).toBe("Fixed Assets must be 0 or greater");
    expect(issuerFinancialRawFieldValueError("bsfatot", "-1")).toBe("Fixed Assets must be 0 or greater");
    expect(issuerFinancialRawFieldValueError("turnover", -1)).toBe("Turnover must be 0 or greater");
    expect(issuerFinancialRawFieldValueError("costOfSales", -1)).toBe("Cost of Sales must be 0 or greater");
    expect(issuerFinancialRawFieldValueError("curlib_borrowing", "-1")).toBe(
      "Current Borrowings must be 0 or greater"
    );
  });

  it("allows negatives on the issuer allowNegative fields", () => {
    for (const key of ISSUER_FINANCIAL_NEGATIVE_ALLOWED_KEYS) {
      expect(issuerFinancialRawFieldValueError(key, -100)).toBeNull();
      expect(issuerFinancialRawFieldValueError(key, "-100.50")).toBeNull();
    }
    expect(issuerFinancialRawFieldValueError("equity_accumulated_profit", -10)).toBeNull();
    expect(issuerFinancialRawFieldValueError("pl_minority", -2)).toBeNull();
    expect(issuerFinancialRawFieldValueError("plnpat", -100)).toBeNull();
    expect(issuerFinancialRawFieldValueError("operatingCashFlow", -5)).toBeNull();
  });

  it("rejects more than 2 decimal places, scientific notation, and malformed input", () => {
    expect(issuerFinancialRawFieldValueError("bsfatot", "10.256")).toBe("Maximum 2 decimal places.");
    expect(issuerFinancialRawFieldValueError("bsfatot", 10.256)).toBe("Maximum 2 decimal places.");
    expect(issuerFinancialRawFieldValueError("plnpat", "-1.234")).toBe("Maximum 2 decimal places.");
    expect(issuerFinancialRawFieldValueError("bsfatot", "1e2")).toBe("Enter a valid amount");
    expect(issuerFinancialRawFieldValueError("bsfatot", "abc")).toBe("Enter a valid amount");
    expect(issuerFinancialRawFieldValueError("bsfatot", "-")).toBe("Enter a valid amount");
    expect(issuerFinancialRawFieldValueError("bsfatot", ".")).toBe("Enter a valid amount");
    expect(issuerFinancialRawFieldValueError("bsfatot", Number.NaN)).toBe("Enter a valid amount");
  });

  it("rejects more than 15 integer digits and has no separate min/max amount", () => {
    expect(issuerFinancialRawFieldValueError("bsfatot", "123456789012345")).toBeNull();
    expect(issuerFinancialRawFieldValueError("bsfatot", "1234567890123456")).toBe("Enter a valid amount");
    expect(issuerFinancialMoneyInputAccepted("bsfatot", "1.23")).toBe(true);
    expect(issuerFinancialMoneyInputAccepted("bsfatot", "-1")).toBe(false);
    expect(issuerFinancialMoneyInputAccepted("plnpat", "-1.23")).toBe(true);
    expect(issuerFinancialMoneyInputAccepted("bsfatot", "1.234")).toBe(false);
  });

  it("keeps the comrep negative allow-list as a subset of the issuer form allow-list", () => {
    expect(issuerFinancialNegativeAllowedKeysMatchComrepSubset()).toBe(true);
    for (const key of APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS) {
      expect(ISSUER_FINANCIAL_NEGATIVE_ALLOWED_KEYS).toContain(key);
    }
  });
});

describe("issuer form still owns the same negative and decimal rules", () => {
  const step = readFileSync(
    join(
      repoRoot,
      "apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx"
    ),
    "utf8"
  );
  const moneyInput = readFileSync(
    join(repoRoot, "packages/ui/src/components/money-input.tsx"),
    "utf8"
  );

  it("matches MoneyFieldRow allowNegative usage in the issuer step", () => {
    const explicit = [...step.matchAll(/id=\{`\$\{yearKey\}-([A-Za-z0-9_]+)`\}([\s\S]*?)(?:\/>)/g)]
      .filter((match) => match[2]?.includes("allowNegative"))
      .map((match) => match[1]);
    expect(explicit.sort()).toEqual(
      [
        "ebitda",
        "freeCashFlow",
        "grossProfit",
        "netOperatingIncome",
        "operatingCashFlow",
        "pl_minority",
        "plnpat",
        "plnpbt",
        "plyear",
      ].sort()
    );
    expect(step).toContain("APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS");
    expect(step).toContain('money.turnover = "Turnover must be 0 or greater"');
  });

  it("keeps MoneyInput at 2 decimal places and 15 integer digits", () => {
    expect(moneyInput).toContain("\\d{0,2}");
    expect(moneyInput).toContain("maxIntDigits = 15");
  });
});
