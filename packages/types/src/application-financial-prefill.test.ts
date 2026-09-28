import {
  effectiveFinancialHistoryEntries,
  indexResolvedApplicationFinancials,
  APPLICATION_FINANCIAL_PREFILL_KEYS,
  applicationComrepFieldError,
  buildApplicationFinancialPrefillByYear,
  buildStoredApplicationFinancialYearBlock,
  financialStatementsFromRevisionSnapshot,
  indexLatestSubmittedFinancialsByYear,
  pickApplicationFinancialPrefillFields,
  pickSubmittedApplicationFinancialYearFields,
  resolveApplicationFinancialYearPrefill,
  resolveLatestSubmittedFinancialsForYear,
} from "./application-financial-prefill";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
} from "./financial-field-labels";
import { getIssuerFinancialTabYears } from "./financial-unaudited-ctos-validation";

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

function revisionSnapshot(byYear: Record<string, Record<string, unknown>>) {
  return {
    application: {
      financial_statements: {
        questionnaire: { financial_year_end: "2027-12-31" },
        unaudited_by_year: byYear,
      },
    },
  };
}

const twoTabRef = new Date("2026-03-01T00:00:00");
const oneTabRef = new Date("2026-09-08T00:00:00");
const fye2026 = "2026-12-31";
const fye2027 = "2027-12-31";
const twoTabRefFy2027 = new Date("2027-01-15T00:00:00");
const oneTabRefFy2027 = new Date("2027-09-08T00:00:00");

const SUBMITTED_ADDITIONAL_DETAILS: Record<string, number> = {
  curlib_borrowing: 11,
  curlib_non_borrowing: 12,
  ncl_loan: 13,
  ncl_non_loan: 14,
  equity_share_application: 15,
  equity_share_premium: 16,
  equity_accumulated_profit: 17,
  equity_minority: 18,
  operating_cost: 19,
  admin_cost: 20,
  interest_cost: 21,
  other_cost: 22,
  pl_minority: 23,
};

function expectAdditionalDetailsBlank(
  fields: Record<string, unknown> | null | undefined,
  exceptions: string[] = []
) {
  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
    if (exceptions.includes(key)) continue;
    expect(fields?.[key]).toBeUndefined();
  }
}

function expectAdditionalDetailsPrefill(fields: Record<string, unknown> | null | undefined) {
  expect(fields).toEqual(expect.objectContaining(SUBMITTED_ADDITIONAL_DETAILS));
}

describe("application financial prefill", () => {
  it("keeps the existing application money keys", () => {
    expect([...APPLICATION_FINANCIAL_PREFILL_KEYS]).toEqual([...APPLICATION_CORE_MONEY_KEYS]);
    expect(APPLICATION_CORE_MONEY_KEYS).toEqual([
      "bsfatot",
      "othass",
      "bscatot",
      "bsclbank",
      "cashAndBank",
      "tradeReceivables",
      "curlib",
      "bsslltd",
      "bsclstd",
      "bsqpuc",
      "tradePayables",
      "turnover",
      "grossProfit",
      "ebitda",
      "plnpbt",
      "plnpat",
      "plnetdiv",
      "plyear",
      "operatingCashFlow",
      "freeCashFlow",
    ]);
    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      expect(APPLICATION_CORE_MONEY_KEYS).not.toContain(key);
    }
    expectAdditionalDetailsBlank(
      pickApplicationFinancialPrefillFields({
        turnover: 1,
        ...SUBMITTED_ADDITIONAL_DETAILS,
      })
    );
  });

  it("keeps the 6-month one-tab / two-tab year helper unchanged", () => {
    expect(getIssuerFinancialTabYears({ financial_year_end: fye2027 }, twoTabRefFy2027)).toEqual([
      2026, 2027,
    ]);
    expect(getIssuerFinancialTabYears({ financial_year_end: fye2027 }, oneTabRefFy2027)).toEqual([
      2027,
    ]);
  });

  it("previous FY + CTOS exists → core from CTOS, Additional Financial Details blank, history not merged", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      orgFinancialStatements: orgStatements(
        { "2026": { turnover: 900, bsfatot: 50, ...SUBMITTED_ADDITIONAL_DETAILS } },
        fye2027
      ),
      submittedByYear: {
        "2026": {
          turnover: 700,
          bsfatot: 99,
          curlib: 80,
          ...SUBMITTED_ADDITIONAL_DETAILS,
        },
      },
      ctosFinancials: [
        ctosRow(2026, {
          turnover: 850,
          curlib: 70,
          bsqres: 111_000,
          bsqupro: 222_000,
          bsqmint: 333_000,
          plminin: 444_000,
        }),
      ],
      ref: twoTabRefFy2027,
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]?.source).toBe("ctos");
    expect(result.years["2026"]?.fields).toEqual(
      expect.objectContaining({ turnover: 850, curlib: 70 })
    );
    expect(result.years["2026"]?.fields?.bsfatot).toBeUndefined();
    expect(result.years["2026"]?.fields?.equity_share_premium).toBe(111_000);
    expect(result.years["2026"]?.fields?.equity_accumulated_profit).toBe(222_000);
    expect(result.years["2026"]?.fields?.equity_minority).toBe(333_000);
    expect(result.years["2026"]?.fields?.pl_minority).toBe(444_000);
    expectAdditionalDetailsBlank(result.years["2026"]?.fields, [
      "equity_share_premium",
      "equity_accumulated_profit",
      "equity_minority",
      "pl_minority",
    ]);
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("previous FY + CTOS exists → preserves zero and negative ComRep extras", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      orgFinancialStatements: orgStatements(
        { "2026": { turnover: 900, bsfatot: 50, ...SUBMITTED_ADDITIONAL_DETAILS } },
        fye2027
      ),
      submittedByYear: {
        "2026": {
          turnover: 700,
          bsfatot: 99,
          curlib: 80,
          ...SUBMITTED_ADDITIONAL_DETAILS,
        },
      },
      ctosFinancials: [
        ctosRow(2026, {
          turnover: 850,
          curlib: 70,
          // 0 is a real CTOS value and must not be treated as missing.
          bsqres: 0,
          bsqupro: 0,
          bsqmint: 0,
          // Negative CTOS P&L minority interest must survive prefill.
          plminin: -8975580,
        }),
      ],
      ref: twoTabRefFy2027,
    });

    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]?.source).toBe("ctos");

    const fields = result.years["2026"]?.fields;
    expect(fields?.equity_share_premium).toBe(0);
    expect(fields?.equity_accumulated_profit).toBe(0);
    expect(fields?.equity_minority).toBe(0);
    expect(fields?.pl_minority).toBe(-8975580);

    expectAdditionalDetailsBlank(fields, [
      "equity_share_premium",
      "equity_accumulated_profit",
      "equity_minority",
      "pl_minority",
    ]);
  });

  it("previous FY + no CTOS + same-FY submitted revision → core and Additional Financial Details prefill", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      submittedByYear: {
        "2026": {
          turnover: 260,
          bsfatot: 40,
          ...SUBMITTED_ADDITIONAL_DETAILS,
        },
      },
      ctosFinancials: [ctosRow(2025, { turnover: 100 })],
      ref: twoTabRefFy2027,
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.years["2026"]).toEqual({
      year: 2026,
      source: "submitted",
      fields: expect.objectContaining({
        turnover: 260,
        bsfatot: 40,
        ...SUBMITTED_ADDITIONAL_DETAILS,
      }),
    });
    expectAdditionalDetailsPrefill(result.years["2026"]?.fields);
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("previous FY + neither CTOS nor same-FY submitted history stays blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      submittedByYear: { "2025": { turnover: 100, ...SUBMITTED_ADDITIONAL_DETAILS } },
      ctosFinancials: [ctosRow(2024, { turnover: 50 })],
      ref: twoTabRefFy2027,
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("CASE A — two tabs, CTOS exists for historical year", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: orgStatements(
        { "2025": { turnover: 900 }, "2026": { turnover: 920 } },
        fye2026
      ),
      submittedByYear: { "2025": { turnover: 700, curlib_borrowing: 11 } },
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
    expect(result.years["2025"]?.fields?.curlib_borrowing).toBeUndefined();
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("CASE B — two tabs, no CTOS and no submitted same-year stays blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: orgStatements({ "2025": { turnover: 900 } }, fye2026),
      ctosFinancials: [],
      ref: twoTabRef,
    });
    expect(result.tabYears).toEqual([2025, 2026]);
    expect(result.years["2025"]).toEqual({ year: 2025, source: "blank", fields: null });
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("CASE C — one tab current year stays blank despite org, CTOS, and submitted history", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      orgFinancialStatements: orgStatements({ "2026": { turnover: 920 } }, fye2026),
      submittedByYear: { "2026": { turnover: 910, curlib_borrowing: 4 } },
      ctosFinancials: [ctosRow(2026, { turnover: 880 })],
      ref: oneTabRef,
    });
    expect(result.tabYears).toEqual([2026]);
    expect(result.inProgressYear).toBe(2026);
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("current/in-progress FY stays fully blank even when CTOS and submitted history contain that year", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      submittedByYear: {
        "2026": { turnover: 260, ...SUBMITTED_ADDITIONAL_DETAILS },
        "2027": { turnover: 910, ...SUBMITTED_ADDITIONAL_DETAILS },
      },
      ctosFinancials: [ctosRow(2026, { turnover: 850 }), ctosRow(2027, { turnover: 880 })],
      ref: twoTabRefFy2027,
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]?.source).toBe("ctos");
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("one-tab mode is current/in-progress FY only and has no prefill", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      submittedByYear: {
        "2026": { turnover: 260, ...SUBMITTED_ADDITIONAL_DETAILS },
        "2027": { turnover: 910, ...SUBMITTED_ADDITIONAL_DETAILS },
      },
      ctosFinancials: [ctosRow(2026, { turnover: 850 }), ctosRow(2027, { turnover: 880 })],
      ref: oneTabRefFy2027,
    });
    expect(result.tabYears).toEqual([2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]).toBeUndefined();
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
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

  it("CASE E — CTOS same historical year wins over submitted history", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements(
        { "2024": { turnover: 100 }, "2025": { turnover: 200 } },
        fye2026
      ),
      submittedByYear: { "2025": { turnover: 200, curlib_borrowing: 9 } },
      ctosFinancials: [ctosRow(2025, { turnover: 180 })],
    });
    expect(resolved).toEqual({
      year: 2025,
      source: "ctos",
      fields: expect.objectContaining({ turnover: 180 }),
    });
    expect(resolved.fields?.curlib_borrowing).toBeUndefined();
  });

  it("does not merge submitted core or Additional Financial Details into a CTOS same-FY block", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2027,
      submittedByYear: {
        "2026": {
          turnover: 200,
          bsfatot: 50,
          curlib: 99,
          ...SUBMITTED_ADDITIONAL_DETAILS,
        },
      },
      ctosFinancials: [
        ctosRow(2026, {
          turnover: 180,
          curlib: 70,
          bsqres: 101_000,
          bsqupro: 202_000,
          bsqmint: 303_000,
          plminin: 404_000,
        }),
      ],
    });
    expect(resolved.source).toBe("ctos");
    expect(resolved.fields?.turnover).toBe(180);
    expect(resolved.fields?.curlib).toBe(70);
    expect(resolved.fields?.bsfatot).toBeUndefined();
    expect(resolved.fields?.equity_share_premium).toBe(101_000);
    expect(resolved.fields?.equity_accumulated_profit).toBe(202_000);
    expect(resolved.fields?.equity_minority).toBe(303_000);
    expect(resolved.fields?.pl_minority).toBe(404_000);
    expectAdditionalDetailsBlank(resolved.fields, [
      "equity_share_premium",
      "equity_accumulated_profit",
      "equity_minority",
      "pl_minority",
    ]);
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

  it("Jan 2027 two-tab example: FY2026 from submitted history, FY2027 blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: "2027-12-31" },
      ctosFinancials: [],
      submittedByYear: {
        "2025": { turnover: 100 },
        "2026": { turnover: 260 },
      },
      ref: new Date("2027-01-15T00:00:00"),
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]).toEqual({
      year: 2026,
      source: "submitted",
      fields: expect.objectContaining({ turnover: 260 }),
    });
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("prefills completed FY from the latest submitted application that contains that FY", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2027,
      ctosFinancials: [],
      submittedByYear: {
        "2025": { turnover: 100 },
        "2026": { turnover: 260, curlib_borrowing: 40 },
      },
    });
    expect(resolved).toEqual({
      year: 2026,
      source: "submitted",
      fields: expect.objectContaining({ turnover: 260, curlib_borrowing: 40 }),
    });
  });

  it("prefills every Additional Financial Details key from the same submitted FY block", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2027,
      ctosFinancials: [],
      submittedByYear: {
        "2026": { turnover: 260, ...SUBMITTED_ADDITIONAL_DETAILS },
      },
    });
    expect(resolved.source).toBe("submitted");
    expect(resolved.fields?.turnover).toBe(260);
    expectAdditionalDetailsPrefill(resolved.fields);
    expect(pickSubmittedApplicationFinancialYearFields(resolved.fields)).toEqual(
      expect.objectContaining(SUBMITTED_ADDITIONAL_DETAILS)
    );
    expect(pickApplicationFinancialPrefillFields(resolved.fields)?.curlib_borrowing).toBeUndefined();
  });

  it("does not reuse a submitted block from a different FY", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2027,
      ctosFinancials: [],
      submittedByYear: { "2025": { turnover: 900, bsfatot: 50 } },
    });
    expect(resolved).toEqual({ year: 2026, source: "blank", fields: null });
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

  it("does not fall back to org or submitted history when CTOS has the year but no application line items", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2027,
      orgFinancialStatements: orgStatements({ "2026": { turnover: 900 } }, fye2027),
      submittedByYear: {
        "2026": { turnover: 260, bsfatot: 40, ...SUBMITTED_ADDITIONAL_DETAILS },
      },
      ctosFinancials: [ctosRow(2026, { totass: 1_000_000, gear: 1.2 })],
    });
    expect(resolved.source).toBe("blank");
    expect(resolved.fields).toBeNull();
  });

  it("does not fabricate ComRep-only fields from CTOS or profile", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements(
        {
          "2025": {
            turnover: 900,
            curlib_borrowing: 40,
            operating_cost: 12,
          },
        },
        fye2026
      ),
      ctosFinancials: [ctosRow(2025, { turnover: 180, curlib: 70, totass: 1 })],
    });
    expect(resolved.source).toBe("ctos");
    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      expect(resolved.fields?.[key]).toBeUndefined();
    }
  });

  it("does not block optional ComRep fields when blank", () => {
    expect(applicationComrepFieldError("equity_share_application", "")).toBeNull();
    expect(applicationComrepFieldError("equity_share_premium", null)).toBeNull();
    expect(applicationComrepFieldError("operating_cost", "")).toBeNull();
    expect(applicationComrepFieldError("curlib_borrowing", "-1")).toBe(
      "Current Borrowings must be 0 or greater"
    );
    expect(applicationComrepFieldError("equity_accumulated_profit", "-10")).toBeNull();
    expect(applicationComrepFieldError("pl_minority", "-2")).toBeNull();
  });

  it("stores core fields and only present ComRep extras", () => {
    const stored = buildStoredApplicationFinancialYearBlock({
      pldd: "2025-12-31",
      turnover: 100,
      bsfatot: 1,
      curlib_borrowing: 40,
      equity_share_application: "",
    });
    expect(stored.pldd).toBe("2025-12-31");
    expect(stored.turnover).toBe(100);
    expect(stored.bsfatot).toBe(1);
    expect(stored.curlib_borrowing).toBe(40);
    expect(stored.equity_share_application).toBeUndefined();
    expect(stored.curlib).toBe(0);
  });

  it("does not treat organisation JSON as a completed-year prefill source", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      orgFinancialStatements: orgStatements(
        {
          "2025": {
            turnover: 900,
            bsfatot: 50,
            curlib: 20,
            curlib_borrowing: 8,
          },
        },
        fye2026
      ),
      ctosFinancials: [],
    });
    expect(resolved).toEqual({ year: 2025, source: "blank", fields: null });
  });

  it("prefills an Admin-supplied CTOS gap without labeling it as CTOS", () => {
    const indexed = indexResolvedApplicationFinancials([
      {
        financialStatements: {
          unaudited_by_year: { "2026": { turnover: 700, cashAndBank: 1 } },
          admin_field_overrides: {
            "2026": {
              cashAndBank: {
                value: 500000,
                baseSource: "ctos",
                action: "add_missing_ctos_field",
                updated_by_user_id: "admin",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            },
          },
        },
      },
    ]);
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2027,
      ctosFinancials: [ctosRow(2026, { turnover: 850, curlib: 70 })],
      submittedByYear: indexed.submittedByYear,
      adminSupplementsByYear: indexed.adminSupplementsByYear,
    });
    expect(resolved.fields?.turnover).toBe(850);
    expect(resolved.fields?.cashAndBank).toBe(500000);
    expect(resolved.fieldSources?.turnover).toBe("ctos");
    expect(resolved.fieldSources?.cashAndBank).toBe("previous_admin");
    expect(resolved.fields?.cashAndBank).not.toBe(1);
  });
});

describe("indexLatestSubmittedFinancialsByYear", () => {
  it("reads financials from ApplicationRevision.snapshot.application.financial_statements", () => {
    const snapshot = revisionSnapshot({ "2026": { turnover: 260 } });
    expect(financialStatementsFromRevisionSnapshot(snapshot)).toEqual({
      questionnaire: { financial_year_end: "2027-12-31" },
      unaudited_by_year: { "2026": { turnover: 260 } },
    });
  });

  it("uses the newest submitted revision that actually contains the required FY", () => {
    const indexed = indexLatestSubmittedFinancialsByYear([
      { snapshot: revisionSnapshot({ "2025": { turnover: 100 } }) },
      { snapshot: revisionSnapshot({ "2026": { turnover: 260, curlib_borrowing: 40 } }) },
      { snapshot: revisionSnapshot({ "2026": { turnover: 199 } }) },
    ]);
    expect(indexed["2025"]?.turnover).toBe(100);
    expect(indexed["2026"]?.turnover).toBe(260);
    expect(indexed["2026"]?.curlib_borrowing).toBe(40);
    expect(resolveLatestSubmittedFinancialsForYear(indexed, 2026)?.turnover).toBe(260);
    expect(resolveLatestSubmittedFinancialsForYear(indexed, 2024)).toBeNull();
  });

  it("does not treat a draft-shaped payload without a revision snapshot as submitted truth", () => {
    expect(
      indexLatestSubmittedFinancialsByYear([
        { snapshot: { unaudited_by_year: { "2026": { turnover: 1 } } } },
      ])
    ).toEqual({});
    expect(indexLatestSubmittedFinancialsByYear([])).toEqual({});
    expect(
      financialStatementsFromRevisionSnapshot({
        company_details: { name: "Draft Co" },
      })
    ).toBeNull();
    expect(
      financialStatementsFromRevisionSnapshot({
        financial_statements: {
          unaudited_by_year: { "2026": { turnover: 1, ...SUBMITTED_ADDITIONAL_DETAILS } },
        },
      })
    ).toBeNull();
  });

  it("does not merge Additional Financial Details from an older same-FY revision", () => {
    const indexed = indexLatestSubmittedFinancialsByYear([
      { snapshot: revisionSnapshot({ "2026": { turnover: 260 } }) },
      {
        snapshot: revisionSnapshot({
          "2026": { turnover: 199, ...SUBMITTED_ADDITIONAL_DETAILS },
        }),
      },
    ]);
    expect(indexed["2026"]?.turnover).toBe(260);
    expectAdditionalDetailsBlank(indexed["2026"]);
  });
});

const OPTIONAL_EQUITY = [
  "equity_share_application",
  "equity_share_premium",
  "equity_minority",
] as const;

describe("profile effective financial history", () => {
  it("PROFILE 1 — blank optional FY2026 fields stay blank when older history has 500000", () => {
    const indexed = indexResolvedApplicationFinancials([
      {
        financialStatements: {
          unaudited_by_year: {
            "2026": { turnover: 11, tradeReceivables: 2 },
          },
        },
      },
      {
        financialStatements: {
          unaudited_by_year: {
            "2026": {
              turnover: 9,
              equity_share_application: 500000,
              equity_share_premium: 500000,
              equity_minority: 500000,
            },
          },
        },
      },
    ]);
    const years = effectiveFinancialHistoryEntries({
      ctosFinancials: [],
      userByYear: indexed.submittedByYear,
      adminInputByYear: indexed.adminInputByYear,
      ctosGapFillsByYear: indexed.ctosGapFillsByYear,
      orgFinancialStatements: orgStatements(
        {
          "2026": {
            turnover: 11,
            equity_share_application: 500000,
            equity_share_premium: 500000,
            equity_minority: 500000,
          },
        },
        fye2026
      ),
    });
    const fy2026 = years.find((entry) => entry.year === "2026")?.block;
    expect(fy2026?.turnover).toBe(11);
    expect(fy2026?.tradeReceivables).toBe(2);
    for (const key of OPTIONAL_EQUITY) expect(fy2026?.[key]).toBeUndefined();
  });

  it("PROFILE 2 — Admin edit of User Input is the profile value and does not rewrite the submission", () => {
    const submitted = {
      unaudited_by_year: { "2025": { turnover: 100, tradeReceivables: 10 } },
      admin_field_overrides: {
        "2025": {
          tradeReceivables: {
            value: 12,
            baseSource: "user_input",
            action: "edit_user_input",
            updated_by_user_id: "admin",
            updated_at: "2026-02-01T00:00:00.000Z",
          },
        },
      },
    };
    const indexed = indexResolvedApplicationFinancials([{ financialStatements: submitted }]);
    const years = effectiveFinancialHistoryEntries({
      ctosFinancials: [],
      userByYear: indexed.submittedByYear,
      userEditedKeysByYear: indexed.userEditedKeysByYear,
    });
    expect(years.find((entry) => entry.year === "2025")?.block.tradeReceivables).toBe(12);
    expect(years.find((entry) => entry.year === "2025")?.block.turnover).toBe(100);
    expect(
      (submitted.unaudited_by_year["2025"] as { tradeReceivables: number }).tradeReceivables
    ).toBe(10);
  });

  it("PROFILE 3 — Admin Input is effective until CTOS owns that FY", () => {
    const indexed = indexResolvedApplicationFinancials([
      {
        financialStatements: {
          unaudited_by_year: { "2025": { turnover: 10, tradeReceivables: 4 } },
          admin_input_by_year: { "2025": { turnover: 40, tradeReceivables: 8 } },
          admin_field_overrides: {
            "2025": {
              tradeReceivables: {
                value: 20,
                baseSource: "ctos",
                action: "add_missing_ctos_field",
                updated_by_user_id: "admin",
                updated_at: "2026-03-01T00:00:00.000Z",
              },
            },
          },
        },
      },
    ]);
    const beforeCtos = effectiveFinancialHistoryEntries({
      ctosFinancials: [],
      userByYear: indexed.submittedByYear,
      adminInputByYear: indexed.adminInputByYear,
      ctosGapFillsByYear: indexed.ctosGapFillsByYear,
    });
    expect(beforeCtos.find((entry) => entry.year === "2025")?.block).toEqual(
      expect.objectContaining({ turnover: 40, tradeReceivables: 8 })
    );

    const afterCtos = effectiveFinancialHistoryEntries({
      ctosFinancials: [ctosRow(2025, { turnover: 100 })],
      userByYear: indexed.submittedByYear,
      adminInputByYear: indexed.adminInputByYear,
      ctosGapFillsByYear: indexed.ctosGapFillsByYear,
    });
    const fy2025 = afterCtos.find((entry) => entry.year === "2025")?.block;
    expect(fy2025?.turnover).toBe(100);
    expect(fy2025?.tradeReceivables).toBe(20);
    expect(indexed.adminInputByYear["2025"]?.turnover).toBe(40);
  });
});

describe("historical prefill source order", () => {
  it("PREFILL 1 — CTOS previous FY, current FY blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      ctosFinancials: [ctosRow(2025, { turnover: 100 })],
      submittedByYear: { "2025": { turnover: 1 }, "2026": { turnover: 2 } },
      ref: twoTabRef,
    });
    expect(result.inProgressYear).toBe(2026);
    expect(result.years["2025"]?.source).toBe("ctos");
    expect(result.years["2025"]?.fields?.turnover).toBe(100);
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("PREFILL 2 — CTOS plus an explicit gap fill", () => {
    const indexed = indexResolvedApplicationFinancials([
      {
        financialStatements: {
          admin_field_overrides: {
            "2025": {
              tradeReceivables: {
                value: 20,
                baseSource: "ctos",
                action: "add_missing_ctos_field",
                updated_by_user_id: "admin",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            },
          },
        },
      },
    ]);
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [ctosRow(2025, { turnover: 100 })],
      ctosGapFillsByYear: indexed.ctosGapFillsByYear,
      adminInputByYear: { "2025": { turnover: 999, tradeReceivables: 1 } },
      submittedByYear: { "2025": { turnover: 5, tradeReceivables: 6 } },
    });
    expect(resolved.fields?.turnover).toBe(100);
    expect(resolved.fields?.tradeReceivables).toBe(20);
    expect(resolved.fieldSources?.turnover).toBe("ctos");
    expect(resolved.fieldSources?.tradeReceivables).toBe("previous_admin");
  });

  it("PREFILL 3 — Admin Input when CTOS has no FY", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [],
      adminInputByYear: { "2025": { turnover: 40, tradeReceivables: 8 } },
      submittedByYear: { "2025": { turnover: 10, tradeReceivables: 4 } },
    });
    expect(resolved.source).toBe("submitted");
    expect(resolved.fields).toEqual(expect.objectContaining({ turnover: 40, tradeReceivables: 8 }));
    expect(resolved.fieldSources?.turnover).toBe("previous_admin");
  });

  it("PREFILL 4 — User Input when CTOS and Admin Input are absent", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [],
      submittedByYear: { "2025": { turnover: 100, tradeReceivables: 10 } },
    });
    expect(resolved.fields).toEqual(
      expect.objectContaining({ turnover: 100, tradeReceivables: 10 })
    );
    expect(resolved.fieldSources).toBeUndefined();
  });

  it("PREFILL 5 — reviewed User Input includes Admin edits", () => {
    const indexed = indexResolvedApplicationFinancials([
      {
        financialStatements: {
          unaudited_by_year: { "2025": { turnover: 100, tradeReceivables: 10 } },
          admin_field_overrides: {
            "2025": {
              tradeReceivables: {
                value: 12,
                baseSource: "user_input",
                action: "edit_user_input",
                updated_by_user_id: "admin",
                updated_at: "2026-02-01T00:00:00.000Z",
              },
            },
          },
        },
      },
    ]);
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [],
      submittedByYear: indexed.submittedByYear,
      userEditedKeysByYear: indexed.userEditedKeysByYear,
    });
    expect(resolved.fields?.turnover).toBe(100);
    expect(resolved.fields?.tradeReceivables).toBe(12);
    expect(resolved.fieldSources?.tradeReceivables).toBe("previous_admin");
    expect(resolved.fieldSources?.turnover).toBe("submitted");
  });

  it("PREFILL 6 — later CTOS replaces Admin Input except explicit gap fills", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [ctosRow(2025, { turnover: 100 })],
      adminInputByYear: { "2025": { turnover: 40, tradeReceivables: 8 } },
      ctosGapFillsByYear: { "2025": { tradeReceivables: 20 } },
      submittedByYear: { "2025": { turnover: 10 } },
    });
    expect(resolved.fields?.turnover).toBe(100);
    expect(resolved.fields?.tradeReceivables).toBe(20);
  });

  it("PREFILL 7 — current FY already in history still starts blank", () => {
    const resolved = resolveApplicationFinancialYearPrefill({
      year: 2026,
      inProgressYear: 2026,
      ctosFinancials: [ctosRow(2026, { turnover: 100 })],
      adminInputByYear: { "2026": { turnover: 70 } },
      submittedByYear: { "2026": { turnover: 50 } },
      orgFinancialStatements: orgStatements({ "2026": { turnover: 900 } }, fye2026),
    });
    expect(resolved).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("PREFILL 8 — a blank selected-source field is not filled from older 500000 history", () => {
    const indexed = indexResolvedApplicationFinancials([
      {
        financialStatements: {
          unaudited_by_year: { "2025": { turnover: 100 } },
        },
      },
      {
        financialStatements: {
          unaudited_by_year: {
            "2025": { turnover: 90, equity_share_application: 500000 },
          },
        },
      },
    ]);
    const fromUser = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [],
      submittedByYear: indexed.submittedByYear,
      adminSupplementsByYear: { "2025": { equity_share_application: 500000 } },
      orgFinancialStatements: orgStatements(
        { "2025": { turnover: 100, equity_share_application: 500000 } },
        fye2026
      ),
    });
    expect(fromUser.fields?.turnover).toBe(100);
    expect(fromUser.fields?.equity_share_application).toBeUndefined();

    const fromCtos = resolveApplicationFinancialYearPrefill({
      year: 2025,
      inProgressYear: 2026,
      ctosFinancials: [ctosRow(2025, { turnover: 100 })],
      adminInputByYear: { "2025": { equity_share_application: 500000, turnover: 40 } },
      submittedByYear: indexed.submittedByYear,
      orgFinancialStatements: orgStatements(
        { "2025": { equity_share_application: 500000 } },
        fye2026
      ),
    });
    expect(fromCtos.fields?.turnover).toBe(100);
    expect(fromCtos.fields?.equity_share_application).toBeUndefined();
  });

  it("keeps FY2024 on Admin Input when CTOS later owns only FY2025", () => {
    const fy2024 = resolveHistoricalYear(2024);
    const fy2025 = resolveHistoricalYear(2025);
    expect(fy2024.fields?.turnover).toBe(30);
    expect(fy2025.fields?.turnover).toBe(100);
    expect(fy2025.fields?.tradeReceivables).toBeUndefined();

    function resolveHistoricalYear(year: number) {
      return resolveApplicationFinancialYearPrefill({
        year,
        inProgressYear: 2026,
        ctosFinancials: [ctosRow(2025, { turnover: 100 })],
        adminInputByYear: {
          "2024": { turnover: 30 },
          "2025": { turnover: 40, tradeReceivables: 8 },
        },
      });
    }
  });
});
