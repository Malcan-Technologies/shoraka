import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "financial-statements-step.tsx"), "utf8");

const EXISTING_APPLICATION_FIELDS = [
  "pldd",
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "curlib",
  "bsslltd",
  "bsclstd",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
] as const;

const COMREP_ONLY_FIELDS = [
  "curlib_borrowing",
  "curlib_non_borrowing",
  "ncl_loan",
  "ncl_non_loan",
  "equity_share_application",
  "equity_share_premium",
  "equity_accumulated_profit",
  "equity_minority",
  "operating_cost",
  "admin_cost",
  "interest_cost",
  "other_cost",
  "pl_minority",
] as const;

describe("issuer application Financial Statements step", () => {
  it("keeps every existing application financial field", () => {
    for (const key of EXISTING_APPLICATION_FIELDS) {
      expect(source).toContain(`${key}:`);
      expect(source).toContain(`"${key}"`);
    }
    expect(source).toContain("YEAR_MONEY_FIELDS");
    expect(source).toContain("[...APPLICATION_CORE_MONEY_KEYS]");
  });

  it("adds ComRep-only fields in a separate Additional Financial Details section", () => {
    expect(source).toContain("Additional Financial Details");
    expect(source).toContain("For regulatory reporting");
    expect(source.indexOf("Profit and Loss")).toBeLessThan(source.indexOf("Additional Financial Details"));
    for (const key of COMREP_ONLY_FIELDS) {
      expect(source).toContain(`"${key}"`);
      expect(EXISTING_APPLICATION_FIELDS).not.toContain(key);
    }
    expect(source).toContain("APPLICATION_COMREP_OPTIONAL_KEYS");
  });

  it("does not use profile values as a year-amount prefill fallback", () => {
    expect(source).toContain("buildApplicationFinancialPrefillByYear");
    expect(source).toContain("year amounts are not copied from profile");
    expect(source).toContain("Previous financial year auto-filled from CTOS");
    expect(source).not.toContain("org_master");
    expect(source).not.toContain("autoPrefillMode");
  });
});
