import {
  APPLICATION_FINANCIAL_PREFILL_KEYS,
  applicationComrepFieldError,
  buildApplicationFinancialPrefillByYear,
  buildStoredApplicationFinancialYearBlock,
  financialStatementsFromRevisionSnapshot,
  pickApplicationFinancialPrefillFields,
  pickSubmittedApplicationFinancialYearFields,
  resolveNewApplicationHistoricalPrefill,
} from "./application-financial-prefill";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "./financial-field-resolution";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
} from "./financial-field-labels";
import { getIssuerFinancialTabYears } from "./financial-unaudited-ctos-validation";
import {
  indexIssuerSubmittedFinancialYears,
  issuerSubmittedBlocksByYear,
} from "./issuer-submitted-financials";

function ctosRow(year: number, account: Record<string, number>) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null as null },
    account,
  };
}

function revisionSnapshot(financialStatements: Record<string, unknown>) {
  return { application: { financial_statements: financialStatements } };
}

const twoTabRef = new Date("2026-03-01T00:00:00");
const oneTabRef = new Date("2026-09-08T00:00:00");
const fye2026 = "2026-12-31";
const fye2027 = "2027-12-31";
const twoTabRefFy2027 = new Date("2027-01-15T00:00:00");
const oneTabRefFy2027 = new Date("2027-09-08T00:00:00");
/** FYE 30 Jun 2027: before 31 Dec 2026 → tabs [2026, 2027]; after → [2027]. */
const fyeJun2027 = "2027-06-30";
const twoTabRefJun2027 = new Date("2026-10-01T00:00:00");
const oneTabRefJun2027 = new Date("2027-02-01T00:00:00");

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

const CTOS_PRESERVED_COMREP = [
  "equity_share_premium",
  "equity_accumulated_profit",
  "equity_minority",
  "pl_minority",
];

function expectAdditionalDetailsBlank(
  fields: Record<string, unknown> | null | undefined,
  exceptions: string[] = []
) {
  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
    if (exceptions.includes(key)) continue;
    expect(fields?.[key]).toBeUndefined();
  }
}

describe("application financial prefill helpers", () => {
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
    expect(getIssuerFinancialTabYears({ financial_year_end: fyeJun2027 }, twoTabRefJun2027)).toEqual([
      2026, 2027,
    ]);
    expect(getIssuerFinancialTabYears({ financial_year_end: fyeJun2027 }, oneTabRefJun2027)).toEqual([
      2027,
    ]);
  });

  it("pickSubmittedApplicationFinancialYearFields keeps every present canonical raw key, including 0", () => {
    const block: Record<string, number> = {};
    ADMIN_EDITABLE_RAW_FINANCIAL_KEYS.forEach((key, index) => {
      block[key] = 1000 + index;
    });
    block.bsfatot = 0;
    block.equity_accumulated_profit = -250;
    const picked = pickSubmittedApplicationFinancialYearFields({
      ...block,
      pldd: "2026-12-31",
      statementType: "AUDITED",
      turnover_growth: 5,
    });
    expect(picked).toEqual(block);
    expect(pickSubmittedApplicationFinancialYearFields({ turnover: "", curlib: null })).toEqual({});
    expect(pickSubmittedApplicationFinancialYearFields(null)).toEqual({});
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

  it("reads financials from ApplicationRevision.snapshot.application.financial_statements only", () => {
    const fs = {
      questionnaire: { financial_year_end: fye2027 },
      unaudited_by_year: { "2026": { turnover: 260 } },
    };
    expect(financialStatementsFromRevisionSnapshot(revisionSnapshot(fs))).toEqual(fs);
    expect(financialStatementsFromRevisionSnapshot({ company_details: { name: "Draft Co" } })).toBeNull();
    expect(
      financialStatementsFromRevisionSnapshot({
        financial_statements: { unaudited_by_year: { "2026": { turnover: 1 } } },
      })
    ).toBeNull();
    expect(financialStatementsFromRevisionSnapshot(null)).toBeNull();
  });
});

describe("buildApplicationFinancialPrefillByYear — tab years", () => {
  const submitted = {
    "2025": { turnover: 50 },
    "2026": { turnover: 100 },
    "2027": { turnover: 200 },
  };

  it("F: tabs [2026, 2027] with submitted 2026 and 2027 → 2026 prefilled, 2027 blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fyeJun2027 },
      ctosFinancials: [],
      issuerSubmittedByYear: submitted,
      ref: twoTabRefJun2027,
    });
    expect(result.tabYears).toEqual([2026, 2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years["2026"]).toEqual({ year: 2026, source: "submitted", fields: { turnover: 100 } });
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("G: only tab [2027] with submitted 2027 → no prefill", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fyeJun2027 },
      ctosFinancials: [ctosRow(2027, { turnover: 880 })],
      issuerSubmittedByYear: submitted,
      ref: oneTabRefJun2027,
    });
    expect(result.tabYears).toEqual([2027]);
    expect(result.inProgressYear).toBe(2027);
    expect(result.years).toEqual({ "2027": { year: 2027, source: "blank", fields: null } });
  });

  it("H: tabs [2025, 2026] with submitted 2025 and 2026 → 2025 prefilled, 2026 blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      ctosFinancials: [],
      issuerSubmittedByYear: submitted,
      ref: twoTabRef,
    });
    expect(result.tabYears).toEqual([2025, 2026]);
    expect(result.inProgressYear).toBe(2026);
    expect(result.years["2025"]).toEqual({ year: 2025, source: "submitted", fields: { turnover: 50 } });
    expect(result.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("one-tab mode is the in-progress FY only, blank despite CTOS and submitted history", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2026 },
      ctosFinancials: [ctosRow(2026, { turnover: 880 })],
      issuerSubmittedByYear: { "2026": { turnover: 910, curlib_borrowing: 4 } },
      ref: oneTabRef,
    });
    expect(result.tabYears).toEqual([2026]);
    expect(result.inProgressYear).toBe(2026);
    expect(result.years).toEqual({ "2026": { year: 2026, source: "blank", fields: null } });
  });

  it("in-progress FY stays blank in two-tab mode even when CTOS and submitted contain it", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      ctosFinancials: [ctosRow(2026, { turnover: 850 }), ctosRow(2027, { turnover: 880 })],
      issuerSubmittedByYear: {
        "2026": { turnover: 260, ...SUBMITTED_ADDITIONAL_DETAILS },
        "2027": { turnover: 910, ...SUBMITTED_ADDITIONAL_DETAILS },
      },
      ref: twoTabRefFy2027,
    });
    expect(result.years["2026"]?.source).toBe("ctos");
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("stale FYE (no questionnaire) copies nothing until a new FYE is selected", () => {
    const params = {
      ctosFinancials: [ctosRow(2025, { turnover: 850 })],
      issuerSubmittedByYear: { "2025": { turnover: 900 } },
      ref: twoTabRef,
    };
    const beforeFye = buildApplicationFinancialPrefillByYear({ ...params, questionnaire: null });
    expect(beforeFye).toEqual({ tabYears: [], inProgressYear: null, years: {} });

    const afterFye = buildApplicationFinancialPrefillByYear({
      ...params,
      questionnaire: { financial_year_end: fye2026 },
    });
    expect(afterFye.years["2025"]).toEqual({
      year: 2025,
      source: "ctos",
      fields: expect.objectContaining({ turnover: 850 }),
    });
    expect(afterFye.years["2026"]).toEqual({ year: 2026, source: "blank", fields: null });
  });
});

describe("resolveNewApplicationHistoricalPrefill — source order", () => {
  it("I: CTOS FY2026 turnover 130 beats submitted 90; the in-progress FY2027 stays blank", () => {
    const result = buildApplicationFinancialPrefillByYear({
      questionnaire: { financial_year_end: fye2027 },
      ctosFinancials: [ctosRow(2026, { turnover: 130 })],
      issuerSubmittedByYear: { "2026": { turnover: 90 }, "2027": { turnover: 95 } },
      ref: twoTabRefFy2027,
    });
    expect(result.years["2026"]).toEqual({ year: 2026, source: "ctos", fields: { turnover: 130 } });
    expect(result.years["2027"]).toEqual({ year: 2027, source: "blank", fields: null });
  });

  it("J: CTOS owns the whole FY — a field CTOS lacks is not filled from submitted", () => {
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
      ctosFinancials: [ctosRow(2026, { turnover: 130 })],
      issuerSubmittedByYear: { "2026": { turnover: 90, tradeReceivables: 40 } },
    });
    expect(resolved.source).toBe("ctos");
    expect(resolved.fields?.turnover).toBe(130);
    expect(resolved.fields?.tradeReceivables).toBeUndefined();
  });

  it("K: the resolver has no CTOS gap-fill input, so a CTOS-missing field stays blank", () => {
    // Extra keys are not part of the signature; an Admin gap fill has nowhere to enter.
    const params = {
      year: 2026,
      ctosFinancials: [ctosRow(2026, { turnover: 130 })],
      issuerSubmittedByYear: null,
      ctosGapFillsByYear: { "2026": { tradeReceivables: 55 } },
    };
    const resolved = resolveNewApplicationHistoricalPrefill(params);
    expect(resolved).toEqual({ year: 2026, source: "ctos", fields: { turnover: 130 } });
    expect(resolved.fields?.tradeReceivables).toBeUndefined();
  });

  it("L: no CTOS → latest submitted User Input (Admin Input has no parameter)", () => {
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
      ctosFinancials: [ctosRow(2025, { turnover: 70 })],
      issuerSubmittedByYear: { "2026": { turnover: 100 } },
    });
    expect(resolved).toEqual({ year: 2026, source: "submitted", fields: { turnover: 100 } });
  });

  it("L: end to end from revisions — Admin edits and Admin Input in the snapshot are ignored", () => {
    const index = indexIssuerSubmittedFinancialYears([
      {
        revisionId: "rev-1",
        applicationId: "app-1",
        reviewCycle: 1,
        submittedAt: "2027-01-10T00:00:00.000Z",
        snapshot: revisionSnapshot({
          unaudited_by_year: { "2026": { turnover: 100, tradeReceivables: 40 } },
          admin_input_by_year: { "2026": { turnover: 999, tradeReceivables: 1 } },
          admin_field_overrides: {
            "2026": {
              turnover: {
                edit_user_input: {
                  value: 120,
                  baseSource: "user_input",
                  action: "edit_user_input",
                  updated_by_user_id: "admin",
                  updated_at: "2027-01-11T00:00:00.000Z",
                },
              },
            },
          },
        }),
      },
    ]);
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
      ctosFinancials: [],
      issuerSubmittedByYear: issuerSubmittedBlocksByYear(index),
    });
    expect(resolved).toEqual({
      year: 2026,
      source: "submitted",
      fields: { turnover: 100, tradeReceivables: 40 },
    });
  });

  it("M: no CTOS and no submitted for that FY → blank (other FYs are not reused)", () => {
    expect(
      resolveNewApplicationHistoricalPrefill({
        year: 2026,
        ctosFinancials: [ctosRow(2025, { turnover: 70 })],
        issuerSubmittedByYear: { "2025": { turnover: 900, bsfatot: 50 } },
      })
    ).toEqual({ year: 2026, source: "blank", fields: null });
    expect(
      resolveNewApplicationHistoricalPrefill({ year: 2026, ctosFinancials: null, issuerSubmittedByYear: null })
    ).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("a submitted block without actual amounts is blank", () => {
    expect(
      resolveNewApplicationHistoricalPrefill({
        year: 2026,
        ctosFinancials: [],
        issuerSubmittedByYear: { "2026": { pldd: "2026-12-31" } },
      })
    ).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("a CTOS row with no actual amounts is blank and does not fall back to submitted", () => {
    expect(
      resolveNewApplicationHistoricalPrefill({
        year: 2026,
        ctosFinancials: [ctosRow(2026, { totass: 1_000_000, gear: 1.2 })],
        issuerSubmittedByYear: {
          "2026": { turnover: 260, bsfatot: 40, ...SUBMITTED_ADDITIONAL_DETAILS },
        },
      })
    ).toEqual({ year: 2026, source: "blank", fields: null });
  });

  it("submitted FY copies core and every Additional Financial Details key", () => {
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
      ctosFinancials: [],
      issuerSubmittedByYear: { "2026": { turnover: 260, bsfatot: 40, ...SUBMITTED_ADDITIONAL_DETAILS } },
    });
    expect(resolved.source).toBe("submitted");
    expect(resolved.fields).toEqual({ turnover: 260, bsfatot: 40, ...SUBMITTED_ADDITIONAL_DETAILS });
  });

  it("submitted prefill is a copy; editing it does not change the index", () => {
    const issuerSubmittedByYear = { "2026": { turnover: 100 } };
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
      ctosFinancials: [],
      issuerSubmittedByYear,
    });
    (resolved.fields as Record<string, unknown>).turnover = 220;
    expect(issuerSubmittedByYear["2026"].turnover).toBe(100);
  });
});

describe("resolveNewApplicationHistoricalPrefill — CTOS mapping", () => {
  it("CTOS core plus the four preserved ComRep extras; no submitted merge", () => {
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
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
      issuerSubmittedByYear: {
        "2026": { turnover: 700, bsfatot: 99, curlib: 80, ...SUBMITTED_ADDITIONAL_DETAILS },
      },
    });
    expect(resolved.source).toBe("ctos");
    expect(resolved.fields).toEqual(expect.objectContaining({ turnover: 850, curlib: 70 }));
    expect(resolved.fields?.bsfatot).toBeUndefined();
    expect(resolved.fields?.equity_share_premium).toBe(111_000);
    expect(resolved.fields?.equity_accumulated_profit).toBe(222_000);
    expect(resolved.fields?.equity_minority).toBe(333_000);
    expect(resolved.fields?.pl_minority).toBe(444_000);
    expectAdditionalDetailsBlank(resolved.fields, CTOS_PRESERVED_COMREP);
  });

  it("preserves zero and negative CTOS ComRep extras", () => {
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2026,
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
      issuerSubmittedByYear: null,
    });
    expect(resolved.source).toBe("ctos");
    expect(resolved.fields?.equity_share_premium).toBe(0);
    expect(resolved.fields?.equity_accumulated_profit).toBe(0);
    expect(resolved.fields?.equity_minority).toBe(0);
    expect(resolved.fields?.pl_minority).toBe(-8975580);
    expectAdditionalDetailsBlank(resolved.fields, CTOS_PRESERVED_COMREP);
  });

  it("does not map CTOS totals into ComRep borrowing splits or fabricate ComRep-only fields", () => {
    const resolved = resolveNewApplicationHistoricalPrefill({
      year: 2025,
      ctosFinancials: [ctosRow(2025, { turnover: 180, curlib: 70, totass: 1 })],
      issuerSubmittedByYear: { "2025": { turnover: 200, curlib_borrowing: 40, operating_cost: 12 } },
    });
    expect(resolved.source).toBe("ctos");
    expect(resolved.fields?.curlib).toBe(70);
    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      expect(resolved.fields?.[key]).toBeUndefined();
    }
  });
});
