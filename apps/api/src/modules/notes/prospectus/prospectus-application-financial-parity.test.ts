/**
 * Runtime side-by-side: corrected Financial Summary definitions vs Prospectus shared metrics.
 * Same year + same raw record + same metric → same underlying number (formatting may differ).
 */

import {
  computeProfitMargin,
  computeReturnOnEquity,
  computeCurrentRatio,
  resolveApplicationFinancialCurrentRatio,
  resolveApplicationFinancialProfitMarginRatio,
  resolveApplicationFinancialReturnOnEquityRatio,
  resolveApplicationFinancialTotalAssets,
  resolveApplicationFinancialTotalLiabilities,
  resolveFinancialSummaryIssuerReturnOnEquityRatio,
  resolveFinancialSummaryProfitMarginRatio,
} from "@cashsouk/types";
import { buildProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import {
  formatProspectusFinancialMultiple,
  formatProspectusFinancialPercentFromRatio,
  formatProspectusMyrMillions,
} from "./prospectus-financial-comparison-metrics";

/** Corrected Financial Summary definitions (NPM + ROE). */
function applicationUnderlyingFromRaw(raw: Record<string, number | null>) {
  const totass = resolveApplicationFinancialTotalAssets({
    totass: raw.totass ?? null,
    bsfatot: raw.bsfatot ?? null,
    othass: raw.othass ?? null,
    bscatot: raw.bscatot ?? null,
    bsclbank: raw.bsclbank ?? null,
  });
  const totlib = resolveApplicationFinancialTotalLiabilities({
    totlib: raw.totlib ?? null,
    curlib: raw.curlib ?? null,
    bsslltd: raw.bsslltd ?? null,
    bsclstd: raw.bsclstd ?? null,
  });
  const currat = resolveApplicationFinancialCurrentRatio({
    currat: raw.currat ?? null,
    bscatot: raw.bscatot ?? null,
    curlib: raw.curlib ?? null,
  });

  return {
    turnover: raw.turnover ?? null,
    plnpat: raw.plnpat ?? null,
    plnpbt: raw.plnpbt ?? null,
    bscatot: raw.bscatot ?? null,
    curlib: raw.curlib ?? null,
    totass,
    totlib,
    npmRatio: resolveFinancialSummaryProfitMarginRatio({
      plnpat: raw.plnpat ?? null,
      turnover: raw.turnover ?? null,
    }),
    roeRatio:
      raw.return_on_equity != null && Number.isFinite(raw.return_on_equity)
        ? raw.return_on_equity / 100
        : resolveFinancialSummaryIssuerReturnOnEquityRatio({
            plnpat: raw.plnpat ?? null,
            netWorth: raw.networth ?? null,
          }),
    currat,
  };
}

function prospectusUnderlying(raw: Record<string, number | null>) {
  return {
    turnover: raw.turnover ?? null,
    plnpat: raw.plnpat ?? null,
    plnpbt: raw.plnpbt ?? null,
    bscatot: raw.bscatot ?? null,
    curlib: raw.curlib ?? null,
    totass: resolveApplicationFinancialTotalAssets({
      totass: raw.totass ?? null,
      bsfatot: raw.bsfatot ?? null,
      othass: raw.othass ?? null,
      bscatot: raw.bscatot ?? null,
      bsclbank: raw.bsclbank ?? null,
    }),
    totlib: resolveApplicationFinancialTotalLiabilities({
      totlib: raw.totlib ?? null,
      curlib: raw.curlib ?? null,
      bsslltd: raw.bsslltd ?? null,
      bsclstd: raw.bsclstd ?? null,
    }),
    npmRatio: resolveApplicationFinancialProfitMarginRatio({
      plnpat: raw.plnpat ?? null,
      turnover: raw.turnover ?? null,
    }),
    roeRatio: resolveApplicationFinancialReturnOnEquityRatio({
      return_on_equity: raw.return_on_equity ?? null,
      plnpat: raw.plnpat ?? null,
      networth: raw.networth ?? null,
    }),
    currat: resolveApplicationFinancialCurrentRatio({
      currat: raw.currat ?? null,
      bscatot: raw.bscatot ?? null,
      curlib: raw.curlib ?? null,
    }),
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

const COMPLETE_UNAUDITED: Record<string, number | null> = {
  ...COMPLETE_CTOS,
  totass: null,
  totlib: null,
  profit_margin: null,
  return_on_equity: null,
  currat: null,
};

describe("Application ↔ Prospectus shared financial parity", () => {
  const scenarios: Array<{ name: string; raw: Record<string, number | null> }> = [
    { name: "complete CTOS year with flat ratios/totals", raw: COMPLETE_CTOS },
    { name: "complete unaudited year (recompute path)", raw: COMPLETE_UNAUDITED },
    {
      name: "flat totass/totlib present",
      raw: { ...COMPLETE_UNAUDITED, totass: 99_000_000, totlib: 11_000_000 },
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
      },
    },
  ];

  for (const { name, raw } of scenarios) {
    it(`${name}: underlying shared metrics match`, () => {
      const app = applicationUnderlyingFromRaw(raw);
      const prosp = prospectusUnderlying(raw);
      expect(prosp.turnover).toEqual(app.turnover);
      expect(prosp.plnpat).toEqual(app.plnpat);
      expect(prosp.plnpbt).toEqual(app.plnpbt);
      expect(prosp.bscatot).toEqual(app.bscatot);
      expect(prosp.curlib).toEqual(app.curlib);
      expect(prosp.totass).toEqual(app.totass);
      expect(prosp.totlib).toEqual(app.totlib);
      expect(prosp.npmRatio).toEqual(app.npmRatio);
      expect(prosp.roeRatio).toEqual(app.roeRatio);
      expect(prosp.currat).toEqual(app.currat);
    });
  }

  it("duplicate year CTOS flat fields: NPM uses PAT/Turnover; ROE keeps flat when present", () => {
    const source = financialSourceFromYearBlocks({
      "2024": COMPLETE_CTOS,
    });
    const page2 = buildProspectusFinancialComparisonMetrics({ source });
    const page3Is = buildProspectusPageThreeIncomeStatement({ financialSource: source });
    const page3Bs = buildProspectusPageThreeBalanceSheet({ financialSource: source });

    const npm = computeProfitMargin(1_800_000, 18_600_000);
    expect(page2.rows.find((r) => r.key === "netProfitMargin")?.values[0]).toBe(
      formatProspectusFinancialPercentFromRatio(npm)
    );
    expect(page3Is.rows.find((r) => r.key === "net_profit_margin")?.values[0]).toBe(
      formatProspectusFinancialPercentFromRatio(npm)
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
    expect(
      resolveApplicationFinancialTotalAssets({
        totass: 12_000_000,
        bsfatot: 2_000_000,
        othass: 1_000_000,
        bscatot: 5_200_000,
        bsclbank: 800_000,
      })
    ).toBe(12_000_000);
    expect(2_000_000 + 1_000_000 + 5_200_000 + 800_000).not.toBe(12_000_000);
  });

  it("recompute helpers stay algebraically identical when flat absent", () => {
    expect(computeProfitMargin(50, 200)).toBe(
      resolveApplicationFinancialProfitMarginRatio({
        plnpat: 50,
        turnover: 200,
      })
    );
    expect(computeReturnOnEquity(50, 200)).toBe(
      resolveApplicationFinancialReturnOnEquityRatio({
        return_on_equity: null,
        plnpat: 50,
        networth: 200,
      })
    );
    expect(computeCurrentRatio(200, 100)).toBe(
      resolveApplicationFinancialCurrentRatio({
        currat: null,
        bscatot: 200,
        curlib: 100,
      })
    );
  });
});
