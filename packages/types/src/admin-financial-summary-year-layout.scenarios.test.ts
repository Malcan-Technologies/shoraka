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

  const expectReadOnlyMissingCtos = (
    columns: ReturnType<typeof resolveAdminFinancialReviewColumns>,
    year: number
  ) => {
    const col = columns.find((c) => c.year === year && c.kind === "ctos");
    expect(col).toBeDefined();
    expect(col!.fields.turnover.readOnly).toBe(true);
  };

  it("Scenario A — No CTOS history: always show 3 historical FY slots with no Add Financial Statement", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: [],
      ref,
      ctosFetchState: "not_pulled",
    });

    expect(columns.map((c) => c.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["ctos", "ctos", "ctos", "unaudited"]);
    expect(columns.some((c) => c.kind === "admin_fallback_placeholder")).toBe(false);

    expectReadOnlyMissingCtos(columns, 2023);
    expectReadOnlyMissingCtos(columns, 2024);
    expectReadOnlyMissingCtos(columns, 2025);
  });

  it("Scenario B — Partial CTOS history: allow Add Financial Statement for the missing historical CTOS FY", () => {
    // Eligibility must include FY2023. Choose a questionnaire/ref that yields tab years [2023, 2024].
    const financialStatements = mkFinancialStatements({
      financialYearEnd: "2024-12-31",
      unauditedByYear: { "2026": { turnover: 10 } },
    });
    const refForEligibility = new Date("2024-03-01T00:00:00.000Z");

    const ctosFinancials = [ctosRow(2024, { turnover: 2 }), ctosRow(2025, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref: refForEligibility,
      ctosFetchState: "has_data",
    });

    expect(columns.map((c) => c.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["admin_fallback_placeholder", "ctos", "ctos", "unaudited"]);
  });

  it("Scenario B — Partial CTOS history (FY2024 only): allow Add for missing FY2023 and FY2025", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: "2024-12-31",
      unauditedByYear: { "2026": { turnover: 10 } },
    });
    const refForEligibility = new Date("2024-03-01T00:00:00.000Z");

    const ctosFinancials = [ctosRow(2024, { turnover: 2 })];

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref: refForEligibility,
      ctosFetchState: "has_data",
      eligibleAdminInputYears: [2023, 2024, 2025, 2027],
    });

    expect(columns.map((c) => [c.year, c.kind])).toEqual([
      [2023, "admin_fallback_placeholder"],
      [2024, "ctos"],
      [2025, "admin_fallback_placeholder"],
      [2026, "unaudited"],
    ]);
  });

  it("Scenario B — CTOS fetched but returned zero financial years: allow Add for historical FYs", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: [],
      ref,
      ctosFetchState: "no_records",
      eligibleAdminInputYears: [2023, 2024, 2025, 2027],
    });

    expect(columns.map((c) => [c.year, c.kind])).toEqual([
      [2023, "admin_fallback_placeholder"],
      [2024, "admin_fallback_placeholder"],
      [2025, "admin_fallback_placeholder"],
      [2026, "unaudited"],
    ]);
  });

  it("Scenario C — Full CTOS history: no Add Financial Statement when the 3 historical CTOS FY slots are complete", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const ctosFinancials = [ctosRow(2023, { turnover: 1 }), ctosRow(2024, { turnover: 2 }), ctosRow(2025, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref, ctosFetchState: "has_data" });

    expect(columns.map((c) => c.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["ctos", "ctos", "ctos", "unaudited"]);
    expect(columns.some((c) => c.kind === "admin_fallback_placeholder")).toBe(false);
  });

  it("Scenario D — Same FY CTOS + User Input: show BOTH without dedupe", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {
        "2025": { turnover: 5 },
        "2026": { turnover: 10 },
      },
    });

    const ctosFinancials = [ctosRow(2023, { turnover: 1 }), ctosRow(2024, { turnover: 2 }), ctosRow(2025, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref, ctosFetchState: "has_data" });

    // FY2025 must have both:
    // - CTOS column (kind=ctos)
    // - User Input column (kind=unaudited)
    expect(columns.filter((c) => c.year === 2025).map((c) => c.kind).sort()).toEqual(["ctos", "unaudited"]);
    // Historical window is always FY2023–FY2025 when latest user input is FY2026.
    expect(columns.some((c) => c.year === 2027)).toBe(false);
  });

  it("Scenario H — CTOS replaces historical Admin Input as the active source (old Admin Input preserved but hidden)", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: {
        "2026": { turnover: 10 },
      },
      adminInputByYear: {
        "2025": { turnover: 999, statementType: "MANAGEMENT_ACCOUNTS" },
      },
    });

    const ctosFinancials = [ctosRow(2025, { turnover: 3 })];

    const columns = resolveAdminFinancialReviewColumns({ financialStatements, ctosFinancials, ref, ctosFetchState: "has_data" });

    // Historical window is always FY2023–FY2025 when latest user input is FY2026.
    expect(columns.map((c) => c.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["ctos", "ctos", "ctos", "unaudited"]);

    // Admin Input FY2025 must stop being shown as an active column once CTOS provides that FY.
    expect(columns.some((c) => c.year === 2025 && c.kind === "admin_input")).toBe(false);
  });

  it("Scenario E: missing CTOS field inside an actual CTOS FY still allows add_missing_ctos_field", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 1 } },
    });

    const ctosFinancials = [
      // FY exists, but the specific field (cashAndBank) is intentionally missing from CTOS account.
      ctosRow(2024, { turnover: 123 }),
    ];

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      ref,
      ctosFetchState: "has_data",
    });

    const decide = decideAdminFinancialFieldEdit({
      columns,
      financialYear: 2024,
      fieldKey: "cashAndBank",
    });

    expect(decide).toMatchObject({ ok: true, action: "add_missing_ctos_field" });

    const turnoverDecision = decideAdminFinancialFieldEdit({
      columns,
      financialYear: 2024,
      fieldKey: "turnover",
    });
    expect(turnoverDecision).toMatchObject({ ok: false, code: "CTOS_FIELD_READONLY" });
  });

  it("Scenario F — CTOS value 0 is treated as a real CTOS value (read-only)", () => {
    const financialStatements = mkFinancialStatements({
      financialYearEnd: questionnaire,
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: [ctosRow(2024, { bsqres: 0 })],
      ref,
      ctosFetchState: "has_data",
    });

    const decision = decideAdminFinancialFieldEdit({
      columns,
      financialYear: 2024,
      fieldKey: "equity_share_premium",
    });

    expect(decision).toMatchObject({ ok: false, code: "CTOS_FIELD_READONLY" });
  });

  it("Scenario E — No future add-year: do not render FY2027 Add Financial Statement", () => {
    const futureQuestionnaire = "2027-03-31";
    const refSep = new Date("2026-09-24T00:00:00.000Z");

    const financialStatements = mkFinancialStatements({
      financialYearEnd: futureQuestionnaire,
      unauditedByYear: {
        "2026": { turnover: 10 },
      },
    });

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: [],
      ref: refSep,
      ctosFetchState: "no_records",
      eligibleAdminInputYears: [2023, 2024, 2025, 2027],
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

