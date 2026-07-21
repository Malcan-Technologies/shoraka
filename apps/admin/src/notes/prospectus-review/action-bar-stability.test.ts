import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");
const tabsSource = fs.readFileSync(path.join(__dirname, "working-area-tabs.tsx"), "utf8");
const sectionTitle = fs.readFileSync(path.join(__dirname, "section-title.tsx"), "utf8");

describe("prospectus action bar and tab status", () => {
  it("keeps the action bar always mounted (not gated on step === 3)", () => {
    expect(pageSource).toContain("data-prospectus-action-bar");
    expect(pageSource).not.toMatch(/actionBar\s*=\s*\n?\s*step === 3 \? null/);
    expect(pageSource).toContain("selectYearsFromPageTwoFinancialTable");
    expect(pageSource).toContain("saveStatusLabel");
    expect(pageSource).toContain("required fields missing");
  });

  it("uses a single dirty/save status in the action bar", () => {
    expect(pageSource).toContain("data-prospectus-dirty-state");
    expect(pageSource).toContain("All changes saved");
    expect(pageSource).toContain("Unsaved changes");
    expect(pageSource).toContain("Saving…");
  });

  it("renders Complete in green and missing in amber on tabs", () => {
    expect(tabsSource).toContain("text-emerald-700");
    expect(tabsSource).toContain("text-amber-700");
    expect(tabsSource).toContain("Optional");
    expect(sectionTitle).toContain("text-emerald-700");
    expect(sectionTitle).toContain("h-5 w-5 shrink-0 text-primary");
  });

  it("does not re-select Page 3 years from live Application alone", () => {
    expect(pageSource).not.toMatch(/selectPageThreeYears\(financialStatements\)/);
    expect(pageSource).toContain("pageTwoYearHeaders");
  });
});
