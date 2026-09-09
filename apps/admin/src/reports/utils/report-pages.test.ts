import { readFileSync } from "node:fs";
import { join } from "node:path";

const catalog = readFileSync(join(__dirname, "../../app/reports/page.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "../../app/reports/[reportKey]/page.tsx"), "utf8");
const filters = readFileSync(join(__dirname, "../components/report-period-filters.tsx"), "utf8");

describe("admin reports catalog", () => {
  it("persists tabs in the query string inside Suspense", () => {
    expect(catalog).toContain("Suspense");
    expect(catalog).toContain("useSearchParams");
    expect(catalog).toContain("overflow-x-auto");
    expect(catalog).toContain("groupReportsByCategory");
    expect(catalog).toContain("aria-disabled");
    expect(catalog).toContain("Credit quality, origination");
  });
});

describe("admin report detail", () => {
  it("uses shared period filters, category back link, and export actions", () => {
    expect(detail).toContain("defaultReportQuery(definition)");
    expect(detail).toContain("[definition, reportKey]");
    expect(detail).toContain("reportsCatalogHref");
    expect(detail).toContain("Back to reports");
    expect(detail).toContain("Export CSV");
    expect(detail).toContain("Export XLSX");
    expect(detail).toContain("portfolioAtRisk");
    expect(detail).not.toContain('type="date"');
  });

  it("keeps custom dates on Apply/Cancel and supports breakdown", () => {
    expect(filters).toContain("Apply");
    expect(filters).toContain("Cancel");
    expect(filters).toContain("Breakdown");
    expect(filters).toContain("validateCustomRange");
    expect(filters).not.toContain("24h");
  });
});
