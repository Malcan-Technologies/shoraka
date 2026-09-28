import { resolveAdminFinancialReviewColumns } from "./financial-field-resolution";

function mkFinancialStatements(params: {
  financialYearEnd: string;
  unauditedByYear?: Record<string, Record<string, unknown>>;
  adminInputByYear?: Record<string, Record<string, unknown>>;
}) {
  return {
    questionnaire: { financial_year_end: params.financialYearEnd },
    unaudited_by_year: params.unauditedByYear ?? {},
    admin_input_by_year: params.adminInputByYear ?? {},
  };
}

function ctosRow(financial_year: number, account: Record<string, unknown> = { turnover: 1 }) {
  return {
    financial_year,
    dates: { pldd: `${financial_year}-12-31`, bsdd: null },
    account,
  };
}

describe("Admin Financial Summary statementType badge resolution (Admin Input only)", () => {
  // tab window years = [2025, 2026] when financial_year_end=2026-12-31 with this ref.
  const questionnaire = "2026-12-31";
  const ref = new Date("2026-03-01T00:00:00.000Z");

  it("Scenario A — Admin Input FY2025 statementType=NOT_AUDITED", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10 } },
        adminInputByYear: { "2025": { turnover: 100, statementType: "NOT_AUDITED" } },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const admin2025 = columns.find((c) => c.kind === "admin_input" && c.year === 2025);
    expect(admin2025).toBeDefined();
    expect(admin2025?.statementType).toBe("NOT_AUDITED");
  });

  it("Scenario B — Admin Input FY2025 statementType=AUDITED", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10 } },
        adminInputByYear: { "2025": { turnover: 100, statementType: "AUDITED" } },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const admin2025 = columns.find((c) => c.kind === "admin_input" && c.year === 2025);
    expect(admin2025).toBeDefined();
    expect(admin2025?.statementType).toBe("AUDITED");
  });

  it("Scenario C — User Input FY2026 statementType=AUDITED does NOT create a badge", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: {
          "2026": { turnover: 10, statementType: "AUDITED" },
        },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const user2026 = columns.find((c) => c.kind === "unaudited" && c.year === 2026);
    expect(user2026).toBeDefined();
    expect(user2026?.statementType).toBeUndefined();
  });

  it("Scenario D — User Input FY2026 statementType=NOT_AUDITED does NOT create a badge", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10, statementType: "NOT_AUDITED" } },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const user2026 = columns.find((c) => c.kind === "unaudited" && c.year === 2026);
    expect(user2026).toBeDefined();
    expect(user2026?.statementType).toBeUndefined();
  });

  it("Scenario E — CTOS FY2025: shows CTOS source only (no statementType)", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10, statementType: "AUDITED" } },
      }),
      ctosFinancials: [ctosRow(2025, { turnover: 1 })],
      ctosFetchState: "has_data",
      ref,
    });

    const ctos2025 = columns.find((c) => c.kind === "ctos" && c.year === 2025);
    expect(ctos2025).toBeDefined();
    expect(ctos2025?.statementType).toBeUndefined();
  });

  it("Scenario F — Admin Input statementType missing => keep source badge only", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10 } },
        adminInputByYear: { "2025": { turnover: 100 } }, // no statementType
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const admin2025 = columns.find((c) => c.kind === "admin_input" && c.year === 2025);
    expect(admin2025).toBeDefined();
    expect(admin2025?.statementType).toBeUndefined();
  });

  it("Scenario G — Management accounts: statementType treated as unavailable (no badge)", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10 } },
        adminInputByYear: { "2025": { turnover: 100, statementType: "MANAGEMENT_ACCOUNTS" } },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const admin2025 = columns.find((c) => c.kind === "admin_input" && c.year === 2025);
    expect(admin2025).toBeDefined();
    expect(admin2025?.statementType).toBeUndefined();
  });
});

