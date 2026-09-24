import {
  decideAdminFinancialFieldEdit,
  resolveAdminFinancialReviewColumns,
} from "./financial-field-resolution";

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

describe("Admin Financial Summary year-column layout scenarios", () => {
  const questionnaire = "2026-12-31";
  const ref = new Date("2026-03-01T00:00:00.000Z"); // tab window years = [2025, 2026]

  it("Scenario A: CTOS FY2022-24 + user FY2026 => FY2025 Add Financial Statement placeholder", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const ctosFinancials = [ctosRow(2022, { turnover: 1 }), ctosRow(2023, { turnover: 2 }), ctosRow(2024, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    expect(columns.map((c) => c.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual([
      "ctos",
      "ctos",
      "ctos",
      "admin_fallback_placeholder",
      "unaudited",
    ]);
  });

  it("Scenario B: CTOS has 3 years + user has FY2025+FY2026 => 5 columns total", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2025": { turnover: 5 }, "2026": { turnover: 10 } },
    });

    const ctosFinancials = [ctosRow(2022, { turnover: 1 }), ctosRow(2023, { turnover: 2 }), ctosRow(2024, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    expect(columns.map((c) => c.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["ctos", "ctos", "ctos", "unaudited", "unaudited"]);
  });

  it("Scenario C: CTOS has 2 years + user FY2026 => 2 CTOS + FY2025 Add + FY2026 User Input", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const ctosFinancials = [ctosRow(2022, { turnover: 1 }), ctosRow(2023, { turnover: 2 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    // CTOS history window is always the latest CTOS FY (2023) → [2021, 2022, 2023]
    expect(columns.map((c) => c.year)).toEqual([2021, 2022, 2023, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual([
      "ctos",
      "ctos",
      "ctos",
      "admin_fallback_placeholder",
      "unaudited",
    ]);
  });

  it("Scenario D: Admin adds FY2025 => FY2025 Source is Admin Input", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
      adminInputByYear: { "2025": { turnover: 7, statementType: "MANAGEMENT_ACCOUNTS" } },
    });

    const ctosFinancials = [ctosRow(2022, { turnover: 1 }), ctosRow(2023, { turnover: 2 }), ctosRow(2024, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref });

    const fy2025 = columns.find((c) => c.year === 2025);
    expect(fy2025?.kind).toBe("admin_input");
  });

  it("Scenario E: missing CTOS field inside an actual CTOS FY still allows add_missing_ctos_field", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {},
    });

    const ctosFinancials = [
      // FY exists, but the specific field (cashAndBank) is intentionally missing from CTOS account.
      ctosRow(2024, { turnover: 123 }),
    ];

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref,
    });

    const decide = decideAdminFinancialFieldEdit({
      columns,
      financialYear: 2024,
      fieldKey: "cashAndBank",
    });

    expect(decide).toMatchObject({ ok: true, action: "add_missing_ctos_field" });
  });

  it("Scenario F: does not render a future FY Add statement when stored User Input already ends earlier", () => {
    // Repro: questionnaire suggests [2026, 2027], but stored unaudited actual years end at FY2026.
    // Admin should not offer FY2027 as an add-year placeholder yet.
    const futureQuestionnaire = "2027-03-31";
    const refSep = new Date("2026-09-24T00:00:00.000Z");

    const financialStatements = mkFinancialStatements({
      financialYearEnd: futureQuestionnaire,
      unauditedByYear: {
        "2025": { turnover: 5 },
        "2026": { turnover: 10 },
      },
    });

    const ctosFinancials = [
      ctosRow(2023, { turnover: 1 }),
      ctosRow(2024, { turnover: 2 }),
      ctosRow(2025, { turnover: 3 }),
    ];

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref: refSep,
    });

    expect(columns.some((c) => c.year === 2027 && c.kind === "admin_fallback_placeholder")).toBe(false);
    expect(columns.some((c) => c.year === 2027)).toBe(false);
  });

  it("Scenario G: future FY beyond stored User Input max year is fully suppressed", () => {
    const farFutureQuestionnaire = "2028-03-31";
    const refSep = new Date("2026-09-24T00:00:00.000Z");

    const financialStatements = mkFinancialStatements({
      financialYearEnd: farFutureQuestionnaire,
      unauditedByYear: {
        "2025": { turnover: 5 },
        "2026": { turnover: 10 },
      },
    });

    const ctosFinancials = [
      ctosRow(2023, { turnover: 1 }),
      ctosRow(2024, { turnover: 2 }),
      ctosRow(2025, { turnover: 3 }),
    ];

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref: refSep,
    });

    expect(columns.some((c) => c.year === 2027)).toBe(false);
    expect(columns.some((c) => c.year === 2028)).toBe(false);
  });
});

