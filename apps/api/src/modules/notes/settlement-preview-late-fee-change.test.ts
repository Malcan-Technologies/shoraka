import { settlementPreviewChangesLateFees } from "./settlement-preview-late-fee-change";

describe("settlementPreviewChangesLateFees", () => {
  const saved = { tawidhAmount: 200, tawidhInvestorSharePercent: 25, gharamahAmount: 300 };

  it("no baseline and zero fee fields is not a late fee change", () => {
    expect(settlementPreviewChangesLateFees({}, null)).toBe(false);
    expect(
      settlementPreviewChangesLateFees(
        { tawidhAmount: 0, tawidhInvestorSharePercent: 0, gharamahAmount: 0 },
        null
      )
    ).toBe(false);
  });

  it("no baseline and non-zero fee fields is a late fee change", () => {
    expect(settlementPreviewChangesLateFees({ tawidhAmount: 200 }, null)).toBe(true);
    expect(settlementPreviewChangesLateFees({ gharamahAmount: 300 }, null)).toBe(true);
  });

  it("the same values as the saved preview is not a late fee change", () => {
    expect(settlementPreviewChangesLateFees({ ...saved }, saved)).toBe(false);
    expect(
      settlementPreviewChangesLateFees({ ...saved, tawidhAmount: 200.004 }, saved)
    ).toBe(false);
  });

  it("changing a saved amount is a late fee change", () => {
    expect(settlementPreviewChangesLateFees({ ...saved, tawidhAmount: 250 }, saved)).toBe(true);
    expect(settlementPreviewChangesLateFees({ ...saved, gharamahAmount: 100 }, saved)).toBe(true);
  });

  it("clearing saved fees to zero is a late fee change", () => {
    expect(settlementPreviewChangesLateFees({}, saved)).toBe(true);
    expect(
      settlementPreviewChangesLateFees(
        { tawidhAmount: 0, tawidhInvestorSharePercent: 0, gharamahAmount: 0 },
        saved
      )
    ).toBe(true);
  });

  it("an investor share change with Ta'widh above zero is a late fee change", () => {
    expect(
      settlementPreviewChangesLateFees({ ...saved, tawidhInvestorSharePercent: 50 }, saved)
    ).toBe(true);
  });

  it("ignores the investor share when Ta'widh is zero", () => {
    const gharamahOnly = { tawidhAmount: 0, tawidhInvestorSharePercent: 0, gharamahAmount: 300 };
    expect(
      settlementPreviewChangesLateFees(
        { ...gharamahOnly, tawidhInvestorSharePercent: 40 },
        gharamahOnly
      )
    ).toBe(false);
    expect(settlementPreviewChangesLateFees({ tawidhInvestorSharePercent: 40 }, null)).toBe(false);
  });
});
