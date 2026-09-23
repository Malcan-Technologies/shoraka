import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Prospectus working area UX cleanup (presentation-only)", () => {
  const sharedTablePath = join(
    __dirname,
    "shared-financial-working-table.tsx"
  );
  const pagePath = join(__dirname, "../../app/notes/[id]/prospectus/page.tsx");
  const pageTwoIncomeTablePath = join(__dirname, "income-statement-working-table.tsx");
  const pageThreeBalanceTablePath = join(__dirname, "balance-sheet-working-table.tsx");

  it("keeps header/value spacing more breathing (card padding + shared table min widths)", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    expect(pageSource).toContain("space-y-7");
    expect(pageSource).toContain("CardContent className=\"grid gap-5 p-6");
    expect(pageSource).toContain('className="mt-1.5 truncate text-sm font-semibold"');

    const sharedSource = readFileSync(sharedTablePath, "utf8");
    expect(sharedSource).toContain("min-w-[48rem]");
    expect(sharedSource).toContain("min-w-[13rem]");
    expect(sharedSource).toContain("min-w-[9rem]");
  });

  it("standardizes missing calculated helper wrapping + avoids cramped cells", () => {
    const sharedSource = readFileSync(sharedTablePath, "utf8");
    expect(sharedSource).toContain("whitespace-normal text-sm tabular-nums");
    expect(sharedSource).toContain("max-w-[9.5rem]");
    expect(sharedSource).toContain("break-words");
  });

  it("renders source badges only for CTOS/User Input/Admin Input (no audited/management clutter)", () => {
    const sharedSource = readFileSync(sharedTablePath, "utf8");
    expect(sharedSource).toContain('header.sourceType === "CTOS"');
    expect(sharedSource).toContain('header.sourceType === "ADMIN_INPUT"');
    expect(sharedSource).toContain('header.sourceType === "ISSUER_INPUT"');
    expect(sharedSource).not.toContain("AUDITED");
    expect(sharedSource).not.toContain("MANAGEMENT_ACCOUNTS");
    expect(sharedSource).not.toContain("Not Audited");
  });

  it("Page 2 / Page 3 financial working tables reuse the shared table component", () => {
    const incomeTable = readFileSync(pageTwoIncomeTablePath, "utf8");
    expect(incomeTable).toContain("ProspectusSharedFinancialWorkingTable");

    const balanceTable = readFileSync(pageThreeBalanceTablePath, "utf8");
    expect(balanceTable).toContain("ProspectusSharedFinancialWorkingTable");
  });
});

