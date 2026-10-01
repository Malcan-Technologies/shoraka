/**
 * SECTION: Issuer-submitted financial history
 * WHY: Issuer Profile and new-application prefill read issuer User Input from submitted revisions
 * only. A FY becomes newer only when its values changed; Admin edits, Admin Input and CTOS never count.
 */

import {
  indexIssuerSubmittedFinancialYears,
  issuerFinancialProfileEntries,
  issuerFinancialYearBlocksEqual,
  issuerSubmittedBlocksByYear,
  latestIssuerSubmittedFinancialYear,
  type IssuerSubmittedRevisionRow,
} from "./issuer-submitted-financials";

const JAN = "2027-01-10T00:00:00.000Z";
const FEB = "2027-02-10T00:00:00.000Z";
const MAR = "2027-03-10T00:00:00.000Z";
const APR = "2027-04-10T00:00:00.000Z";

function revision(params: {
  applicationId: string;
  reviewCycle: number;
  submittedAt: Date | string;
  byYear: Record<string, Record<string, unknown>>;
  extra?: Record<string, unknown>;
}): IssuerSubmittedRevisionRow {
  return {
    revisionId: `${params.applicationId}-c${params.reviewCycle}`,
    applicationId: params.applicationId,
    reviewCycle: params.reviewCycle,
    submittedAt: params.submittedAt,
    snapshot: {
      application: {
        financial_statements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: params.byYear,
          ...params.extra,
        },
      },
    },
  };
}

describe("indexIssuerSubmittedFinancialYears — per-FY latest submitted User Input", () => {
  it("A: one submitted application → that FY block", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
    ]);
    expect(index["2026"]).toEqual({
      year: "2026",
      block: { turnover: 100 },
      effectiveAt: JAN,
      applicationId: "app-1",
      revisionId: "app-1-c1",
    });
  });

  it("B: Admin edits of User Input and Admin Input in the snapshot are ignored", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({
        applicationId: "app-1",
        reviewCycle: 1,
        submittedAt: JAN,
        byYear: { "2026": { turnover: 100 } },
        extra: {
          admin_field_overrides: {
            "2026": {
              turnover: {
                edit_user_input: {
                  value: 120,
                  baseSource: "user_input",
                  action: "edit_user_input",
                  updated_by_user_id: "admin",
                  updated_at: FEB,
                },
              },
              tradeReceivables: {
                add_missing_ctos_field: {
                  value: 55,
                  baseSource: "ctos",
                  action: "add_missing_ctos_field",
                  updated_by_user_id: "admin",
                  updated_at: FEB,
                },
              },
            },
          },
          admin_input_by_year: {
            "2025": { turnover: 70 },
            "2026": { turnover: 999, tradeReceivables: 1 },
          },
        },
      }),
    ]);
    expect(index["2026"]?.block).toEqual({ turnover: 100 });
    expect(index["2025"]).toBeUndefined();
  });

  it("C: a later application with a different FY value wins", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-2", reviewCycle: 1, submittedAt: FEB, byYear: { "2026": { turnover: 120 } } }),
    ]);
    expect(index["2026"]).toMatchObject({ block: { turnover: 120 }, applicationId: "app-2", effectiveAt: FEB });
  });

  it("D: a documents-only resubmit of an older application does not make its unchanged FY newer", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-2", reviewCycle: 1, submittedAt: FEB, byYear: { "2026": { turnover: 120 } } }),
      revision({ applicationId: "app-1", reviewCycle: 2, submittedAt: MAR, byYear: { "2026": { turnover: 100 } } }),
    ]);
    expect(index["2026"]).toMatchObject({
      block: { turnover: 120 },
      applicationId: "app-2",
      revisionId: "app-2-c1",
      effectiveAt: FEB,
    });
  });

  it("financial amendment: a changed FY on resubmit becomes newer at the resubmit time", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-2", reviewCycle: 1, submittedAt: FEB, byYear: { "2026": { turnover: 120 } } }),
      revision({ applicationId: "app-1", reviewCycle: 2, submittedAt: MAR, byYear: { "2026": { turnover: 90 } } }),
    ]);
    expect(index["2026"]).toEqual({
      year: "2026",
      block: { turnover: 90 },
      effectiveAt: MAR,
      applicationId: "app-1",
      revisionId: "app-1-c2",
    });
  });

  it("E: each FY keeps its own effective time; the carrier is the latest revision", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({
        applicationId: "app-1",
        reviewCycle: 1,
        submittedAt: JAN,
        byYear: { "2026": { turnover: 100 }, "2027": { turnover: 200 } },
      }),
      revision({
        applicationId: "app-1",
        reviewCycle: 2,
        submittedAt: MAR,
        byYear: { "2026": { turnover: 100 }, "2027": { turnover: 250 } },
      }),
    ]);
    expect(index["2026"]).toMatchObject({ block: { turnover: 100 }, effectiveAt: JAN, revisionId: "app-1-c2" });
    expect(index["2027"]).toMatchObject({ block: { turnover: 250 }, effectiveAt: MAR, revisionId: "app-1-c2" });
  });

  it("an unchanged-but-carried FY loses to another application's later change", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-2", reviewCycle: 1, submittedAt: FEB, byYear: { "2026": { turnover: 120 } } }),
      revision({ applicationId: "app-1", reviewCycle: 2, submittedAt: MAR, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-2", reviewCycle: 2, submittedAt: APR, byYear: { "2026": { turnover: 120 } } }),
    ]);
    expect(index["2026"]).toMatchObject({ applicationId: "app-2", effectiveAt: FEB, revisionId: "app-2-c2" });
  });

  it("numeric 0 and missing are different values", () => {
    expect(issuerFinancialYearBlocksEqual({ turnover: 1, tradeReceivables: 0 }, { turnover: 1 })).toBe(false);
    expect(issuerFinancialYearBlocksEqual({ turnover: 1, tradeReceivables: "" }, { turnover: 1 })).toBe(true);
    expect(issuerFinancialYearBlocksEqual({ turnover: "1,000" }, { turnover: 1000 })).toBe(true);
    expect(issuerFinancialYearBlocksEqual(null, undefined)).toBe(true);

    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
      revision({
        applicationId: "app-1",
        reviewCycle: 2,
        submittedAt: MAR,
        byYear: { "2026": { turnover: 100, tradeReceivables: 0 } },
      }),
    ]);
    expect(index["2026"]).toMatchObject({ block: { turnover: 100, tradeReceivables: 0 }, effectiveAt: MAR });
  });

  it("non-financial keys (pldd, statementType) do not count as a change", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({
        applicationId: "app-1",
        reviewCycle: 1,
        submittedAt: JAN,
        byYear: { "2026": { turnover: 100, pldd: "2026-12-31" } },
      }),
      revision({
        applicationId: "app-1",
        reviewCycle: 2,
        submittedAt: MAR,
        byYear: { "2026": { turnover: 100, pldd: "2026-06-30" } },
      }),
    ]);
    expect(index["2026"]).toMatchObject({ block: { turnover: 100 }, effectiveAt: JAN });
  });

  it("a FY removed and then re-added counts as a change", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-1", reviewCycle: 2, submittedAt: FEB, byYear: { "2027": { turnover: 5 } } }),
      revision({ applicationId: "app-1", reviewCycle: 3, submittedAt: MAR, byYear: { "2026": { turnover: 100 } } }),
    ]);
    expect(index["2026"]).toMatchObject({ effectiveAt: MAR, revisionId: "app-1-c3" });
    expect(index["2027"]).toMatchObject({ effectiveAt: FEB, revisionId: "app-1-c2" });
  });

  it("revisions passed out of order are sorted by review cycle within an application", () => {
    const rows = [
      revision({ applicationId: "app-1", reviewCycle: 2, submittedAt: MAR, byYear: { "2026": { turnover: 100 } } }),
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: JAN, byYear: { "2026": { turnover: 100 } } }),
    ];
    expect(indexIssuerSubmittedFinancialYears(rows)["2026"]).toMatchObject({
      effectiveAt: JAN,
      revisionId: "app-1-c2",
    });
  });

  it("accepts Date submittedAt and returns ISO effectiveAt", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({ applicationId: "app-1", reviewCycle: 1, submittedAt: new Date(JAN), byYear: { "2026": { turnover: 1 } } }),
    ]);
    expect(index["2026"]?.effectiveAt).toBe(JAN);
  });

  it("ignores non-year keys, blocks without amounts and snapshots without application financial_statements", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({
        applicationId: "app-1",
        reviewCycle: 1,
        submittedAt: JAN,
        byYear: { "2025": { pldd: "2025-12-31" }, FY2026: { turnover: 1 }, "2026": { turnover: 2 } },
      }),
      {
        revisionId: "draft",
        applicationId: "app-2",
        reviewCycle: 1,
        submittedAt: FEB,
        snapshot: { financial_statements: { unaudited_by_year: { "2026": { turnover: 9 } } } },
      },
    ]);
    expect(Object.keys(index)).toEqual(["2026"]);
    expect(index["2026"]?.block).toEqual({ turnover: 2 });
  });

  it("CTOS is never an input: a CTOS payload inside the snapshot is ignored", () => {
    const index = indexIssuerSubmittedFinancialYears([
      revision({
        applicationId: "app-1",
        reviewCycle: 1,
        submittedAt: JAN,
        byYear: { "2026": { turnover: 100 } },
        extra: { ctos_financials: [{ financial_year: 2025, account: { turnover: 500 } }] },
      }),
    ]);
    expect(Object.keys(index)).toEqual(["2026"]);
    expect(index["2026"]?.block).toEqual({ turnover: 100 });
  });

  it("profile save vs submit: only submitted revisions count — the index takes no draft input", () => {
    expect(indexIssuerSubmittedFinancialYears.length).toBe(1);
    expect(indexIssuerSubmittedFinancialYears([])).toEqual({});
  });
});

describe("issuer-submitted index readers", () => {
  const index = indexIssuerSubmittedFinancialYears([
    revision({
      applicationId: "app-1",
      reviewCycle: 1,
      submittedAt: JAN,
      byYear: { "2024": { turnover: 1 }, "2026": { turnover: 3 }, "2025": { turnover: 2 } },
    }),
  ]);

  it("latestIssuerSubmittedFinancialYear reads by number or string", () => {
    expect(latestIssuerSubmittedFinancialYear(index, 2026)?.block).toEqual({ turnover: 3 });
    expect(latestIssuerSubmittedFinancialYear(index, "2025")?.block).toEqual({ turnover: 2 });
    expect(latestIssuerSubmittedFinancialYear(index, 2023)).toBeNull();
    expect(latestIssuerSubmittedFinancialYear(null, 2026)).toBeNull();
  });

  it("issuerFinancialProfileEntries lists newest FY first as copies", () => {
    const entries = issuerFinancialProfileEntries(index);
    expect(entries.map((entry) => entry.year)).toEqual(["2026", "2025", "2024"]);
    entries[0]!.block.turnover = 99;
    expect(index["2026"]?.block.turnover).toBe(3);
    expect(issuerFinancialProfileEntries(undefined)).toEqual([]);
  });

  it("issuerSubmittedBlocksByYear is a plain FY → block map of copies", () => {
    const blocks = issuerSubmittedBlocksByYear(index);
    expect(blocks).toEqual({
      "2024": { turnover: 1 },
      "2025": { turnover: 2 },
      "2026": { turnover: 3 },
    });
    blocks["2026"]!.turnover = 99;
    expect(index["2026"]?.block.turnover).toBe(3);
    expect(issuerSubmittedBlocksByYear(null)).toEqual({});
  });
});
