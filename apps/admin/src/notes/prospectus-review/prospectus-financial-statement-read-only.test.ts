import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relativePath: string) => readFileSync(join(__dirname, relativePath), "utf8");

const pageSource = read("../../app/notes/[id]/prospectus/page.tsx");
const PROSPECTUS_TABLE_FILES = [
  "shared-financial-working-table.tsx",
  "income-statement-working-table.tsx",
  "balance-sheet-working-table.tsx",
  "coverage-working-table.tsx",
  "working-area-page-three.tsx",
];

describe("Prospectus review is read-only for financial statements", () => {
  it("does not render a financial statement add or edit dialog on the Prospectus page", () => {
    expect(pageSource).not.toContain("AdminAddFinancialStatementDialog");
    expect(pageSource).not.toContain("AdminEditFinancialStatementDialog");
    expect(pageSource).not.toContain("AdminEditFinancialFieldDialog");
    expect(pageSource).not.toContain("admin-financial-statements");
  });

  it.each(PROSPECTUS_TABLE_FILES)("%s has no add-year action", (file) => {
    const source = read(file);
    expect(source).not.toContain("onAddPlaceholderYear");
    expect(source).not.toContain("+ Add");
    expect(source).not.toContain("admin-financial-statements");
  });

  it("still shows placeholder years and the missing-year warning", () => {
    expect(read("shared-financial-working-table.tsx")).toContain("header.isPlaceholder");
    expect(read("working-area-page-three.tsx")).toContain("ProspectusMissingFinancialYearWarning");
  });

  it("keeps Prospectus review and approval on notes.manage", () => {
    expect(pageSource).toContain('const canManage = can("notes.manage");');
    expect(pageSource).toContain('<RequirePermission permission="notes.view">');
  });

  it("keeps the add and edit dialogs on the Application Review Financial tab", () => {
    const financialTab = read("../../components/application-financial-review-content.tsx");
    expect(financialTab).toContain('const canManageFinancialCtos = can("applications.financial.manage");');
    expect(financialTab).toContain("<AdminAddFinancialStatementDialog");
    expect(financialTab).toContain("<AdminEditFinancialStatementDialog");
    expect(financialTab).toContain("<AdminEditFinancialFieldDialog");
  });
});
