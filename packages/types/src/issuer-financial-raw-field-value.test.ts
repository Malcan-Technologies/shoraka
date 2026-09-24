import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS } from "./financial-field-labels";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "./financial-field-resolution";
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

function issuerNegativeAllowedFromForm(step: string): Set<string> {
  const allowed = new Set<string>();
  for (const match of step.matchAll(/id=\{`\$\{yearKey\}-([A-Za-z0-9_]+)`\}([\s\S]*?)\/>/g)) {
    if (match[2]?.includes("allowNegative")) allowed.add(match[1] ?? "");
  }
  for (const key of APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS) allowed.add(key);
  return allowed;
}

/** Issuer form commit rule: MoneyInput keystroke filter, then blur drops incomplete tokens. */
function issuerFormAcceptsCommittedValue(raw: string, allowNegative: boolean): boolean {
  if (raw.trim() === "") return true;
  const trimmed = raw.trim();
  const charPattern = allowNegative ? /^-?[\d,]*\.?\d{0,2}$/ : /^[\d,]*\.?\d{0,2}$/;
  if (!charPattern.test(trimmed)) return false;
  if ((trimmed.match(/\./g) ?? []).length > 1) return false;
  const numeric = trimmed.replace(/,/g, "");
  if (numeric === "-" || numeric === "." || numeric === "-.") return false;
  const intDigits = numeric.replace(/^-/, "").split(".")[0] ?? "";
  if (intDigits.length > 15) return false;
  const n = Number(numeric);
  if (!Number.isFinite(n)) return false;
  if (n < 0 && !allowNegative) return false;
  return true;
}

const PARITY_SAMPLES = [
  "",
  "0",
  "1",
  "-1",
  "1.2",
  "1.23",
  "1.234",
  "999999999999999",
  "9999999999999999",
  "1,234.56",
  "1e5",
  ".",
  "-",
  "1..2",
  "abc",
] as const;

describe("admin validator matches the issuer form for every raw field", () => {
  const step = readFileSync(
    join(
      repoRoot,
      "apps/issuer/src/app/(application-flow)/applications/steps/financial-statements-step.tsx"
    ),
    "utf8"
  );
  const allowNegative = issuerNegativeAllowedFromForm(step);

  it("uses the issuer form negative-allowed set with no extras and no omissions", () => {
    expect([...allowNegative].sort()).toEqual([...ISSUER_FINANCIAL_NEGATIVE_ALLOWED_KEYS].sort());
  });

  it.each([
    ["bsfatot", "normal non-negative"],
    ["turnover", "turnover"],
    ["curlib_borrowing", "ComRep non-negative"],
    ["plnpat", "negative-allowed P&L"],
    ["equity_accumulated_profit", "negative-allowed equity"],
    ["operatingCashFlow", "negative-allowed cash flow"],
    ["equity_share_application", "optional equity"],
  ] as const)("matches the issuer form for %s (%s)", (fieldKey) => {
    const negative = allowNegative.has(fieldKey);
    expect(issuerFinancialFieldAllowsNegative(fieldKey)).toBe(negative);
    for (const sample of PARITY_SAMPLES) {
      const issuerAccepts = issuerFormAcceptsCommittedValue(sample, negative);
      const adminAccepts = issuerFinancialRawFieldValueError(fieldKey, sample) == null;
      expect(adminAccepts).toBe(issuerAccepts);
    }
  });

  it("matches the issuer form for every admin-editable raw field and sample", () => {
    expect(ADMIN_EDITABLE_RAW_FINANCIAL_KEYS.length).toBeGreaterThan(0);
    for (const fieldKey of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
      const negative = allowNegative.has(fieldKey);
      expect(issuerFinancialFieldAllowsNegative(fieldKey)).toBe(negative);
      for (const sample of PARITY_SAMPLES) {
        const issuerAccepts = issuerFormAcceptsCommittedValue(sample, negative);
        const adminAccepts = issuerFinancialRawFieldValueError(fieldKey, sample) == null;
        expect({ fieldKey, sample, adminAccepts }).toEqual({ fieldKey, sample, adminAccepts: issuerAccepts });
      }
      for (const sample of [0, 1, -1, 1.2, 1.23, 1.234]) {
        const issuerAccepts = issuerFormAcceptsCommittedValue(String(sample), negative);
        const adminAccepts = issuerFinancialRawFieldValueError(fieldKey, sample) == null;
        expect({ fieldKey, sample, adminAccepts }).toEqual({ fieldKey, sample, adminAccepts: issuerAccepts });
      }
    }
  });
});
