import {
  decideAdminFinancialFieldEdit,
  isAdminFinancialReviewEditLocked,
  WHOLE_YEAR_ADMIN_OPTIONAL_FINANCIAL_KEYS,
  WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS,
  resolveAdminFinancialReviewColumns,
  wholeYearAdminFinancialFieldProgress,
} from "./financial-field-resolution";

function statements(params: {
  unaudited?: Record<string, Record<string, unknown>>;
  admin?: Record<string, Record<string, unknown>>;
}) {
  return {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: params.unaudited ?? { "2026": { turnover: 10 } },
    admin_input_by_year: params.admin ?? {},
  };
}

function ctosYear(year: number, account: Record<string, unknown> = { turnover: 1 }) {
  return { financial_year: year, dates: { pldd: `${year}-12-31`, bsdd: null }, account };
}

function historical(columns: ReturnType<typeof resolveAdminFinancialReviewColumns>) {
  return columns.filter((column) => column.kind !== "unaudited");
}

describe("Admin historical FY columns", () => {
  it("column test 1: latest user FY2026 yields FY2023–FY2025", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({}),
      ctosFinancials: [],
      ctosFetchState: "not_pulled",
    });
    expect(historical(columns).map((column) => column.year)).toEqual([2023, 2024, 2025]);
  });

  it("column test 2: user FY2025 does not shift the historical window and covers its slot", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        unaudited: { "2025": { turnover: 5 }, "2026": { turnover: 10 } },
      }),
      ctosFinancials: [],
      ctosFetchState: "not_pulled",
    });
    // FY2025 has User Input and no CTOS row: the User Input lane covers it, no read-only CTOS gap.
    expect(historical(columns).map((column) => [column.year, column.kind])).toEqual([
      [2023, "ctos"],
      [2024, "ctos"],
    ]);
    expect(columns.filter((column) => column.kind === "unaudited").map((column) => column.year)).toEqual([
      2025, 2026,
    ]);
  });

  it("column test 3: CTOS not pulled has no Add statement", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({}),
      ctosFinancials: [],
      ctosFetchState: "not_pulled",
    });
    expect(historical(columns)).toHaveLength(3);
    expect(columns.some((column) => column.kind === "admin_fallback_placeholder")).toBe(false);
  });

  it("column test 4: CTOS pulled with no years allows Add on all 3 slots", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({}),
      ctosFinancials: [],
      ctosFetchState: "no_records",
    });
    expect(historical(columns).map((column) => column.kind)).toEqual([
      "admin_fallback_placeholder",
      "admin_fallback_placeholder",
      "admin_fallback_placeholder",
    ]);
  });

  it("column test 5: Admin Input replaces the historical placeholder", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        admin: { "2025": { turnover: 7, statementType: "AUDITED" } },
      }),
      ctosFinancials: [],
      ctosFetchState: "no_records",
    });
    const fy2025 = columns.filter((column) => column.year === 2025);
    expect(fy2025.map((column) => column.kind)).toEqual(["admin_input"]);
    expect(fy2025[0]?.primarySource).toBe("admin_input");
  });

  it("column test 6: CTOS replaces only the matching Admin year", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        admin: {
          "2024": { turnover: 4, statementType: "AUDITED" },
          "2025": { turnover: 5, statementType: "AUDITED" },
        },
      }),
      ctosFinancials: [ctosYear(2025)],
      ctosFetchState: "has_data",
    });
    expect(columns.find((column) => column.year === 2024)?.kind).toBe("admin_input");
    expect(columns.find((column) => column.year === 2025 && column.kind === "ctos")?.primarySource).toBe("ctos");
    expect(columns.some((column) => column.year === 2025 && column.kind === "admin_input")).toBe(false);
  });

  it("column test 7: User Input in a historical FY makes stored Admin Input inactive (not deleted)", () => {
    const financialStatements = statements({
      unaudited: { "2025": { turnover: 5 }, "2026": { turnover: 10 } },
      admin: { "2025": { turnover: 8, statementType: "NOT_AUDITED" } },
    });
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: [],
      ctosFetchState: "no_records",
    });
    expect(columns.filter((column) => column.year === 2025).map((column) => column.kind)).toEqual([
      "unaudited",
    ]);
    expect(financialStatements.admin_input_by_year["2025"]).toEqual({
      turnover: 8,
      statementType: "NOT_AUDITED",
    });
    expect(columns.some((column) => column.year === 2026 && column.kind === "unaudited")).toBe(true);
  });

  it("column test 8: later CTOS owns the historical FY and leaves User Input", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        unaudited: { "2025": { turnover: 5 }, "2026": { turnover: 10 } },
        admin: { "2025": { turnover: 8, statementType: "NOT_AUDITED" } },
      }),
      ctosFinancials: [ctosYear(2025, { turnover: null })],
      ctosFetchState: "has_data",
    });
    expect(columns.filter((column) => column.year === 2025).map((column) => column.kind)).toEqual([
      "ctos",
      "unaudited",
    ]);
    expect(columns.some((column) => column.kind === "admin_input")).toBe(false);
  });

  it("column test 9: a null-valued CTOS row still owns the year", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        admin: { "2025": { turnover: 8, statementType: "AUDITED" } },
      }),
      ctosFinancials: [
        ctosYear(2025, {
          turnover: null,
          bsfatot: null,
          cashAndBank: null,
        }),
      ],
      ctosFetchState: "has_data",
    });
    const fy2025 = columns.filter((column) => column.year === 2025);
    expect(fy2025.map((column) => column.kind)).toEqual(["ctos"]);
    expect(
      decideAdminFinancialFieldEdit({
        columns,
        financialYear: 2025,
        columnKind: "ctos",
        fieldKey: "turnover",
      })
    ).toMatchObject({ ok: true, action: "add_missing_ctos_field" });
  });

  it("field edits use year and kind when the same FY has two columns", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        unaudited: { "2025": { turnover: 5 }, "2026": { turnover: 10 } },
      }),
      ctosFinancials: [ctosYear(2025, { turnover: 3 })],
      ctosFetchState: "has_data",
    });
    expect(
      decideAdminFinancialFieldEdit({
        columns,
        financialYear: 2025,
        columnKind: "unaudited",
        fieldKey: "turnover",
      })
    ).toMatchObject({ ok: true, action: "edit_user_input" });
    expect(
      decideAdminFinancialFieldEdit({ columns, financialYear: 2025, fieldKey: "turnover" }).ok
    ).toBe(false);
  });
});

describe("Admin historical FY columns — CTOS / User Input / Admin Input cases", () => {
  // Latest User Input FY2027 → historical window FY2024–FY2026.
  const userInput = { "2026": { turnover: 90 }, "2027": { turnover: 120 } };

  function kinds(columns: ReturnType<typeof resolveAdminFinancialReviewColumns>) {
    return columns.map((column) => [column.year, column.kind]);
  }

  it("Case A: CTOS and User Input for the same FY → both columns", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({ unaudited: userInput }),
      ctosFinancials: [ctosYear(2024), ctosYear(2025), ctosYear(2026)],
      ctosFetchState: "has_data",
    });
    expect(kinds(columns)).toEqual([
      [2024, "ctos"],
      [2025, "ctos"],
      [2026, "ctos"],
      [2026, "unaudited"],
      [2027, "unaudited"],
    ]);
  });

  it("Case B: no CTOS but User Input for a window FY → User Input only; stored Admin Input inactive", () => {
    const financialStatements = statements({
      unaudited: userInput,
      admin: { "2026": { turnover: 70, statementType: "AUDITED" } },
    });
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements,
      ctosFinancials: [ctosYear(2024), ctosYear(2025)],
      ctosFetchState: "has_data",
    });
    expect(kinds(columns)).toEqual([
      [2024, "ctos"],
      [2025, "ctos"],
      [2026, "unaudited"],
      [2027, "unaudited"],
    ]);
    expect(columns.some((column) => column.kind === "admin_input")).toBe(false);
    expect(columns.some((column) => column.kind === "admin_fallback_placeholder")).toBe(false);
    expect(financialStatements.admin_input_by_year["2026"]).toEqual({
      turnover: 70,
      statementType: "AUDITED",
    });
  });

  it("Case B with CTOS not pulled: User Input covers the FY, no read-only CTOS gap", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({ unaudited: userInput }),
      ctosFinancials: [],
      ctosFetchState: "not_pulled",
    });
    expect(kinds(columns)).toEqual([
      [2024, "ctos"],
      [2025, "ctos"],
      [2026, "unaudited"],
      [2027, "unaudited"],
    ]);
  });

  it("Case C: no CTOS and no User Input → Admin Input column, else placeholder", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: statements({
        unaudited: { "2027": { turnover: 120 } },
        admin: { "2025": { turnover: 50, statementType: "AUDITED" } },
      }),
      ctosFinancials: [ctosYear(2024)],
      ctosFetchState: "has_data",
    });
    expect(kinds(columns)).toEqual([
      [2024, "ctos"],
      [2025, "admin_input"],
      [2026, "admin_fallback_placeholder"],
      [2027, "unaudited"],
    ]);
    expect(columns.find((column) => column.year === 2025)?.primarySource).toBe("admin_input");
  });
});

describe("whole-year Admin Input requiredness", () => {
  const sections = [{ id: "Equity", keys: ["bsqpuc", "equity_share_application", "equity_minority"] }];

  it("counts an empty form from the shared required keys", () => {
    const progress = wholeYearAdminFinancialFieldProgress({});
    expect(progress.requiredTotal).toBe(WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS.length);
    expect(progress.completed).toBe(0);
    expect(progress.remaining).toBe(progress.requiredTotal);
    expect(WHOLE_YEAR_ADMIN_OPTIONAL_FINANCIAL_KEYS).toEqual([
      "equity_share_application",
      "equity_share_premium",
      "equity_minority",
    ]);
    expect(WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS).toContain("pl_minority");
    expect(WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS).not.toContain("totass");
  });

  it("treats a required value as complete, including numeric 0", () => {
    const empty = wholeYearAdminFinancialFieldProgress({});
    const one = wholeYearAdminFinancialFieldProgress({ turnover: 12 });
    expect(one.completed).toBe(empty.completed + 1);
    const zero = wholeYearAdminFinancialFieldProgress({ turnover: 0 });
    expect(zero.completed).toBe(empty.completed + 1);
  });

  it("ignores optional fields and increases remaining when a required field is cleared", () => {
    const base = wholeYearAdminFinancialFieldProgress({ turnover: 1 });
    const withOptional = wholeYearAdminFinancialFieldProgress({
      turnover: 1,
      equity_share_application: 50,
    });
    expect(withOptional.completed).toBe(base.completed);
    expect(withOptional.remaining).toBe(base.remaining);
    const cleared = wholeYearAdminFinancialFieldProgress({ turnover: null });
    expect(cleared.remaining).toBe(base.remaining + 1);
  });

  it("allows save when every required field is present and optional fields are blank", () => {
    const values = Object.fromEntries(WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS.map((key) => [key, 0]));
    const progress = wholeYearAdminFinancialFieldProgress(values, sections);
    expect(progress.remaining).toBe(0);
    expect(progress.missingKeys).toEqual([]);
    expect(progress.sections[0]?.remaining).toBe(0);
  });
});

describe("financial review section edit lock", () => {
  it("is editable while the section is open", () => {
    expect(isAdminFinancialReviewEditLocked("PENDING")).toBe(false);
    expect(isAdminFinancialReviewEditLocked(null)).toBe(false);
  });

  it("locks when the section is approved", () => {
    expect(isAdminFinancialReviewEditLocked("APPROVED")).toBe(true);
  });

  it("unlocks when a financial amendment reopens the section", () => {
    expect(isAdminFinancialReviewEditLocked("AMENDMENT_REQUESTED")).toBe(false);
  });

  it("locks again after the section is approved", () => {
    expect(isAdminFinancialReviewEditLocked("APPROVED")).toBe(true);
  });

  it("stays locked when another section is amended and Financial remains approved", () => {
    expect(isAdminFinancialReviewEditLocked("APPROVED")).toBe(true);
  });
});
