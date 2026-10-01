/**
 * SECTION: Admin field override slots
 * WHY: One FY can have a CTOS column and a User Input column. A CTOS gap-fill and a User Input
 * edit of the same field must not overwrite each other. Legacy single-entry JSON must still read.
 */

import {
  parseAdminFieldOverrideEntry,
  parseAdminFieldOverrides,
  reconcileAdminFieldOverridesAfterIssuerSave,
  resolveAdminFinancialReviewColumns,
  setAdminFieldOverride,
  type AdminFieldOverride,
} from "./financial-field-resolution";

const AT = "2026-09-01T00:00:00.000Z";

function gap(value: number | string | null): AdminFieldOverride {
  return {
    value,
    baseSource: "ctos",
    action: "add_missing_ctos_field",
    updated_by_user_id: "admin-1",
    updated_at: AT,
  };
}

function userEdit(value: number | string | null): AdminFieldOverride {
  return {
    value,
    baseSource: "user_input",
    action: "edit_user_input",
    updated_by_user_id: "admin-1",
    updated_at: AT,
  };
}

function adminEdit(value: number): AdminFieldOverride {
  return {
    value,
    baseSource: "admin_input",
    action: "edit_admin_input",
    updated_by_user_id: "admin-1",
    updated_at: AT,
  };
}

/** Apply writes in order, the same way the API stores them. */
function writeAll(
  base: Record<string, unknown>,
  writes: Array<{ year: string; fieldKey: string; override: AdminFieldOverride }>
): Record<string, unknown> {
  let fs: Record<string, unknown> = { ...base };
  for (const write of writes) {
    fs = { ...fs, admin_field_overrides: setAdminFieldOverride(fs, write) };
  }
  return fs;
}

describe("parseAdminFieldOverrideEntry", () => {
  it("reads a legacy entry as a single-action slot only", () => {
    const parsed = parseAdminFieldOverrideEntry(gap(100));
    expect(parsed).toEqual({ slot: { add_missing_ctos_field: gap(100) }, legacy: true });
    expect(Object.keys(parsed!.slot)).toEqual(["add_missing_ctos_field"]);
  });

  it("reads a new-shape entry with both actions", () => {
    const parsed = parseAdminFieldOverrideEntry({
      add_missing_ctos_field: gap(100),
      edit_user_input: userEdit(120),
    });
    expect(parsed).toEqual({
      slot: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) },
      legacy: false,
    });
  });

  it("ignores an invalid baseSource (legacy and new)", () => {
    expect(parseAdminFieldOverrideEntry({ ...gap(100), baseSource: "org" })).toBeNull();
    expect(parseAdminFieldOverrideEntry({ ...gap(100), action: "unknown" })).toBeNull();
    expect(
      parseAdminFieldOverrideEntry({
        add_missing_ctos_field: { ...gap(100), baseSource: "org" },
        edit_user_input: userEdit(120),
      })
    ).toEqual({ slot: { edit_user_input: userEdit(120) }, legacy: false });
    expect(parseAdminFieldOverrideEntry({ add_missing_ctos_field: { value: 1 } })).toBeNull();
    expect(parseAdminFieldOverrideEntry(null)).toBeNull();
    expect(parseAdminFieldOverrideEntry([gap(1)])).toBeNull();
  });

  it("lets the action key win over a mismatching inner action", () => {
    const parsed = parseAdminFieldOverrideEntry({
      edit_user_input: { ...gap(100), baseSource: "user_input" },
    });
    expect(parsed?.slot.edit_user_input?.action).toBe("edit_user_input");
    expect(parsed?.slot.add_missing_ctos_field).toBeUndefined();
  });

  it("keeps 0 as a real value", () => {
    expect(parseAdminFieldOverrideEntry(gap(0))?.slot.add_missing_ctos_field?.value).toBe(0);
  });
});

describe("parseAdminFieldOverrides", () => {
  it("reads legacy and new entries mixed in one year and drops empty fields / years", () => {
    const parsed = parseAdminFieldOverrides({
      admin_field_overrides: {
        "2026": {
          cashAndBank: gap(5),
          tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) },
          turnover: { ...gap(1), baseSource: "bad" },
        },
        "2025": { turnover: { ...gap(1), baseSource: "bad" } },
        "2024": "not-a-record",
      },
    });
    expect(parsed).toEqual({
      "2026": {
        cashAndBank: { add_missing_ctos_field: gap(5) },
        tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) },
      },
    });
  });
});

describe("setAdminFieldOverride", () => {
  it("gap 100 then user 120 keeps both", () => {
    const fs = writeAll({}, [
      { year: "2026", fieldKey: "tradeReceivables", override: gap(100) },
      { year: "2026", fieldKey: "tradeReceivables", override: userEdit(120) },
    ]);
    expect(fs.admin_field_overrides).toEqual({
      "2026": { tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) } },
    });
  });

  it("user 120 then gap 100 keeps both", () => {
    const fs = writeAll({}, [
      { year: "2026", fieldKey: "tradeReceivables", override: userEdit(120) },
      { year: "2026", fieldKey: "tradeReceivables", override: gap(100) },
    ]);
    expect(fs.admin_field_overrides).toEqual({
      "2026": { tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) } },
    });
  });

  it("converts a legacy gap entry to the new shape when a user edit is written", () => {
    const next = setAdminFieldOverride(
      { admin_field_overrides: { "2026": { tradeReceivables: gap(100) } } },
      { year: "2026", fieldKey: "tradeReceivables", override: userEdit(120) }
    );
    expect(next).toEqual({
      "2026": { tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) } },
    });
  });

  it("rewriting the same action replaces only that action (legacy and new)", () => {
    const fromNew = setAdminFieldOverride(
      {
        admin_field_overrides: {
          "2026": { tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) } },
        },
      },
      { year: "2026", fieldKey: "tradeReceivables", override: userEdit(130) }
    );
    expect(fromNew).toEqual({
      "2026": { tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(130) } },
    });

    const fromLegacy = setAdminFieldOverride(
      { admin_field_overrides: { "2026": { tradeReceivables: gap(100) } } },
      { year: "2026", fieldKey: "tradeReceivables", override: gap(0) }
    );
    expect(fromLegacy).toEqual({ "2026": { tradeReceivables: { add_missing_ctos_field: gap(0) } } });
  });

  it("forces the stored action to the override action key", () => {
    const next = setAdminFieldOverride({}, {
      year: "2026",
      fieldKey: "plnpat",
      override: adminEdit(7),
    });
    expect(next).toEqual({ "2026": { plnpat: { edit_admin_input: adminEdit(7) } } });
  });

  it("passes every other year / field through unchanged, legacy entries included", () => {
    const original = {
      "2025": { turnover: userEdit(9), cashAndBank: { add_missing_ctos_field: gap(3) } },
      "2026": {
        cashAndBank: gap(5),
        plnpat: { edit_user_input: userEdit(1), extra: "kept" },
      },
    };
    const snapshot = JSON.parse(JSON.stringify(original));
    const next = setAdminFieldOverride(
      { admin_field_overrides: original },
      { year: "2026", fieldKey: "tradeReceivables", override: gap(100) }
    );
    expect(next["2025"]).toBe(original["2025"]);
    expect(next["2025"]).toEqual(snapshot["2025"]);
    const year2026 = next["2026"] as Record<string, unknown>;
    expect(year2026.cashAndBank).toBe(original["2026"].cashAndBank);
    expect(year2026.cashAndBank).toEqual(snapshot["2026"].cashAndBank);
    expect(year2026.plnpat).toEqual(snapshot["2026"].plnpat);
    expect(year2026.tradeReceivables).toEqual({ add_missing_ctos_field: gap(100) });
    // Input is not mutated.
    expect(original).toEqual(snapshot);
  });
});

describe("resolveAdminFinancialReviewColumns with both actions on one FY field", () => {
  const base = {
    unaudited_by_year: {
      "2027": { turnover: 70 },
      "2026": { turnover: 60, tradeReceivables: 50 },
    },
  };
  const ctos = [
    { financial_year: 2026, dates: { pldd: "2026-12-31", bsdd: null }, account: { turnover: 900, tradeReceivables: null } },
  ];
  const orders: Array<[string, AdminFieldOverride[]]> = [
    ["gap then user", [gap(100), userEdit(120)]],
    ["user then gap", [userEdit(120), gap(100)]],
  ];

  it.each(orders)("%s: CTOS column shows the gap-fill, User Input column shows the edit", (_label, overrides) => {
    const fs = writeAll(
      base,
      overrides.map((override) => ({ year: "2026", fieldKey: "tradeReceivables", override }))
    );
    const columns = resolveAdminFinancialReviewColumns({ financialStatements: fs, ctosFinancials: ctos });
    const ctosColumn = columns.find((c) => c.year === 2026 && c.kind === "ctos");
    const userColumn = columns.find((c) => c.year === 2026 && c.kind === "unaudited");
    expect(ctosColumn?.fields.tradeReceivables).toEqual({
      value: 100,
      source: "admin_input",
      editedByAdmin: true,
      readOnly: false,
    });
    expect(userColumn?.fields.tradeReceivables).toEqual({
      value: 120,
      source: "user_input",
      editedByAdmin: true,
      readOnly: false,
    });
  });

  it.each([[0], [42]])("a real CTOS value (%s) stays read-only and ignores a stored gap entry", (ctosValue) => {
    const fs = writeAll(base, [
      { year: "2026", fieldKey: "tradeReceivables", override: gap(100) },
      { year: "2026", fieldKey: "tradeReceivables", override: userEdit(120) },
    ]);
    const columns = resolveAdminFinancialReviewColumns({
      financialStatements: fs,
      ctosFinancials: [{ ...ctos[0], account: { turnover: 900, tradeReceivables: ctosValue } }],
    });
    expect(columns.find((c) => c.year === 2026 && c.kind === "ctos")?.fields.tradeReceivables).toEqual({
      value: ctosValue,
      source: "ctos",
      editedByAdmin: false,
      readOnly: true,
    });
    expect(columns.find((c) => c.year === 2026 && c.kind === "unaudited")?.fields.tradeReceivables.value).toBe(120);
  });

  it("legacy single entries resolve exactly as before", () => {
    const legacyGap = resolveAdminFinancialReviewColumns({
      financialStatements: { ...base, admin_field_overrides: { "2026": { tradeReceivables: gap(100) } } },
      ctosFinancials: ctos,
    });
    expect(legacyGap.find((c) => c.year === 2026 && c.kind === "ctos")?.fields.tradeReceivables).toEqual({
      value: 100,
      source: "admin_input",
      editedByAdmin: true,
      readOnly: false,
    });
    // A legacy gap entry does not leak into the User Input column.
    expect(legacyGap.find((c) => c.year === 2026 && c.kind === "unaudited")?.fields.tradeReceivables).toEqual({
      value: 50,
      source: "user_input",
      editedByAdmin: false,
      readOnly: false,
    });

    const legacyUser = resolveAdminFinancialReviewColumns({
      financialStatements: { ...base, admin_field_overrides: { "2026": { tradeReceivables: userEdit(120) } } },
      ctosFinancials: ctos,
    });
    expect(legacyUser.find((c) => c.year === 2026 && c.kind === "unaudited")?.fields.tradeReceivables.value).toBe(120);
    expect(legacyUser.find((c) => c.year === 2026 && c.kind === "ctos")?.fields.tradeReceivables).toEqual({
      value: null,
      source: "ctos",
      editedByAdmin: false,
      readOnly: false,
      unavailableReason: "not_provided_by_ctos",
    });
  });
});

describe("reconcileAdminFieldOverridesAfterIssuerSave with slots", () => {
  const both = {
    admin_field_overrides: {
      "2026": { tradeReceivables: { add_missing_ctos_field: gap(100), edit_user_input: userEdit(120) } },
    },
  };

  it("an issuer change drops only edit_user_input; the gap-fill survives", () => {
    expect(
      reconcileAdminFieldOverridesAfterIssuerSave({
        existingFinancialStatements: both,
        previousUnauditedByYear: { "2026": { tradeReceivables: 50 } },
        nextUnauditedByYear: { "2026": { tradeReceivables: 55 } },
      })
    ).toEqual({ "2026": { tradeReceivables: { add_missing_ctos_field: gap(100) } } });
  });

  it("an unchanged value keeps both actions", () => {
    expect(
      reconcileAdminFieldOverridesAfterIssuerSave({
        existingFinancialStatements: both,
        previousUnauditedByYear: { "2026": { tradeReceivables: 50 } },
        nextUnauditedByYear: { "2026": { tradeReceivables: "50" } },
      })
    ).toEqual(both.admin_field_overrides);
  });

  it("removes a field and year left empty", () => {
    expect(
      reconcileAdminFieldOverridesAfterIssuerSave({
        existingFinancialStatements: {
          admin_field_overrides: { "2026": { tradeReceivables: { edit_user_input: userEdit(120) } } },
        },
        previousUnauditedByYear: { "2026": { tradeReceivables: 50 } },
        nextUnauditedByYear: { "2026": { tradeReceivables: 0 } },
      })
    ).toEqual({});
  });

  it("drops stale edit_user_input only on changed fields; other actions and unchanged fields stay", () => {
    expect(
      reconcileAdminFieldOverridesAfterIssuerSave({
        existingFinancialStatements: {
          admin_field_overrides: {
            "2025": { plnpat: { edit_admin_input: adminEdit(7) } },
            "2026": {
              turnover: { edit_user_input: userEdit(120) },
              tradeReceivables: { edit_user_input: userEdit(60) },
              cashAndBank: { add_missing_ctos_field: gap(500) },
            },
          },
        },
        previousUnauditedByYear: {
          "2025": { plnpat: 1 },
          "2026": { turnover: 100, tradeReceivables: 40, cashAndBank: 1 },
        },
        nextUnauditedByYear: {
          "2025": { plnpat: 2 },
          "2026": { turnover: 110, tradeReceivables: 40, cashAndBank: 2 },
        },
      })
    ).toEqual({
      "2025": { plnpat: { edit_admin_input: adminEdit(7) } },
      "2026": {
        tradeReceivables: { edit_user_input: userEdit(60) },
        cashAndBank: { add_missing_ctos_field: gap(500) },
      },
    });
  });

  it("a kept legacy entry stays legacy; a changed legacy user edit is dropped", () => {
    expect(
      reconcileAdminFieldOverridesAfterIssuerSave({
        existingFinancialStatements: {
          admin_field_overrides: {
            "2026": { tradeReceivables: gap(100), turnover: userEdit(9), plnpat: userEdit(3) },
          },
        },
        previousUnauditedByYear: { "2026": { turnover: 1, plnpat: 3 } },
        nextUnauditedByYear: { "2026": { turnover: 2, plnpat: 3 } },
      })
    ).toEqual({ "2026": { tradeReceivables: gap(100), plnpat: userEdit(3) } });
  });
});
