jest.mock("@cashsouk/config", () => jest.requireActual("@cashsouk/config/src/currency"));

import {
  donutGroupFractions,
  donutSegmentDash,
  formatCompactLedgerAmount,
} from "./money-on-platform-display";

describe("formatCompactLedgerAmount", () => {
  it("compacts millions and thousands without inventing a different unit", () => {
    expect(formatCompactLedgerAmount(8_858_720)).toBe("RM 8.86m");
    expect(formatCompactLedgerAmount(12_500)).toBe("RM 12.5k");
    expect(formatCompactLedgerAmount(8_500)).toBe("RM 8,500.00");
  });
});

describe("donutGroupFractions", () => {
  it("offsets later slices by earlier held shares", () => {
    const segments = donutGroupFractions(
      [
        { id: "custody", held: 90 },
        { id: "income", held: 6 },
        { id: "payable", held: 4 },
      ],
      100
    );
    expect(segments[0]).toMatchObject({ id: "custody", fraction: 0.9, offsetFraction: 0 });
    expect(segments[1]).toMatchObject({ id: "income", fraction: 0.06, offsetFraction: 0.9 });
    expect(segments[2]).toMatchObject({ id: "payable", fraction: 0.04, offsetFraction: 0.96 });
  });
});

describe("donutSegmentDash", () => {
  it("uses a full-circle remainder so empty slices collapse", () => {
    const empty = donutSegmentDash(0, 0);
    expect(empty.dasharray.startsWith("0.00 ")).toBe(true);
    expect(donutSegmentDash(1, 0).dashoffset).toBe("0.00");
  });
});
