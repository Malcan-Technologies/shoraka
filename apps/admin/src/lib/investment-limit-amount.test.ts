import * as fs from "fs";
import * as path from "path";
import {
  INVESTMENT_LIMITS_TAB_HELP,
  investmentLimitParseError,
  parseInvestmentLimitAmount,
} from "./investment-limit-amount";

describe("parseInvestmentLimitAmount", () => {
  it("treats a blank field as unlimited", () => {
    expect(parseInvestmentLimitAmount("")).toEqual({ ok: true, value: null });
    expect(parseInvestmentLimitAmount("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts a whole-ringgit or two-decimal amount", () => {
    expect(parseInvestmentLimitAmount("400000")).toEqual({ ok: true, value: 400000 });
    expect(parseInvestmentLimitAmount("400000.50")).toEqual({ ok: true, value: 400000.5 });
  });

  it("rejects negatives, non-numbers, and more than two decimals", () => {
    expect(parseInvestmentLimitAmount("-1")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseInvestmentLimitAmount("abc")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseInvestmentLimitAmount("400000.123")).toEqual({
      ok: false,
      reason: "too-many-decimals",
    });
  });

  it("matches the API two-decimal message", () => {
    expect(investmentLimitParseError("Retail investment limit", "too-many-decimals")).toBe(
      "Retail investment limit can have up to 2 decimal places"
    );
    expect(investmentLimitParseError("Retail investment limit", "not-a-number")).toBe(
      "Retail investment limit must be a number of 0 or more, or left blank for no limit"
    );
  });

  it("mentions failed-funding release and wallet plus pending deposits", () => {
    expect(INVESTMENT_LIMITS_TAB_HELP).toContain("funding fails and the commitment is released");
    expect(INVESTMENT_LIMITS_TAB_HELP).toContain(
      "Cash already in the wallet and deposits still being processed"
    );
  });

  it("wires parse and help onto the platform finance tab", () => {
    const settings = fs.readFileSync(
      path.join(__dirname, "../app/settings/platform-finance/page.tsx"),
      "utf8"
    );
    expect(settings).toContain("INVESTMENT_LIMITS_TAB_HELP");
    expect(settings).toContain("parsedInvestmentLimitOrToast");
    expect(settings).toContain("Retail investment limit");
  });
});
