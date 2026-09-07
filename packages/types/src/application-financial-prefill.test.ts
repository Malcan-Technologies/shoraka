import {
  buildApplicationFinancialPrefillByYear,
  resolveApplicationFinancialYearPrefill,
} from "./application-financial-prefill";

function orgStatements(byYear: Record<string, Record<string, unknown>>, fye: string) {
  return {
    questionnaire: { financial_year_end: fye },
    unaudited_by_year: byYear,
  };
}

function ctosRow(year: number, account: Record<string, number>) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null as null },
    account,
  };
}

const twoTabRef = new Date("2026-03-01T00:00:00");
const oneTabRef = new Date("2026-09-08T00:00:00");
const fye2026 = "2026-12-31";

describe("application financial prefill", () => {
  it("CASE A — two tabs, CTOS exists for historical year", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: orgStatements(
        { "2025": { turnover: 900 }, "2026": { turnover: 920 } },
        fye2026
      ),
      ctosFinancials: [ctosRow(2025, { turnover: 850 })],
      ref: twoTabRef,
    });
    expect(result.tabYears).toEqual([2025, 2026]);
    expect(result.inProgressYear).toBe(2026);
    expect(result.years["2025"]).toEqual({
      year: 2025,
      source: "ctos",
      fields: expect.objectContaining({ turnover: 850 }),
    });
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("CASE B — two tabs, no CTOS for historical year uses org master", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: orgStatements({ "2025": { turnover: 900 } }, fye2026),
      ctosFinancials: [],
      ref: twoTabRef,
    });
    expect(result.tabYears).toEqual([2025, 2026]);
    expect(result.years["2025"]).toEqual({
      year: 2025,
      source: "org_master",
      fields: expect.objectContaining({ turnover: 900 }),
    });
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("CASE C — one tab current year stays blank despite org and CTOS", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: orgStatements({ "2026": { turnover: 920 } }, fye2026),
      ctosFinancials: [ctosRow(2026, { turnover: 880 })],
      ref: oneTabRef,
    });
    expect(result.tabYears).toEqual([2026]);
    expect(result.inProgressYear).toBe(2026);
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("CASE D — stale org FYE copies nothing until a new FYE is selected", () => {
    const org = orgStatements(
      { "2025": { turnover: 900 }, "2026": { turnover: 920 } },
      "2024-12-31"
    );
    const ctos = [ctosRow(2025, { turnover: 850 })];
    const beforeFye = buildApplicationFinancialPrefillByYear({
      questionnaire: null,
      orgFinancialStatements: org,
      ctosFinancials: ctos,
      ref: twoTabRef,
    });
    expect(beforeFye.tabYears).toEqual([]);
    expect(beforeFye.years).toEqual({});

    const afterFye = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: org,
      ctosFinancials: ctos,
      ref: twoTabRef,
    });
    expect(afterFye.years["2025"]?.fields).toEqual(expect.objectContaining({ turnover: 850 }));
    expect(afterFye.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("CASE E — CTOS same historical year wins over org master", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements(
        { "2024": { turnover: 100 }, "2025": { turnover: 200 } },
        fye2026
      ),
      ctosFinancials: [ctosRow(2025, { turnover: 180 })],
    });
    expect(resolved).toEqual({
      year: 2025,
      source: "ctos",
      fields: expect.objectContaining({ turnover: 180 }),
    });
  });

  it("CASE F — issuer may replace a CTOS-prefilled historical value", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements({ "2025": { turnover: 200 } }, fye2026),
      ctosFinancials: [ctosRow(2025, { turnover: 180 })],
    });
    expect(resolved.fields?.turnover).toBe(180);
    const edited = { ...resolved.fields, turnover: 220 };
    expect(edited.turnover).toBe(220);
    expect(resolved.fields?.turnover).toBe(180);
  });

  it("does not map CTOS totals into ComRep borrowing splits", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements(
        { "2025": { turnover: 200, curlib_borrowing: 40 } },
        fye2026
      ),
      ctosFinancials: [ctosRow(2025, { turnover: 180, curlib: 70 })],
    });
    expect(resolved.fields?.curlib).toBe(70);
    expect(resolved.fields?.curlib_borrowing).toBeUndefined();
    expect(resolved.fields?.curlib_non_borrowing).toBeUndefined();
  });

  it("falls through to org when CTOS has the year but no application line items", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements({ "2025": { turnover: 900 } }, fye2026),
      ctosFinancials: [ctosRow(2025, { totass: 1_000_000, gear: 1.2 })],
    });
    expect(resolved.source).toBe("org_master");
    expect(resolved.fields?.turnover).toBe(900);
  });
});
