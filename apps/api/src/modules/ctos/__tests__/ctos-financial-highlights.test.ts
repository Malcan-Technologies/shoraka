/**
 * Official CTOS ENQWS v5.11.0 Financial Highlights resolvers.
 */

import {
  resolveCtosCurrentRatio,
  resolveCtosDebtToEquityPercent,
  resolveCtosGearingRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosReturnOnCapital,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssetTurnover,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
  resolveCtosWorkingCapitalDays,
} from "@cashsouk/types";

describe("resolveCtosReturnOnAssetsPercent", () => {
  it("matches CTOS XSL plnpat/totass*100", () => {
    expect(resolveCtosReturnOnAssetsPercent({ plnpat: 8, totass: 100 })).toBe(8);
    expect(resolveCtosReturnOnAssetsPercent({ plnpat: 100_000, totass: 1_000_000 })).toBe(10);
  });

  it("returns null for missing or zero denominator", () => {
    expect(resolveCtosReturnOnAssetsPercent({ plnpat: 8, totass: null })).toBeNull();
    expect(resolveCtosReturnOnAssetsPercent({ plnpat: null, totass: 100 })).toBeNull();
    expect(resolveCtosReturnOnAssetsPercent({ plnpat: 8, totass: 0 })).toBeNull();
  });
});

describe("resolveCtosPatMarginPercent", () => {
  it("matches CTOS XSL plnpat/turnover*100 and ignores profit_margin (PBT)", () => {
    expect(
      resolveCtosPatMarginPercent({ plnpat: 8, turnover: 200, profit_margin: 99 })
    ).toBe(4);
    expect(resolveCtosPatMarginPercent({ plnpat: 0, turnover: 200 })).toBe(0);
  });

  it("returns null for missing or zero turnover", () => {
    expect(resolveCtosPatMarginPercent({ plnpat: 8, turnover: null })).toBeNull();
    expect(resolveCtosPatMarginPercent({ plnpat: 8, turnover: 0 })).toBeNull();
    expect(resolveCtosPatMarginPercent({ plnpat: null, turnover: 200 })).toBeNull();
  });
});

describe("resolveCtosTotalAssetTurnover", () => {
  it("matches CTOS XSL turnover/totass", () => {
    expect(resolveCtosTotalAssetTurnover({ turnover: 200, totass: 100 })).toBe(2);
  });

  it("returns null for missing or zero totass", () => {
    expect(resolveCtosTotalAssetTurnover({ turnover: 200, totass: 0 })).toBeNull();
    expect(resolveCtosTotalAssetTurnover({ turnover: null, totass: 100 })).toBeNull();
  });
});

describe("resolveCtosGearingRatio", () => {
  it("prefers direct gear when present", () => {
    expect(resolveCtosGearingRatio({ gear: 4.4, totlib: 999, networth: 1 })).toBe(4.4);
  });

  it("falls back to totlib/networth when gear absent", () => {
    expect(resolveCtosGearingRatio({ totlib: 220, networth: 50 })).toBe(4.4);
    expect(resolveCtosGearingRatio({ gear: null, totlib: 0, networth: 50 })).toBe(0);
  });

  it("returns null when gear absent and inputs invalid", () => {
    expect(resolveCtosGearingRatio({ totlib: 10, networth: 0 })).toBeNull();
    expect(resolveCtosGearingRatio({ totlib: null, networth: 50 })).toBeNull();
  });
});

describe("resolveCtosDebtToEquityPercent", () => {
  it("matches CTOS XSL totlib/networth*100 when both non-zero", () => {
    expect(resolveCtosDebtToEquityPercent({ totlib: 220, networth: 50 })).toBeCloseTo(440);
  });

  it("returns null when totlib is zero (XSL guard)", () => {
    expect(resolveCtosDebtToEquityPercent({ totlib: 0, networth: 50 })).toBeNull();
  });
});

describe("resolveCtosWorkingCapitalDays", () => {
  it("matches CTOS XSL ((bscatot-curlib)*365)/turnover", () => {
    expect(
      resolveCtosWorkingCapitalDays({ bscatot: 100, curlib: 50, turnover: 200 })
    ).toBe(((100 - 50) * 365) / 200);
  });

  it("returns null for zero turnover", () => {
    expect(
      resolveCtosWorkingCapitalDays({ bscatot: 100, curlib: 50, turnover: 0 })
    ).toBeNull();
  });
});

describe("resolveCtosReturnOnCapital", () => {
  it("matches CTOS XSL turnover/networth", () => {
    expect(resolveCtosReturnOnCapital({ turnover: 200, networth: 50 })).toBe(4);
  });
});

describe("resolveCtosReturnOnEquityPercent", () => {
  it("uses direct return_on_equity only", () => {
    expect(resolveCtosReturnOnEquityPercent({ return_on_equity: 15.2 })).toBe(15.2);
  });

  it("does not fall back to plnpat/networth or totass-totlib", () => {
    expect(
      resolveCtosReturnOnEquityPercent({
        return_on_equity: null,
        plnpat: 100,
        networth: 500,
        totass: 1000,
        totlib: 200,
      })
    ).toBeNull();
  });
});

describe("resolveCtosCurrentRatio", () => {
  it("uses direct currat only", () => {
    expect(resolveCtosCurrentRatio({ currat: 1.75 })).toBe(1.75);
  });

  it("does not fall back to bscatot/curlib", () => {
    expect(
      resolveCtosCurrentRatio({ currat: null, bscatot: 400, curlib: 200 })
    ).toBeNull();
  });
});

describe("resolveCtosTotalAssets / resolveCtosTotalLiabilities", () => {
  it("uses direct totass / totlib only", () => {
    expect(resolveCtosTotalAssets({ totass: 999 })).toBe(999);
    expect(resolveCtosTotalLiabilities({ totlib: 111 })).toBe(111);
  });

  it("does not reconstruct from components", () => {
    expect(
      resolveCtosTotalAssets({
        totass: null,
        bscatot: 400,
      } as Parameters<typeof resolveCtosTotalAssets>[0])
    ).toBeNull();
    expect(
      resolveCtosTotalLiabilities({
        totlib: null,
        curlib: 150,
      } as Parameters<typeof resolveCtosTotalLiabilities>[0])
    ).toBeNull();
  });
});
