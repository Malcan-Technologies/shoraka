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

describe("Admin Financial Summary statementType badge resolution", () => {
  // tab window years = [2025, 2026] when financial_year_end=2026-12-31 with this ref.
  const questionnaire = "2026-12-31";
  const ref = new Date("2026-03-01T00:00:00.000Z");

  it("Scenario A — Admin Input FY2025 renders NOT_AUDITED badge", () => {
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

  it("Scenario B — User Input FY2026 renders AUDITED badge", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10, statementType: "AUDITED" } },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const user2026 = columns.find((c) => c.kind === "unaudited" && c.year === 2026);
    expect(user2026).toBeDefined();
    expect(user2026?.statementType).toBe("AUDITED");
  });

  it("Scenario C — Same FY has CTOS + User Input: each column keeps its own identity", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: {
          "2025": { turnover: 5, statementType: "AUDITED" },
          "2026": { turnover: 10 },
        },
      }),
      ctosFinancials: [ctosRow(2025, { turnover: 1 })],
      ctosFetchState: "has_data",
      ref,
    });

    const ctos2025 = columns.find((c) => c.kind === "ctos" && c.year === 2025);
    expect(ctos2025).toBeDefined();
    expect(ctos2025?.statementType).toBeUndefined();

    const user2025 = columns.find((c) => c.kind === "unaudited" && c.year === 2025);
    expect(user2025).toBeDefined();
    expect(user2025?.statementType).toBe("AUDITED");
  });

  it("Scenario D — statementType missing: keep only the source badge", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: mkFinancialStatements({
        financialYearEnd: questionnaire,
        unauditedByYear: { "2026": { turnover: 10 } }, // no statementType
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
      ref,
    });

    const user2026 = columns.find((c) => c.kind === "unaudited" && c.year === 2026);
    expect(user2026).toBeDefined();
    expect(user2026?.statementType).toBeUndefined();
  });

  it("Scenario E — Management accounts: statementType treated as unavailable (no badge)", () => {
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

