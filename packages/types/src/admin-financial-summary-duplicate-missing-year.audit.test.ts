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

function ctosRow(financial_year: number, account: Record<string, unknown>) {
  return {
    financial_year,
    dates: { pldd: `${financial_year}-12-31`, bsdd: null },
    account,
  };
}

describe("Admin Financial Summary duplicate & missing-year audit", () => {
  // financial_year_end=2026-12-31:
  // ref before 2026-06-30 => issuer/Admin tab years = [2025, 2026]
  const questionnaire = "2026-12-31";
  const ref = new Date("2026-03-01T00:00:00.000Z");

  it("Scenario 1: CTOS FY2025 + User FY2025 => show FY2025 only once (CTOS wins)", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {
        "2025": { turnover: 10 },
        "2026": { turnover: 20 },
      },
    });

    const ctosFinancials = [ctosRow(2025, { turnover: 1 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });
    const fy2025 = columns.filter((c) => c.year === 2025);
    expect(fy2025).toHaveLength(2);
    expect(fy2025[0]!.kind).toBe("ctos");
    expect(fy2025[1]!.kind).toBe("unaudited");
  });

  it("Scenario 2: CTOS FY2024 + user FY2025 => show FY2025 as User Input (no Add placeholder FY2025)", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {
        "2025": { turnover: 10 },
        "2026": { turnover: 20 },
      },
    });

    const ctosFinancials = [ctosRow(2024, { turnover: 1 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    const fy2025Kinds = columns.filter((c) => c.year === 2025).map((c) => c.kind).sort();
    expect(fy2025Kinds).toEqual(["admin_fallback_placeholder", "unaudited"]);
  });

  it("Scenario 3: CTOS FY2024 + missing FY2025 + user FY2026 => FY2025 renders Add Financial Statement placeholder", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {
        "2026": { turnover: 20 },
      },
    });

    const ctosFinancials = [ctosRow(2024, { turnover: 1 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    const fy2025 = columns.find((c) => c.year === 2025);
    expect(fy2025?.kind).toBe("admin_fallback_placeholder");
  });

  it("Scenario 4: admin_input_by_year FY2025 exists => show FY2025 once as Admin Input (no Add placeholder)", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {
        "2026": { turnover: 20 },
      },
      adminInputByYear: {
        "2025": { turnover: 7, statementType: "MANAGEMENT_ACCOUNTS" },
      },
    });

    const ctosFinancials = [ctosRow(2024, { turnover: 1 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    const fy2025Kinds = columns.filter((c) => c.year === 2025).map((c) => c.kind);
    expect(fy2025Kinds).toEqual(["admin_input"]);
    expect(columns.some((c) => c.year === 2025 && c.kind === "admin_fallback_placeholder")).toBe(false);
  });
});

