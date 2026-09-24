import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "@cashsouk/types";

const repoRoot = join(__dirname, "../../../../..");

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function quotedKeys(file: string, marker: string): string[] {
  const start = file.indexOf(marker);
  const end = file.indexOf("];", start);
  return [...file.slice(start, end).matchAll(/"([A-Za-z0-9_]+)"/g)].map((match) => match[1] ?? "");
}

describe("admin financial entry paths share the issuer value rule", () => {
  const addDialog = source("apps/admin/src/notes/prospectus-review/admin-add-financial-statement-dialog.tsx");
  const editDialog = source("apps/admin/src/notes/prospectus-review/admin-edit-financial-statement-dialog.tsx");
  const fieldDialog = source("apps/admin/src/notes/prospectus-review/admin-edit-financial-field-dialog.tsx");
  const service = source("apps/api/src/modules/applications/service.ts");

  it("validates the add, edit, and single-field table dialogs with the shared helper", () => {
    for (const file of [addDialog, editDialog, fieldDialog]) {
      expect(file).toContain("issuerFinancialRawFieldValueError");
      expect(file).toContain("issuerFinancialMoneyInputAccepted");
      expect(file).not.toContain('type="number"');
    }
  });

  it("keeps single-field save disabled while the value is empty or invalid", () => {
    expect(fieldDialog).toContain("disabled={disabled || saving || empty || Boolean(valueError)}");
    expect(fieldDialog).toContain("admin-financial-statements/field");
  });

  it("shows every raw field in the add and edit statement modals", () => {
    const sectionTitles = new Set(["Assets", "Liabilities", "Equity", "Costs"]);
    const addKeys = quotedKeys(addDialog, "const ADD_MODAL_CATEGORIES").filter((key) => !sectionTitles.has(key));
    const editKeys = quotedKeys(editDialog, "const MODAL_GROUPS").filter((key) => !sectionTitles.has(key));
    expect(addKeys.sort()).toEqual([...ADMIN_EDITABLE_RAW_FINANCIAL_KEYS].sort());
    expect(editKeys.sort()).toEqual([...ADMIN_EDITABLE_RAW_FINANCIAL_KEYS].sort());
  });

  it("routes table, user-input, and CTOS gap-fill edits through the single-field dialog and API helper", () => {
    const content = source("apps/admin/src/components/application-financial-review-content.tsx");
    expect(content).toContain("<AdminEditFinancialFieldDialog");
    expect(content).not.toContain("admin-financial-statements/field");
    const singleField = service.slice(service.indexOf("async upsertAdminFinancialField"));
    const helperAt = singleField.indexOf("issuerFinancialRawFieldValueError(fieldKey, value)");
    const writeAt = singleField.indexOf('decision.action === "edit_admin_input"');
    expect(helperAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(helperAt);
    expect(singleField).toContain("action: decision.action");
  });

  it("enforces the same helper on the whole-year and single-field API writes", () => {
    const wholeYear = service.indexOf("upsertAdminFinancialStatementFallbackYear");
    const singleField = service.indexOf("async upsertAdminFinancialField");
    expect(wholeYear).toBeGreaterThan(-1);
    expect(singleField).toBeGreaterThan(wholeYear);
    const wholeYearBody = service.slice(wholeYear, singleField);
    const singleFieldBody = service.slice(singleField);
    expect(wholeYearBody).toContain("issuerFinancialRawFieldValueError(fieldKey, fieldValue)");
    expect(singleFieldBody).toContain("issuerFinancialRawFieldValueError(fieldKey, value)");
    expect(singleFieldBody).not.toContain('Enter a numeric value');
  });
});
