import {
  assertNotProductionSeed,
  buildLifecycleProspectusDraft,
  lifecycleTrendManualsForYears,
} from "../../../../scripts/lib/prospectus-lifecycle-drafts";
import { buildLifecycleFinancialBundle } from "../../../../scripts/lib/prospectus-lifecycle-financials";

describe("prospectus lifecycle seed helpers", () => {
  it("blocks production environments", () => {
    expect(() => assertNotProductionSeed({ NODE_ENV: "production" })).toThrow(
      /blocked in production/i
    );
    expect(() => assertNotProductionSeed({ APP_ENV: "prod" })).toThrow(/blocked in production/i);
    expect(() => assertNotProductionSeed({ NODE_ENV: "development" })).not.toThrow();
  });

  it("builds an empty draft without approval-required officer fills", () => {
    const draft = buildLifecycleProspectusDraft({
      mode: "empty",
      realYears: [2026],
    });
    expect(draft.page2.issuerProfile.companySize).toBeNull();
    expect(draft.page3.manualFinancialInputs?.years ?? {}).toEqual({});
  });

  it("builds a partial draft that is missing required fields", () => {
    const draft = buildLifecycleProspectusDraft({
      mode: "partial",
      realYears: [2025, 2026],
    });
    expect(draft.page2.issuerProfile.companySize).toBe("Medium");
    expect(draft.page2.creditInsights.paymentBehaviourOptionKey).toBeNull();
    expect(draft.page3.investorTakeaways.liquidityOptionKey).toBeNull();
    expect(Object.keys(draft.page3.manualFinancialInputs?.years ?? {})).toHaveLength(0);
  });

  it("builds a complete draft for the supplied real years only", () => {
    const years = [2024, 2025, 2026];
    const draft = buildLifecycleProspectusDraft({
      mode: "complete",
      realYears: years,
    });
    expect(draft.page2.issuerProfile.companySize).toBe("Medium");
    expect(draft.page2.creditInsights.ccrisStatusOptionKey).toBe("no_record");
    expect(Object.keys(draft.page3.manualFinancialInputs?.years ?? {}).sort()).toEqual([
      "2024",
      "2025",
      "2026",
    ]);
    expect(draft.page2.financialComparison?.overrides?.["2026"]?.dscr).toBeDefined();
    expect(draft.page3.manualFinancialInputs?.years?.["2025"]?.operatingCashFlow).toBeDefined();
  });

  it("creates increasing OCF trend manuals for three years", () => {
    const manuals = lifecycleTrendManualsForYears([2024, 2025, 2026]);
    expect(manuals[2024]!.operatingCashFlow).toBeLessThan(manuals[2025]!.operatingCashFlow);
    expect(manuals[2025]!.operatingCashFlow).toBeLessThan(manuals[2026]!.operatingCashFlow);
    expect(manuals[2024]!.freeCashFlow).toBeGreaterThan(manuals[2026]!.freeCashFlow);
  });

  it("builds one/two/three/gapped financial variants without fabricating placeholder years", () => {
    const ref = new Date("2026-07-15T00:00:00.000Z");
    const one = buildLifecycleFinancialBundle("one_year", ref);
    expect(one.realYears).toHaveLength(1);
    expect(one.ctosFinancials).toHaveLength(0);

    const two = buildLifecycleFinancialBundle("two_years", ref);
    expect(two.realYears).toHaveLength(2);

    const three = buildLifecycleFinancialBundle("three_years", ref);
    expect(three.realYears).toHaveLength(3);

    const gapped = buildLifecycleFinancialBundle("gapped_years", ref);
    expect(gapped.realYears).toHaveLength(2);
    const mid = Math.max(...gapped.realYears) - 1;
    expect(gapped.realYears.includes(mid)).toBe(false);
  });
});
