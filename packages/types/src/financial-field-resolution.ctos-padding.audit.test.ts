import { getEligibleAdminInputYears } from "./financial-statement-year-resolution";
import { resolveAdminFinancialReviewColumns } from "./financial-field-resolution";

function mkFinancialStatements(params: {
  financialYearEnd: string; // ISO date string e.g. 2026-12-31
  unauditedByYear: Record<string, Record<string, unknown>>;
}): unknown {
  return {
    questionnaire: { financial_year_end: params.financialYearEnd },
    unaudited_by_year: params.unauditedByYear,
    admin_input_by_year: {},
  };
}

describe("Admin Financial Summary CTOS padding audit", () => {
  it("Scenario A: only FY2026 user input => display window still pads FY2024/FY2025 (values remain missing)", () => {
    // For financial_year_end=2026-12-31:
    // - previousFYEnd=2025-12-31, deadline=2026-06-30
    // - choosing ref after deadline yields issuer/Admin tab years = [2026] (single year window)
    const ref = new Date("2026-09-24T00:00:00.000Z");
    const financialStatements = mkFinancialStatements({
      financialYearEnd: "2026-12-31",
      unauditedByYear: {
        "2026": { turnover: 10 }, // any ACCOUNT_KEYS numeric line item counts as "actual"
      },
    });

    const ctosFinancials: unknown[] = [];
    const eligibleAdminInputYears = getEligibleAdminInputYears({
      financialStatements,
      ctosFinancials,
      ref,
    });

    // Key observation: UI passes an "eligible for Admin add-year" list.
    // Even when it becomes empty (FY2026 already has issuer/user data),
    // Admin Financial Summary should still keep the 3-FY display window stable.
    expect(eligibleAdminInputYears).toEqual([]);

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      eligibleAdminInputYears,
    });

    // Restored behavior: CTOS history is only based on actual CTOS years.
    // With no CTOS rows, we must not fabricate CTOS FY2024/FY2025 columns.
    expect(columns.map((c) => c.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["ctos", "ctos", "ctos", "unaudited"]);
    expect(columns.some((c) => c.kind === "admin_fallback_placeholder")).toBe(false);
  });

  it("Scenario B: FY2025+FY2026 user input => display window pads FY2024 (values remain missing)", () => {
    // For financial_year_end=2026-12-31:
    // - deadline=2026-06-30
    // - choosing ref before deadline yields issuer/Admin tab years = [2025, 2026] (two-year window)
    const ref = new Date("2026-03-01T00:00:00.000Z");
    const financialStatements = mkFinancialStatements({
      financialYearEnd: "2026-12-31",
      unauditedByYear: {
        "2025": { turnover: 5 },
        "2026": { turnover: 10 },
      },
    });

    const ctosFinancials: unknown[] = [];
    const eligibleAdminInputYears = getEligibleAdminInputYears({
      financialStatements,
      ctosFinancials,
      ref,
    });

    expect(eligibleAdminInputYears).toEqual([]);

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      eligibleAdminInputYears,
    });

    expect(columns.map((c) => c.year)).toEqual([2023, 2024, 2025, 2025, 2026]);
    expect(columns.map((c) => c.kind)).toEqual(["ctos", "ctos", "ctos", "unaudited", "unaudited"]);
    expect(columns.some((c) => c.kind === "admin_fallback_placeholder")).toBe(false);
  });

  it("Scenario C: when CTOS has 3 actual years, the layout is fully populated and padding is irrelevant", () => {
    const ref = new Date("2026-09-24T00:00:00.000Z");
    const financialStatements = mkFinancialStatements({
      financialYearEnd: "2026-12-31",
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const ctosFinancials = [
      { financial_year: 2023, account: { turnover: 1 }, dates: { pldd: "2023-12-31", bsdd: null } },
      { financial_year: 2024, account: { turnover: 2 }, dates: { pldd: "2024-12-31", bsdd: null } },
      { financial_year: 2025, account: { turnover: 3 }, dates: { pldd: "2025-12-31", bsdd: null } },
    ];

    const eligibleAdminInputYears = getEligibleAdminInputYears({
      financialStatements,
      ctosFinancials,
      ref,
    });

    // With CTOS coverage for the available issuer years, eligible can become empty,
    // but CTOS columns still provide the 3FY slots.
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      eligibleAdminInputYears,
    });

    expect(columns.map((c) => c.year).sort((a, b) => a - b)).toEqual([2023, 2024, 2025, 2026]);
    expect(columns.filter((c) => c.kind === "ctos")).toHaveLength(3);
  });

  it("Scenario D: padded CTOS years produce CTOS-kind columns with missing (null) values when CTOS has no data", () => {
    const ref = new Date("2026-09-24T00:00:00.000Z");
    const financialStatements = mkFinancialStatements({
      financialYearEnd: "2026-12-31",
      unauditedByYear: { "2026": { turnover: 10 } },
    });

    const ctosFinancials: unknown[] = [];

    // eligibleAdminInputYears can be used for admin add/edit eligibility,
    // but padding should be driven by the display window (questionnaire + ref).
    const eligibleAdminInputYears = getEligibleAdminInputYears({
      financialStatements,
      ctosFinancials,
      ref,
    });

    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials,
      eligibleAdminInputYears,
    });

    const byYear = new Map(columns.map((c) => [c.year, c]));
    expect(columns.some((c) => c.kind === "admin_fallback_placeholder")).toBe(false);
    expect(byYear.get(2023)?.kind).toBe("ctos");
    expect(byYear.get(2024)?.kind).toBe("ctos");
    expect(byYear.get(2025)?.kind).toBe("ctos");
    expect(byYear.get(2026)?.kind).toBe("unaudited");
  });
});

