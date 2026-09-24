/**
 * Prospectus FY source order: reviewed User Input → CTOS + gap-fills → active Admin Input → blank.
 * Profile / new-application prefill is a different order and is not covered here.
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { buildProspectusPageThree } from "./prospectus-page-three-mapper";
import { buildProspectusPageTwo } from "./prospectus-page-two-mapper";
import { buildProspectusPage2FinancialComparisonSnapshot } from "./prospectus-page-two-snapshot";
import { withProspectusThreeYearDisplay } from "./prospectus-three-year-display";

const AFTER_DEADLINE = new Date("2026-09-25T00:00:00.000Z");

function ctosRow(
  year: number,
  account: Record<string, number | null>
) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null },
    account,
  };
}

function sourceFor(params: {
  unaudited?: Record<string, Record<string, unknown>>;
  admin?: Record<string, Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  ctos?: ReturnType<typeof ctosRow>[];
  ref?: Date;
}) {
  return buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: params.unaudited ?? {},
      admin_input_by_year: params.admin ?? {},
      admin_field_overrides: params.overrides ?? {},
    },
    ctosFinancials: params.ctos ?? [],
    ref: params.ref ?? AFTER_DEADLINE,
  });
}

describe("prospectus financial source fallback", () => {
  it("Scenario A: reviewed User Input wins over CTOS and Admin Input", () => {
    const data = sourceFor({
      unaudited: { "2025": { turnover: 10, tradeReceivables: 10, pldd: "2025-12-31" } },
      admin: { "2025": { turnover: 77, tradeReceivables: 77, pldd: "2025-12-31" } },
      ctos: [ctosRow(2025, { turnover: 99, tradeReceivables: 99 })],
    });
    const fy = data.years.find((year) => year.year === 2025);
    expect(fy?.recordSource).toBe("unaudited_management");
    expect(fy?.rawFinancials.tradeReceivables).toBe(10);
    expect(fy?.rawFinancials.turnover).toBe(10);
  });

  it("Scenario B: CTOS wins over stored Admin Input when User Input is absent", () => {
    const data = sourceFor({
      admin: { "2025": { turnover: 77, tradeReceivables: 77, pldd: "2025-12-31" } },
      ctos: [ctosRow(2025, { turnover: 99, tradeReceivables: 40 })],
    });
    const fy = data.years.find((year) => year.year === 2025);
    expect(fy?.recordSource).toBe("ctos_audited");
    expect(fy?.rawFinancials.turnover).toBe(99);
    expect(fy?.rawFinancials.tradeReceivables).toBe(40);
  });

  it("Scenario C: active Admin Input is used when User Input and CTOS are absent", () => {
    const data = sourceFor({
      admin: {
        "2025": {
          turnover: 5_000_000,
          plnpbt: 100,
          interest_cost: 20,
          statementType: "AUDITED",
          pldd: "2025-12-31",
        },
      },
    });
    const fy = data.years.find((year) => year.year === 2025);
    expect(data.years.map((year) => year.year)).toEqual([2025]);
    expect(fy?.recordSource).toBe("admin_input");
    expect(fy?.statementType).toBe("AUDITED");
    expect(fy?.rawFinancials.turnover).toBe(5_000_000);
    expect(fy?.rawFinancials.ebit).toBe(120);
  });

  it("Scenario D: a year with no User Input, CTOS, or Admin Input stays blank", () => {
    const data = sourceFor({
      unaudited: { "2026": { turnover: 5_000_000, pldd: "2026-12-31" } },
    });
    expect(data.years.map((year) => year.year)).toEqual([2026]);
    const display = withProspectusThreeYearDisplay(data);
    expect(display.years.map((year) => year.year)).toEqual([2024, 2025, 2026]);
    expect(display.years.find((year) => year.year === 2025)?.isPlaceholder).toBe(true);
    expect(display.years.find((year) => year.year === 2025)?.rawFinancials).toEqual({});
  });

  it("Scenario E: a later CTOS year supersedes stored Admin Input, including a null-amount CTOS row", () => {
    const withAmounts = sourceFor({
      admin: { "2025": { turnover: 77, pldd: "2025-12-31" } },
      ctos: [ctosRow(2025, { turnover: 40 })],
    });
    expect(withAmounts.years.find((year) => year.year === 2025)?.recordSource).toBe("ctos_audited");
    expect(withAmounts.years.find((year) => year.year === 2025)?.rawFinancials.turnover).toBe(40);

    const nullAmounts = sourceFor({
      admin: { "2025": { turnover: 77, tradeReceivables: 12, pldd: "2025-12-31" } },
      ctos: [ctosRow(2025, { turnover: null, tradeReceivables: null })],
      overrides: {
        "2025": {
          tradeReceivables: {
            value: 8,
            baseSource: "ctos",
            action: "add_missing_ctos_field",
            updated_by_user_id: "admin",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    });
    const fy = nullAmounts.years.find((year) => year.year === 2025);
    expect(fy?.recordSource).toBe("ctos_audited");
    expect(fy?.rawFinancials.turnover).not.toBe(77);
    expect(fy?.rawFinancials.tradeReceivables).toBe(8);
  });

  it("Scenario F: Admin edit_user_input is the reviewed User Input value", () => {
    const data = sourceFor({
      unaudited: { "2025": { turnover: 10, tradeReceivables: 10, pldd: "2025-12-31" } },
      admin: { "2025": { turnover: 77, tradeReceivables: 77, pldd: "2025-12-31" } },
      ctos: [ctosRow(2025, { turnover: 99, tradeReceivables: 99 })],
      overrides: {
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
    });
    const fy = data.years.find((year) => year.year === 2025);
    expect(fy?.recordSource).toBe("unaudited_management");
    expect(fy?.rawFinancials.tradeReceivables).toBe(12);
    expect(fy?.rawFinancials.turnover).toBe(10);
  });

  it("Scenario G: latest three include Admin-Input-only years outside the SSM window", () => {
    const data = sourceFor({
      unaudited: { "2026": { turnover: 9_000_000, pldd: "2026-12-31" } },
      admin: {
        "2024": { turnover: 4_000_000, pldd: "2024-12-31", statementType: "NOT_AUDITED" },
        "2025": { turnover: 5_000_000, pldd: "2025-12-31", statementType: "AUDITED" },
      },
    });
    expect(data.years.map((year) => year.year)).toEqual([2024, 2025, 2026]);
    expect(data.years.map((year) => year.recordSource)).toEqual([
      "admin_input",
      "admin_input",
      "unaudited_management",
    ]);
    expect(data.years.find((year) => year.year === 2024)?.rawFinancials.turnover).toBe(4_000_000);
    expect(data.years.find((year) => year.year === 2025)?.rawFinancials.turnover).toBe(5_000_000);
    expect(data.years.find((year) => year.year === 2026)?.rawFinancials.turnover).toBe(9_000_000);
  });

  it("shows FY2025 Admin Input in every live Prospectus financial table when FY2024 has no source", () => {
    const financialStatements = {
      questionnaire: { financial_year_end: "2026-12-31" },
      unaudited_by_year: {
        "2026": { turnover: 6_000_000, plnpat: 600_000, pldd: "2026-12-31" },
      },
      admin_input_by_year: {
        "2023": { turnover: 3_000_000, plnpat: 300_000, pldd: "2023-12-31" },
        "2025": { turnover: 5_000_000, plnpat: 500_000, pldd: "2025-12-31" },
      },
    };
    const live = {
      noteId: "n-admin-fallback",
      isPublished: false,
      financialMode: "live_unpublished_preview" as const,
      issuerSnapshot: { name: "Co" },
      invoiceSnapshot: {},
      paymasterSnapshot: {},
      liveFinancialStatements: financialStatements,
      liveCtosFinancials: [],
      frozenFinancialComparison: null,
    };
    const page2 = buildProspectusPageTwo({
      ...live,
      noteReference: "N-ADMIN",
      maturityDate: null,
    });
    const page3 = buildProspectusPageThree(live);

    expect(page2.financialComparisonSource.years.map((year) => year.year)).toEqual([
      2024, 2025, 2026,
    ]);
    expect(page2.financialComparisonSource.years.map((year) => year.isPlaceholder === true)).toEqual([
      true, false, false,
    ]);
    expect(page2.financialComparisonSource.years.find((year) => year.year === 2025)?.recordSource).toBe(
      "admin_input"
    );
    expect(
      page2.financialComparisonSource.years.find((year) => year.year === 2025)?.rawFinancials.turnover
    ).toBe(5_000_000);

    const revenue = page2.financialComparisonMetrics.rows.find((row) => row.key === "revenue");
    expect(revenue?.values).toEqual(["—", "5", "6"]);

    expect(page3.incomeStatement.years.map((year) => year.year)).toEqual([2024, 2025, 2026]);
    expect(page3.balanceSheet.years.map((year) => year.year)).toEqual([2024, 2025, 2026]);
    expect(page3.coverageEfficiency.years.map((year) => year.year)).toEqual([2024, 2025, 2026]);
    expect(page3.incomeStatement.rows.find((row) => row.key === "revenue")?.values).toEqual([
      "—",
      "5",
      "6",
    ]);
    expect(page3.balanceSheet.years.map((year) => year.isPlaceholder === true)).toEqual([
      true,
      false,
      false,
    ]);
    expect(page3.coverageEfficiency.years.map((year) => year.isPlaceholder === true)).toEqual([
      true,
      false,
      false,
    ]);

    const frozen = buildProspectusPage2FinancialComparisonSnapshot({
      financialStatements,
      ctosFinancials: [],
      now: AFTER_DEADLINE,
    });
    expect(frozen.selected_years.map((year) => year.year)).toEqual([2023, 2025, 2026]);
    expect(frozen.selected_years.find((year) => year.year === 2025)?.record_source).toBe("admin_input");
    expect(frozen.selected_years.find((year) => year.year === 2025)?.raw_financials.turnover).toBe(
      5_000_000
    );

    const published = buildProspectusPageTwo({
      ...live,
      noteReference: "N-ADMIN",
      maturityDate: null,
      isPublished: true,
      financialMode: "frozen_publication_snapshot",
      liveFinancialStatements: {
        ...financialStatements,
        admin_input_by_year: {
          "2025": { turnover: 1, pldd: "2025-12-31" },
        },
      },
      frozenFinancialComparison: frozen,
    });
    expect(
      published.financialComparisonSource.years.find((year) => year.year === 2025)?.rawFinancials
        .turnover
    ).toBe(5_000_000);
  });
});
