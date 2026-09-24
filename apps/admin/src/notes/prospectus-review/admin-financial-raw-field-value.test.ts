import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "../../../../..");

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
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
