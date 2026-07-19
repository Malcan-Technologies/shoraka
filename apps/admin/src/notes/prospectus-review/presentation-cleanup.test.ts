import fs from "node:fs";
import path from "node:path";
import { PROSPECTUS_STEP_PREVIEW_PAGE, resolvePreviewPageForStep } from "./preview-page";

const pagePath = path.join(
  __dirname,
  "../../app/notes/[id]/prospectus/page.tsx"
);
const pageSource = fs.readFileSync(pagePath, "utf8");

describe("prospectus review presentation cleanup", () => {
  it("removes local preview shortcuts and preview-only verification copy", () => {
    expect(pageSource).not.toMatch(/Preview Page 1/);
    expect(pageSource).not.toMatch(/Preview Page 2/);
    expect(pageSource).not.toMatch(/Preview Page 3/);
    expect(pageSource).not.toMatch(/View in Preview/);
    expect(pageSource).not.toMatch(/View in Page 2 Preview/);
    expect(pageSource).not.toMatch(/View in Page 3 Preview/);
    expect(pageSource).not.toMatch(/verify in Preview/i);
    expect(pageSource).toContain("Preview Prospectus");
    expect(pageSource.match(/Preview Prospectus/g)?.length).toBe(1);
  });

  it("uses operations-friendly section titles and drops technical names", () => {
    expect(pageSource).not.toContain("Metadata Strip");
    expect(pageSource).not.toContain("Page 3 Overview");
    expect(pageSource).not.toContain("Trend Verification");
    expect(pageSource).not.toContain("Resolved Takeaway Text");
    expect(pageSource).toContain("Financial Summary");
    expect(pageSource).toContain("Financing & Risk Details");
    expect(pageSource).toContain("3-Year Financial Comparison");
    expect(pageSource).toContain("Officer Input");
  });

  it("removes redundant fixed-content verification sections", () => {
    expect(pageSource).not.toContain("Risk Rating Scale");
    expect(pageSource).not.toContain("Investment CTA");
    expect(pageSource).not.toContain("Issuer Track Record");
    expect(pageSource).not.toContain("Historical Notes");
  });

  it("uses editable highlight copy instead of highlight catalogue dropdowns", () => {
    expect(pageSource).not.toContain("Investment Structure");
    expect(pageSource).not.toContain("catalogues.paymentBasis");
    expect(pageSource).not.toContain("catalogues.shariahPrinciple");
    expect(pageSource).not.toContain("catalogues.highlights");
    expect(pageSource).not.toContain("paymentBasisOptionKey");
    expect(pageSource).not.toContain("shariahPrincipleOptionKey");
    expect(pageSource).toContain("Key Investor Highlights");
    expect(pageSource).toContain("Highlight Title");
    expect(pageSource).toContain("Highlight Description");
    expect(pageSource).toContain("PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT");
    expect(pageSource).toContain("PROSPECTUS_HIGHLIGHT_KEYS");
    // Shariah remains read-only (no editable inputs for the fixed highlight).
    expect(pageSource).toContain('key === "shariah"');
    expect(pageSource).toContain("isShariah");
  });

  it("renders Page 2/3 financials through the metric table component", () => {
    expect(pageSource).toContain("ProspectusFinancialMetricTable");
    expect(pageSource).toContain("buildPageTwoFinancialComparisonTable");
    expect(pageSource).toContain("buildPageThreeIncomeStatementTable");
    expect(pageSource).toContain("buildPageThreeBalanceSheetTable");
    expect(pageSource).toContain("buildPageThreeCoverageTable");
    expect(pageSource).toContain("showTrend");
  });

  it("keeps global preview page mapping unchanged", () => {
    expect(PROSPECTUS_STEP_PREVIEW_PAGE).toEqual({
      0: "page1",
      1: "page1",
      2: "page2",
      3: "page2",
      4: "page3",
      5: "page3",
    });
    expect(resolvePreviewPageForStep(2, null)).toBe("page2");
    expect(resolvePreviewPageForStep(4, null)).toBe("page3");
    expect(resolvePreviewPageForStep(6, "page2")).toBe("page2");
    expect(resolvePreviewPageForStep(6, null)).toBe("page1");
  });
});
