import { buildProspectusFinancialComparisonSource } from "../prospectus/prospectus-financial-comparison-source";
import {
  buildProspectusThreeYearDisplaySet,
  withProspectusThreeYearDisplay,
} from "../prospectus/prospectus-three-year-display";
import {
  assertNotProductionSeed,
  buildLifecycleProspectusDraft,
  lifecycleTrendManualsForYears,
} from "../../../../scripts/lib/prospectus-lifecycle-drafts";
import {
  buildLifecycleFinancialBundle,
  LIFECYCLE_REPORTING_YEARS,
  lifecycleNewestYear,
  lifecycleQuestionnaire,
} from "../../../../scripts/lib/prospectus-lifecycle-financials";

function asCtosYears(rows: unknown[]): number[] {
  return rows
    .map((row) =>
      row && typeof row === "object" && "financial_year" in row
        ? Number((row as { financial_year: unknown }).financial_year)
        : NaN
    )
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
}

function allSeededYears(bundle: ReturnType<typeof buildLifecycleFinancialBundle>): number[] {
  const unaudited = bundle.financialStatements.unaudited_by_year as Record<string, unknown>;
  const fromUnaudited = Object.keys(unaudited).map(Number);
  return [...new Set([...fromUnaudited, ...asCtosYears(bundle.ctosFinancials)])].sort(
    (a, b) => a - b
  );
}

describe("prospectus lifecycle seed helpers", () => {
  const ref = new Date("2026-07-15T00:00:00.000Z");

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

  it("uses fixed FY2024–FY2026 questionnaire dates (2 Sep)", () => {
    expect(lifecycleNewestYear()).toBe(2026);
    expect(lifecycleQuestionnaire()).toEqual({ financial_year_end: "2026-09-02" });
    expect(LIFECYCLE_REPORTING_YEARS).toEqual({ y0: 2024, y1: 2025, y2: 2026 });
  });

  it("builds one/two/three variants with no future year and matching FYE dates", () => {
    const one = buildLifecycleFinancialBundle("one_year", ref);
    expect(one.realYears).toEqual([2026]);
    expect(one.ctosFinancials).toHaveLength(0);
    expect(allSeededYears(one)).toEqual([2026]);
    expect(
      (one.financialStatements.unaudited_by_year as Record<string, { pldd?: string }>)["2026"]
        ?.pldd
    ).toBe("2026-09-02");

    const two = buildLifecycleFinancialBundle("two_years", ref);
    expect(two.realYears).toEqual([2025, 2026]);
    expect(allSeededYears(two)).toEqual([2025, 2026]);
    expect(Math.max(...allSeededYears(two))).toBe(2026);

    const three = buildLifecycleFinancialBundle("three_years", ref);
    expect(three.realYears).toEqual([2024, 2025, 2026]);
    expect(allSeededYears(three)).toEqual([2024, 2025, 2026]);
    expect(allSeededYears(three).some((y) => y === 2027)).toBe(false);
  });

  it("builds gapped seed as real FY2024 + FY2026 (missing FY2025, no FY2027)", () => {
    const gapped = buildLifecycleFinancialBundle("gapped_years", ref);
    expect(gapped.realYears).toEqual([2024, 2026]);
    expect(gapped.realYears).not.toContain(2025);
    expect(gapped.realYears).not.toContain(2027);
    expect(allSeededYears(gapped)).toEqual([2024, 2026]);
    expect(asCtosYears(gapped.ctosFinancials)).toEqual([2024]);
    expect(
      Object.keys(gapped.financialStatements.unaudited_by_year as Record<string, unknown>)
    ).toEqual(["2026"]);

    const ctos = gapped.ctosFinancials[0] as {
      dates?: { pldd?: string };
    };
    expect(ctos.dates?.pldd).toBe("2024-09-02");
    expect(
      (gapped.financialStatements.unaudited_by_year as Record<string, { pldd?: string }>)["2026"]
        ?.pldd
    ).toBe("2026-09-02");
  });

  it("gapped display columns are FY2024 | FY2025 | FY2026 with FY2025 as —", () => {
    const gapped = buildLifecycleFinancialBundle("gapped_years", ref);
    const source = buildProspectusFinancialComparisonSource({
      financialStatements: gapped.financialStatements,
      ctosFinancials: gapped.ctosFinancials,
      ref,
    });
    expect(source.years.map((y) => y.year)).toEqual([2024, 2026]);

    const display = buildProspectusThreeYearDisplaySet(source.years);
    expect(display.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(display.map((y) => !!y.isPlaceholder)).toEqual([false, true, false]);
    expect(display[1]?.rawFinancials).toEqual({});
    expect(withProspectusThreeYearDisplay(source).years.map((y) => y.year)).toEqual([
      2024, 2025, 2026,
    ]);
    // Placeholder mid-year keeps Page 3 trends unavailable (production rule).
    expect(display.some((y) => y.isPlaceholder)).toBe(true);

    // Mid-2026 SSM window only expects FY2026 (present) — display gap is still FY2025.
    // Early-2026 window flags missing FY2025 via the central Ops copy (non-blocking).
    expect(source.opsWarning).toBeNull();

    const earlyRef = new Date("2026-01-15T00:00:00.000Z");
    const early = buildProspectusFinancialComparisonSource({
      financialStatements: gapped.financialStatements,
      ctosFinancials: gapped.ctosFinancials,
      ref: earlyRef,
    });
    expect(early.missingSsmUnauditedYears).toEqual([2025]);
    expect(early.opsWarning).toContain("FY2025");
    expect(early.opsWarning).toContain("missing from the application");
    expect(early.opsWarning).toContain("does not block approval");
  });

  it("rerunning gapped builder never recreates FY2027", () => {
    const first = buildLifecycleFinancialBundle("gapped_years", ref);
    const second = buildLifecycleFinancialBundle("gapped_years", ref);
    expect(allSeededYears(first)).toEqual([2024, 2026]);
    expect(allSeededYears(second)).toEqual([2024, 2026]);
    expect(JSON.stringify(first)).not.toContain("2027");
    expect(JSON.stringify(second)).not.toContain("2027");
  });

  it("standard financial seed scenarios contain no year after FY2026", () => {
    for (const variant of ["one_year", "two_years", "three_years", "gapped_years"] as const) {
      const bundle = buildLifecycleFinancialBundle(variant, ref);
      expect(Math.max(...allSeededYears(bundle), 0)).toBeLessThanOrEqual(2026);
      expect(allSeededYears(bundle).includes(2027)).toBe(false);
      expect(
        (bundle.financialStatements.questionnaire as { financial_year_end: string })
          .financial_year_end
      ).toBe("2026-09-02");
    }
  });
});
