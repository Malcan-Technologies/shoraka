import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "application-financial-review-content.tsx"), "utf8");

function buttonBlock(title: string): string {
  const idx = source.indexOf(`? "${title}"`);
  expect(idx).toBeGreaterThan(-1);
  return source.slice(source.lastIndexOf("<Button", idx), source.indexOf("</Button>", idx));
}

describe("Financial tab Add / Edit statement require applications.financial.manage", () => {
  it("reads the permission once for the Financial tab", () => {
    expect(source).toContain('const canManageFinancialCtos = can("applications.financial.manage");');
  });

  it("disables Add statement with a reason and cannot open the dialog without the permission", () => {
    const block = buttonBlock("Add financial statement");
    expect(block).toContain("disabled={!canManageFinancialCtos}");
    expect(block).toContain('"You do not have permission to perform this action."');
    expect(block).toMatch(/onClick=\{\(\) => \{\s*if \(!canManageFinancialCtos\) return;/);
  });

  it("disables Edit statement with a reason and cannot open the dialog without the permission", () => {
    const block = buttonBlock("Financial review is approved");
    expect(block).toContain("disabled={!canManageFinancialCtos}");
    expect(block).toContain('"You do not have permission to perform this action."');
    expect(block).toContain('if (!canManageFinancialCtos || spec.kind === "empty") return;');
  });

  it("keeps the existing locked behaviour", () => {
    expect(source).toContain('{financialEditsLocked ? "Locked" : "Edit statement"}');
    expect(source).toContain(
      '<span className="text-meta font-normal text-muted-foreground">Locked</span>'
    );
  });
});
