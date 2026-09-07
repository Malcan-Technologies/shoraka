import { filterVisiblePeopleRows } from "./application-people-display";
import { shouldIncludePerson } from "./director-shareholder-display";
import {
  ISSUER_MIN_SHAREHOLDING_MESSAGE,
  issuerActiveShareholderFlags,
  issuerShareholdingMeetsMinimum,
  issuerShareholdingThresholdIssue,
  isIssuerShareholderOnlyBelowMinimum,
  parseShareholdingPercent,
} from "./issuer-shareholder-threshold";

describe("issuer shareholder 5% threshold", () => {
  it("accepts 5, 5.0, and 10", () => {
    expect(issuerShareholdingMeetsMinimum(5)).toBe(true);
    expect(issuerShareholdingMeetsMinimum("5.0")).toBe(true);
    expect(issuerShareholdingMeetsMinimum(10)).toBe(true);
    expect(issuerShareholdingThresholdIssue(5)).toBeNull();
    expect(issuerShareholdingThresholdIssue("5.0")).toBeNull();
    expect(issuerShareholdingThresholdIssue(10)).toBeNull();
  });

  it("rejects 4.99, 4, 1, 0, and negative values without rounding", () => {
    for (const value of [4.99, 4, 1, 0, -1, "4.99", "4"]) {
      expect(issuerShareholdingMeetsMinimum(value)).toBe(false);
      expect(issuerShareholdingThresholdIssue(value)?.message).toBe(ISSUER_MIN_SHAREHOLDING_MESSAGE);
    }
  });

  it("rejects blank and invalid percentages when required", () => {
    expect(issuerShareholdingThresholdIssue(null)?.message).toBe("Shareholding Percentage (%) is required.");
    expect(issuerShareholdingThresholdIssue("")?.message).toBe("Shareholding Percentage (%) is required.");
    expect(issuerShareholdingThresholdIssue("   ")?.message).toBe("Shareholding Percentage (%) is required.");
    expect(issuerShareholdingThresholdIssue("abc")?.message).toBe("Shareholding Percentage (%) is required.");
  });

  it("does not treat a director with <5% shares as an active shareholder-only party", () => {
    expect(
      isIssuerShareholderOnlyBelowMinimum({
        isShareholder: true,
        isDirector: true,
        shareholdingPercentage: 3,
      })
    ).toBe(false);
    expect(
      isIssuerShareholderOnlyBelowMinimum({
        isShareholder: true,
        isDirector: false,
        shareholdingPercentage: 3,
      })
    ).toBe(true);
  });

  it("strips the shareholder role when percentage is below 5%", () => {
    expect(
      issuerActiveShareholderFlags({
        isShareholder: true,
        isDirector: true,
        shareholdingPercentage: 3,
      })
    ).toEqual({ isShareholder: false, shareholdingPercentage: null });
    expect(
      issuerActiveShareholderFlags({
        isShareholder: true,
        shareholdingPercentage: 5,
      })
    ).toEqual({ isShareholder: true, shareholdingPercentage: 5 });
  });

  it("parses percent strings without rounding 4.99 up to 5", () => {
    expect(parseShareholdingPercent("4.99")).toBe(4.99);
    expect(parseShareholdingPercent("5.0")).toBe(5);
    expect(parseShareholdingPercent({ toString: () => "3.000000" })).toBe(3);
    expect(issuerShareholdingThresholdIssue({ toString: () => "3.000000" })?.message).toBe(
      ISSUER_MIN_SHAREHOLDING_MESSAGE
    );
  });

  it("applies the same 5% inclusion rule to individual and company shareholders", () => {
    expect(
      shouldIncludePerson({ type: "INDIVIDUAL", isShareholder: true, sharePercentage: 3 })
    ).toBe(false);
    expect(
      shouldIncludePerson({ type: "INDIVIDUAL", isShareholder: true, sharePercentage: 5 })
    ).toBe(true);
    expect(
      shouldIncludePerson({ type: "COMPANY", isShareholder: true, sharePercentage: 3 })
    ).toBe(false);
    expect(
      shouldIncludePerson({ type: "COMPANY", isShareholder: true, sharePercentage: 10 })
    ).toBe(true);
    expect(
      shouldIncludePerson({
        type: "INDIVIDUAL",
        isDirector: true,
        isShareholder: true,
        sharePercentage: 3,
      })
    ).toBe(true);
    expect(issuerShareholdingMeetsMinimum(3)).toBe(false);
    expect(issuerShareholdingMeetsMinimum(5)).toBe(true);
  });

  it("keeps director and drops shareholder-only people below 5% from visible people[]", () => {
    const rows = filterVisiblePeopleRows([
      { roles: ["DIRECTOR", "SHAREHOLDER"], sharePercentage: 3 },
      { roles: ["SHAREHOLDER"], sharePercentage: 3 },
      { roles: ["SHAREHOLDER"], sharePercentage: 5 },
    ]);
    expect(rows).toEqual([
      { roles: ["DIRECTOR"], sharePercentage: 3 },
      { roles: ["SHAREHOLDER"], sharePercentage: 5 },
    ]);
  });
});
