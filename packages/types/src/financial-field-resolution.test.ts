import {
  decideAdminFinancialFieldEdit,
  financialFieldSourceBadge,
  reconcileAdminFieldOverridesAfterIssuerSave,
  receivablesDaysUnavailableReason,
  resolveAdminFinancialReviewColumns,
} from "./financial-field-resolution";

const ctos2024 = {
  financial_year: 2024,
  dates: { pldd: "2024-12-31", bsdd: null },
  account: { turnover: 9360000, tradeReceivables: 100 },
};

describe("resolveAdminFinancialReviewColumns", () => {
  it("sorts years chronologically and keeps a missing FY in position", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {
        unaudited_by_year: { "2026": { turnover: 10 } },
      },
      ctosFinancials: [
        { financial_year: 2023, account: { turnover: 1 } },
        { financial_year: 2024, account: { turnover: 2 } },
      ],
      eligibleAdminInputYears: [2025],
    });
    expect(columns.map((column) => [column.year, column.kind])).toEqual([
      [2023, "ctos"],
      [2024, "ctos"],
      [2025, "admin_fallback_placeholder"],
      [2026, "unaudited"],
    ]);
  });

  it("keeps a stable 3-FY layout by padding missing CTOS FYs when CTOS has no data", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: { unaudited_by_year: {} },
      ctosFinancials: [],
      eligibleAdminInputYears: [2025, 2026],
    });

    expect(columns.map((column) => [column.year, column.kind])).toEqual([
      [2024, "ctos"],
      [2025, "admin_fallback_placeholder"],
      [2026, "admin_fallback_placeholder"],
    ]);
  });

  it("allows Admin to add missing CTOS raw fields for padded CTOS FYs", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: { unaudited_by_year: {} },
      ctosFinancials: [],
      eligibleAdminInputYears: [2026],
    });

    const padded = columns.find((c) => c.year === 2024);
    expect(padded?.primarySource).toBe("ctos");

    expect(
      decideAdminFinancialFieldEdit({
        columns,
        financialYear: 2024,
        fieldKey: "cashAndBank",
      })
    ).toMatchObject({ ok: true, action: "add_missing_ctos_field" });
  });

  it("keeps one CTOS column when User Input overlaps that FY", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {
        unaudited_by_year: { "2024": { turnover: 1, cashAndBank: 50 } },
      },
      ctosFinancials: [ctos2024],
    });
    expect(columns).toHaveLength(1);
    expect(columns[0]?.primarySource).toBe("ctos");
    expect(columns[0]?.fields.turnover).toMatchObject({ value: 9360000, source: "ctos", readOnly: true });
    expect(columns[0]?.fields.cashAndBank.value).toBeNull();
  });

  it("lets Admin fill a missing CTOS raw field without changing the year source", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {
        admin_field_overrides: {
          "2024": {
            cashAndBank: {
              value: 500000,
              baseSource: "ctos",
              action: "add_missing_ctos_field",
              updated_by_user_id: "admin",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
            turnover: {
              value: 1,
              baseSource: "ctos",
              action: "add_missing_ctos_field",
              updated_by_user_id: "admin",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        },
      },
      ctosFinancials: [ctos2024],
    });
    const year = columns[0]!;
    expect(year.primarySource).toBe("ctos");
    expect(year.fields.cashAndBank).toMatchObject({ value: 500000, source: "admin_input" });
    expect(financialFieldSourceBadge(year.fields.cashAndBank)).toBe("Admin Input");
    expect(year.fields.turnover.value).toBe(9360000);
    expect(year.fields.turnover.readOnly).toBe(true);
  });

  it("keeps User Input provenance when Admin edits an issuer value", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {
        unaudited_by_year: { "2026": { turnover: 10 } },
        admin_field_overrides: {
          "2026": {
            turnover: {
              value: 12,
              baseSource: "user_input",
              action: "edit_user_input",
              updated_by_user_id: "admin",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        },
      },
      ctosFinancials: [],
    });
    const field = columns[0]?.fields.turnover;
    expect(field).toMatchObject({ value: 12, source: "user_input", editedByAdmin: true });
    expect(financialFieldSourceBadge(field!)).toBe("User Input · Edited by Admin");
  });

  it("rejects calculated keys and present CTOS values", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {},
      ctosFinancials: [ctos2024],
    });
    expect(
      decideAdminFinancialFieldEdit({ columns, financialYear: 2024, fieldKey: "receivablesDays" }).ok
    ).toBe(false);
    expect(
      decideAdminFinancialFieldEdit({ columns, financialYear: 2024, fieldKey: "turnover" })
    ).toMatchObject({ ok: false, code: "CTOS_FIELD_READONLY" });
    expect(
      decideAdminFinancialFieldEdit({ columns, financialYear: 2024, fieldKey: "cashAndBank" })
    ).toMatchObject({ ok: true, action: "add_missing_ctos_field" });
  });

  it("preserves CTOS ComRep extras (bsqres/bsqupro/bsqmint/plminin) into admin raw keys", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {},
      ctosFinancials: [
        {
          financial_year: 2024,
          account: {
            bsqres: 100_000,
            bsqupro: 200_000,
            bsqmint: 300_000,
            plminin: 400_000,
          },
        },
      ],
    });

    expect(columns).toHaveLength(1);
    const year = columns[0]!;
    expect(year.primarySource).toBe("ctos");

    expect(year.fields.equity_share_premium).toMatchObject({
      value: 100_000,
      source: "ctos",
      readOnly: true,
    });
    expect(year.fields.equity_accumulated_profit).toMatchObject({
      value: 200_000,
      source: "ctos",
      readOnly: true,
    });
    expect(year.fields.equity_minority).toMatchObject({
      value: 300_000,
      source: "ctos",
      readOnly: true,
    });
    expect(year.fields.pl_minority).toMatchObject({
      value: 400_000,
      source: "ctos",
      readOnly: true,
    });
  });

  it("marks CTOS ComRep extras as read-only for zero and negative values", () => {
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: {},
      ctosFinancials: [
        {
          financial_year: 2024,
          account: {
            bsqres: 0,
            bsqupro: 0,
            bsqmint: 0,
            plminin: -8_975_580,
          },
        },
      ],
    });

    const year = columns[0]!;
    expect(year.primarySource).toBe("ctos");
    expect(year.fields.equity_share_premium).toMatchObject({ value: 0, source: "ctos", readOnly: true });
    expect(year.fields.equity_accumulated_profit).toMatchObject({ value: 0, source: "ctos", readOnly: true });
    expect(year.fields.equity_minority).toMatchObject({ value: 0, source: "ctos", readOnly: true });
    expect(year.fields.pl_minority).toMatchObject({ value: -8_975_580, source: "ctos", readOnly: true });

    expect(decideAdminFinancialFieldEdit({ columns, financialYear: 2024, fieldKey: "equity_share_premium" })).toMatchObject(
      { ok: false, code: "CTOS_FIELD_READONLY" }
    );
    expect(decideAdminFinancialFieldEdit({ columns, financialYear: 2024, fieldKey: "pl_minority" })).toMatchObject(
      { ok: false, code: "CTOS_FIELD_READONLY" }
    );
  });

  it("explains missing prior Trade Receivables for Receivables Days", () => {
    expect(
      receivablesDaysUnavailableReason({
        year: 2025,
        endingTradeReceivables: 10,
        priorTradeReceivables: null,
        turnover: 100,
      })
    ).toBe("Unable to calculate — previous year Trade Receivables unavailable");
  });

  it("preserves add_missing_ctos_field overrides when issuer edits a different user-input field", () => {
    const existingFinancialStatements = {
      admin_field_overrides: {
        "2025": {
          // This one should be removed when issuer changes the underlying user-input value.
          turnover: {
            value: 12,
            baseSource: "user_input",
            action: "edit_user_input",
            updated_by_user_id: "admin",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          // This one must stay because it's an Admin-supplied CTOS gap fill.
          cashAndBank: {
            value: 500000,
            baseSource: "ctos",
            action: "add_missing_ctos_field",
            updated_by_user_id: "admin",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    };

    const previousUnauditedByYear = {
      "2025": {
        turnover: 12,
      },
    };

    const nextUnauditedByYear = {
      "2025": {
        // issuer edited turnover → override should not be kept
        turnover: 13,
      },
    };

    const reconciled = reconcileAdminFieldOverridesAfterIssuerSave({
      existingFinancialStatements,
      previousUnauditedByYear: previousUnauditedByYear,
      nextUnauditedByYear,
    });

    expect(reconciled).toEqual({
      "2025": {
        cashAndBank: expect.objectContaining({
          value: 500000,
          action: "add_missing_ctos_field",
        }),
      },
    });
  });
});
