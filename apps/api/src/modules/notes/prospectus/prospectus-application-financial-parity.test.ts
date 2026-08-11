/**
 * Application CTOS Financial Summary and Prospectus share official CTOS resolvers.
 * No CashSouk component / PAT÷equity fallbacks for CTOS-facing metrics.
 */

import {
  resolveCtosCurrentRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
} from "@cashsouk/types";
import { buildProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import {
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromPoints,
  formatProspectusFinancialPercentFromRatio,
  formatProspectusMyrMillions,
} from "./prospectus-financial-comparison-metrics";

/** CTOS Application Financial Summary column resolution (official only). */
function applicationCtosUnderlyingFromRaw(raw: Record<string, number | null>) {
  return {
    turnover: raw.turnover ?? null,
    plnpat: raw.plnpat ?? null,
    plnpbt: raw.plnpbt ?? null,
    bscatot: raw.bscatot ?? null,
    curlib: raw.curlib ?? null,
    totass: resolveCtosTotalAssets({ totass: raw.totass ?? null }),
    totlib: resolveCtosTotalLiabilities({ totlib: raw.totlib ?? null }),
    npmPoints: resolveCtosPatMarginPercent({
      plnpat: raw.plnpat ?? null,
      turnover: raw.turnover ?? null,
    }),
    roePoints: resolveCtosReturnOnEquityPercent({
      return_on_equity: raw.return_on_equity ?? null,
    }),
    currat: resolveCtosCurrentRatio({ currat: raw.currat ?? null }),
  };
}

/** Prospectus CTOS year resolution (same official helpers). */
function prospectusUnderlying(raw: Record<string, number | null>) {
  return {
    turnover: raw.turnover ?? null,
    plnpat: raw.plnpat ?? null,
    plnpbt: raw.plnpbt ?? null,
    bscatot: raw.bscatot ?? null,
    curlib: raw.curlib ?? null,
    totass: resolveCtosTotalAssets({ totass: raw.totass ?? null }),
    totlib: resolveCtosTotalLiabilities({ totlib: raw.totlib ?? null }),
    npmPoints: resolveCtosPatMarginPercent({
      plnpat: raw.plnpat ?? null,
      turnover: raw.turnover ?? null,
    }),
    roePoints: resolveCtosReturnOnEquityPercent({
      return_on_equity: raw.return_on_equity ?? null,
    }),
    currat: resolveCtosCurrentRatio({ currat: raw.currat ?? null }),
  };
}

const COMPLETE_CTOS: Record<string, number | null> = {
  turnover: 18_600_000,
  plnpat: 1_800_000,
  plnpbt: 2_100_000,
  bsqpuc: 6_000_000,
  networth: 7_800_000,
  bscatot: 5_200_000,
  curlib: 3_100_000,
  bsfatot: 2_000_000,
  othass: 1_000_000,
  bsclbank: 800_000,
  bsslltd: 700_000,
  bsclstd: 400_000,
  totass: 12_000_000,
  totlib: 4_200_000,
  profit_margin: 9.5,
  return_on_equity: 15.2,
  currat: 1.68,
};

const COMPONENTS_ONLY: Record<string, number | null> = {
  ...COMPLETE_CTOS,
  totass: null,
  totlib: null,
  profit_margin: null,
  return_on_equity: null,
  currat: null,
  gear: null,
};

describe("Application CTOS ↔ Prospectus official financial parity", () => {
  const scenarios: Array<{ name: string; raw: Record<string, number | null> }> = [
    { name: "complete CTOS year with flat ratios/totals", raw: COMPLETE_CTOS },
    { name: "components present but flat totals/ratios missing → null", raw: COMPONENTS_ONLY },
    {
      name: "flat totass/totlib present",
      raw: { ...COMPONENTS_ONLY, totass: 99_000_000, totlib: 11_000_000 },
    },
    {
      name: "partial-data year",
      raw: {
        turnover: 10_000_000,
        plnpat: null,
        plnpbt: null,
        bsqpuc: 5_000_000,
        networth: 5_000_000,
        bscatot: 2_000_000,
        curlib: null,
        bsfatot: null,
        othass: null,
        bsclbank: null,
        bsslltd: null,
        bsclstd: null,
        totass: null,
        totlib: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
        gear: null,
      },
    },
    {
      name: "zero denominator",
      raw: {
        turnover: 0,
        plnpat: 100,
        plnpbt: 100,
        bsqpuc: 0,
        networth: 0,
        bscatot: 100,
        curlib: 0,
        bsfatot: 0,
        othass: 0,
        bsclbank: 0,
        bsslltd: 0,
        bsclstd: 0,
        totass: null,
        totlib: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
        gear: null,
      },
    },
    {
      name: "missing source metric",
      raw: {
        turnover: null,
        plnpat: null,
        plnpbt: null,
        bsqpuc: null,
        networth: null,
        bscatot: null,
        curlib: null,
        bsfatot: null,
        othass: null,
        bsclbank: null,
        bsslltd: null,
        bsclstd: null,
        totass: null,
        totlib: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
        gear: null,
      },
    },
  ];

  for (const { name, raw } of scenarios) {
    it(`${name}: Application CTOS and Prospectus match (official only)`, () => {
      const app = applicationCtosUnderlyingFromRaw(raw);
      const prosp = prospectusUnderlying(raw);
      expect(prosp).toEqual(app);
    });
  }

  it("components-only year: no unofficial totass/currat/ROE reconstruction", () => {
    const app = applicationCtosUnderlyingFromRaw(COMPONENTS_ONLY);
    expect(app.totass).toBeNull();
    expect(app.totlib).toBeNull();
    expect(app.currat).toBeNull();
    expect(app.roePoints).toBeNull();
    expect(app.npmPoints).toBeCloseTo((1_800_000 / 18_600_000) * 100);
  });

  it("duplicate year CTOS flat fields: NPM uses PAT/Turnover; ROE keeps flat when present", () => {
    const source = financialSourceFromYearBlocks({
      "2024": COMPLETE_CTOS,
    });
    const page2 = buildProspectusFinancialComparisonMetrics({ source });
    const page3Is = buildProspectusPageThreeIncomeStatement({ financialSource: source });
    const page3Bs = buildProspectusPageThreeBalanceSheet({ financialSource: source });

    const npmPoints = resolveCtosPatMarginPercent({
      plnpat: 1_800_000,
      turnover: 18_600_000,
    });
    expect(page2.rows.find((r) => r.key === "netProfitMargin")?.values[0]).toBe(
      formatProspectusFinancialPercentFromPoints(npmPoints)
    );
    expect(page3Is.rows.find((r) => r.key === "net_profit_margin")?.values[0]).toBe(
      formatProspectusFinancialPercentFromPoints(npmPoints)
    );
    expect(page2.rows.find((r) => r.key === "roe")?.values[0]).toBe(
      formatProspectusFinancialPercentFromRatio(0.152)
    );
    expect(page2.rows.find((r) => r.key === "currentRatio")?.values[0]).toBe(
      formatProspectusFinancialMultiple(1.68)
    );
    expect(page3Bs.rows.find((r) => r.key === "current_ratio")?.values[0]).toBe(
      formatProspectusFinancialMultiple(1.68)
    );
    expect(page3Bs.rows.find((r) => r.key === "total_assets")?.values[0]).toBe(
      formatProspectusMyrMillions(12_000_000)
    );
    expect(resolveCtosTotalAssets({ totass: 12_000_000 })).toBe(12_000_000);
    expect(resolveCtosTotalAssets({ totass: null })).toBeNull();
    expect(2_000_000 + 1_000_000 + 5_200_000 + 800_000).not.toBe(12_000_000);
  });

  it("official helpers do not invent CTOS fallbacks when flat absent", () => {
    expect(
      resolveCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 50,
        networth: 200,
      })
    ).toBeNull();
    expect(
      resolveCtosCurrentRatio({
        currat: null,
        bscatot: 200,
        curlib: 100,
      })
    ).toBeNull();
    expect(
      resolveCtosTotalAssets({
        totass: null,
      })
    ).toBeNull();
    expect(
      resolveCtosPatMarginPercent({
        plnpat: 50,
        turnover: 200,
      })
    ).toBe(25);
  });
});
