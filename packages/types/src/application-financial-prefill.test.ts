import {
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

function expectAdditionalDetailsBlank(fields: Record<string, unknown> | null | undefined) {
  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
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
      "curlib",
      "bsslltd",
      "bsclstd",
      "bsqpuc",
      "turnover",
      "plnpbt",
      "plnpat",
      "plnetdiv",
      "plyear",
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
      ctosFinancials: [ctosRow(2026, { turnover: 850, curlib: 70 })],
      ref: twoTabRefFy2027,
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]?.source).toBe("ctos");
    expect(result.years["2026"]?.fields).toEqual(
      expect.objectContaining({ turnover: 850, curlib: 70 })
    );
    expect(result.years["2026"]?.fields?.bsfatot).toBeUndefined();
    expectAdditionalDetailsBlank(result.years["2026"]?.fields);
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
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
      ctosFinancials: [ctosRow(2026, { turnover: 180, curlib: 70 })],
    });
    expect(resolved.source).toBe("ctos");
    expect(resolved.fields?.turnover).toBe(180);
    expect(resolved.fields?.curlib).toBe(70);
    expect(resolved.fields?.bsfatot).toBeUndefined();
    expectAdditionalDetailsBlank(resolved.fields);
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
