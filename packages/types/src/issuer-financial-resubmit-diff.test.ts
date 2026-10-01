import {
  diffIssuerFinancialRevisionSnapshots,
  isIssuerFinancialUserInputResubmitPath,
} from "./issuer-financial-resubmit-diff";
import { isMeaningfulResubmitSnapshotFieldPath } from "./resubmit-meaningful-field-path";

type Block = Record<string, unknown>;

function snapshot(financialStatements: Record<string, unknown>): unknown {
  return { application: { financial_statements: financialStatements } };
}

function issuer(byYear: Record<string, Block>, extra: Record<string, unknown> = {}): unknown {
  return snapshot({
    questionnaire: { financial_year_end: "2027-03-31" },
    unaudited_by_year: byYear,
    ...extra,
  });
}

const fy = (bsfatot: number, more: Block = {}): Block => ({
  pldd: "31/03/2027",
  bsfatot,
  othass: 50,
  tradeReceivables: 30,
  ...more,
});

describe("diffIssuerFinancialRevisionSnapshots", () => {
  it("Scenario A: only the changed FY is returned", () => {
    const diff = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100), "2027": fy(200) }),
      issuer({ "2026": fy(100), "2027": fy(250) })
    );
    expect(diff.map((d) => d.year)).toEqual([2027]);
    expect(diff[0]!.fields.bsfatot).toEqual({ issuerBefore: 200, issuerAfter: 250, changed: true });
  });

  it("Scenario B: identical financials → no diff (e.g. documents-only resubmit)", () => {
    const before = { application: { financial_statements: { unaudited_by_year: { "2026": fy(100) } }, supporting_documents: { a: 1 } } };
    const after = { application: { financial_statements: { unaudited_by_year: { "2026": fy(100) } }, supporting_documents: { a: 2 } } };
    expect(diffIssuerFinancialRevisionSnapshots(before, after)).toEqual([]);
  });

  it("Scenario C: both FYs changed → both returned ascending, nothing else", () => {
    const diff = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100), "2027": fy(200) }),
      issuer({ "2026": fy(120), "2027": fy(250) })
    );
    expect(diff.map((d) => d.year)).toEqual([2026, 2027]);
  });

  it("Scenario D: whole-year Admin Input cannot create a comparison year", () => {
    const diff = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100), "2027": fy(200) }, { admin_input_by_year: { "2025": { bsfatot: 1 } } }),
      issuer({ "2026": fy(100), "2027": fy(250) }, { admin_input_by_year: { "2025": { bsfatot: 999 } } })
    );
    expect(diff.map((d) => d.year)).toEqual([2027]);
  });

  it("CTOS gap-fill / add-year overrides cannot create a comparison year", () => {
    const override = (action: string, value: number) => ({
      [action]: { value, baseSource: "ctos", action, updated_by_user_id: "u", updated_at: "x" },
    });
    const diff = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100) }),
      issuer(
        { "2026": fy(100) },
        {
          admin_field_overrides: {
            "2024": { bsfatot: override("add_missing_fy", 5) },
            "2025": { bsfatot: override("add_missing_ctos_field", 7) },
          },
        }
      )
    );
    expect(diff).toEqual([]);
  });

  it("Scenario E: only the changed field is marked; other rows stay present and unchanged", () => {
    const [year] = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100) }),
      issuer({ "2026": fy(120) })
    );
    expect(year!.changedKeys).toEqual(["bsfatot"]);
    expect(year!.fields.othass).toEqual({ issuerBefore: 50, issuerAfter: 50, changed: false });
    expect(year!.fields.tradeReceivables).toEqual({ issuerBefore: 30, issuerAfter: 30, changed: false });
  });

  it("an Admin-only edit_user_input change produces no Financial diff, and values stay raw issuer", () => {
    const editUserInput = (value: number) => ({
      "2026": {
        bsfatot: {
          edit_user_input: { value, baseSource: "user_input", action: "edit_user_input", updated_by_user_id: "u", updated_at: "x" },
        },
      },
    });
    expect(
      diffIssuerFinancialRevisionSnapshots(
        issuer({ "2026": fy(100) }),
        issuer({ "2026": fy(100) }, { admin_field_overrides: editUserInput(120) })
      )
    ).toEqual([]);

    const [year] = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100) }, { admin_field_overrides: editUserInput(120) }),
      issuer({ "2026": fy(110) })
    );
    expect(year!.fields.bsfatot).toEqual({ issuerBefore: 100, issuerAfter: 110, changed: true });
  });

  it("questionnaire / FYE-only change produces no diff", () => {
    const before = snapshot({ questionnaire: { financial_year_end: "2027-03-31" }, unaudited_by_year: { "2026": fy(100) } });
    const after = snapshot({ questionnaire: { financial_year_end: "2027-06-30" }, unaudited_by_year: { "2026": fy(100, { pldd: "30/06/2027" }) } });
    expect(diffIssuerFinancialRevisionSnapshots(before, after)).toEqual([]);
  });

  it("string vs number of the same amount is unchanged; 0 is not missing", () => {
    expect(
      diffIssuerFinancialRevisionSnapshots(issuer({ "2026": fy(100) }), issuer({ "2026": { ...fy(100), bsfatot: "100" } }))
    ).toEqual([]);
    const [year] = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2026": fy(100) }),
      issuer({ "2026": fy(100, { curlib: 0 }) })
    );
    expect(year!.changedKeys).toEqual(["curlib"]);
    expect(year!.fields.curlib).toEqual({ issuerBefore: null, issuerAfter: 0, changed: true });
  });

  it("a FY added or removed by the issuer is shown", () => {
    const diff = diffIssuerFinancialRevisionSnapshots(
      issuer({ "2025": fy(80) }),
      issuer({ "2026": fy(100) })
    );
    expect(diff.map((d) => d.year)).toEqual([2025, 2026]);
    expect(diff[0]!.fields.bsfatot).toEqual({ issuerBefore: 80, issuerAfter: null, changed: true });
    expect(diff[1]!.fields.bsfatot).toEqual({ issuerBefore: null, issuerAfter: 100, changed: true });
  });

  it("missing or malformed snapshots are safe", () => {
    expect(diffIssuerFinancialRevisionSnapshots(null, undefined)).toEqual([]);
    expect(diffIssuerFinancialRevisionSnapshots({}, { application: {} })).toEqual([]);
  });
});

describe("isIssuerFinancialUserInputResubmitPath", () => {
  it.each([
    "financial_statements.unaudited_by_year",
    "financial_statements.unaudited_by_year.2026",
    "financial_statements.unaudited_by_year.2026.bsfatot",
  ])("accepts issuer User Input path %s", (path) => {
    expect(isIssuerFinancialUserInputResubmitPath(path)).toBe(true);
  });

  it.each([
    "financial_statements",
    "financial_statements.questionnaire.financial_year_end",
    "financial_statements.unaudited_by_year.2026.pldd",
    "financial_statements.admin_input_by_year.2025.bsfatot",
    "financial_statements.admin_field_overrides.2026.bsfatot.edit_user_input.value",
    "financing_type.product_id",
    "financing_structure.structure_type",
    "issuer_organization.latest_organization_ctos_financials_json",
    "supporting_documents.categories[0]",
  ])("rejects %s", (path) => {
    expect(isIssuerFinancialUserInputResubmitPath(path)).toBe(false);
  });
});

describe("isMeaningfulResubmitSnapshotFieldPath (financial_statements)", () => {
  it("only issuer unaudited_by_year paths are meaningful", () => {
    expect(isMeaningfulResubmitSnapshotFieldPath("financial_statements.unaudited_by_year.2026.bsfatot")).toBe(true);
    expect(isMeaningfulResubmitSnapshotFieldPath("financial_statements.unaudited_by_year.2027")).toBe(true);
    expect(isMeaningfulResubmitSnapshotFieldPath("financial_statements.questionnaire.financial_year_end")).toBe(false);
    expect(isMeaningfulResubmitSnapshotFieldPath("financial_statements.admin_input_by_year.2025.bsfatot")).toBe(false);
    expect(
      isMeaningfulResubmitSnapshotFieldPath("financial_statements.admin_field_overrides.2026.bsfatot.edit_user_input.value")
    ).toBe(false);
  });

  it("non-financial paths keep their existing rules", () => {
    expect(isMeaningfulResubmitSnapshotFieldPath("supporting_documents.categories[0].name")).toBe(true);
    expect(isMeaningfulResubmitSnapshotFieldPath("contract.status")).toBe(false);
    expect(isMeaningfulResubmitSnapshotFieldPath("contract.contract_details.value")).toBe(true);
  });
});
