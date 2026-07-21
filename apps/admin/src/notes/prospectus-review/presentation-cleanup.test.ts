import fs from "node:fs";
import path from "node:path";
import { PROSPECTUS_STEP_PREVIEW_PAGE, resolvePreviewPageForStep } from "./preview-page";

const root = path.join(__dirname);
const pageSource = fs.readFileSync(
  path.join(root, "../../app/notes/[id]/prospectus/page.tsx"),
  "utf8"
);
const pageOne = fs.readFileSync(path.join(root, "working-area-page-one.tsx"), "utf8");
const pageTwo = fs.readFileSync(path.join(root, "working-area-page-two.tsx"), "utf8");
const pageThree = fs.readFileSync(path.join(root, "working-area-page-three.tsx"), "utf8");
const preview = fs.readFileSync(path.join(root, "working-area-preview-approval.tsx"), "utf8");
const coverageTable = fs.readFileSync(
  path.join(root, "coverage-working-table.tsx"),
  "utf8"
);
const financialComparisonTable = fs.readFileSync(
  path.join(root, "financial-comparison-working-table.tsx"),
  "utf8"
);

describe("prospectus review presentation cleanup", () => {
  it("removes local preview shortcuts and preview-only verification copy", () => {
    expect(pageSource).not.toMatch(/Preview Page 1/);
    expect(pageSource).not.toMatch(/View in Preview/);
    expect(pageSource).not.toMatch(/verify in Preview/i);
    expect(pageSource).toContain("Save &amp; Preview");
    expect(pageSource).not.toMatch(/Submit for Review/);
    expect(pageSource).not.toMatch(/Reopen/);
  });

  it("wires four working-area page components", () => {
    expect(pageSource).toContain("WorkingAreaPageOne");
    expect(pageSource).toContain("WorkingAreaPageTwo");
    expect(pageSource).toContain("WorkingAreaPageThree");
    expect(pageSource).toContain("WorkingAreaPreviewApproval");
    expect(pageSource).toContain("buildPageThreeAdminOverviewRows");
    expect(pageSource).toContain("mergeOfficerOverridesIntoFinancialTable");
  });

  it("Page 1 uses field-centred sections without At a Glance duplicate", () => {
    expect(pageOne).toContain("Note Overview");
    expect(pageOne).toContain("Risk Information");
    expect(pageOne).toContain("Investment Terms");
    expect(pageOne).toContain("Investor Highlights");
    expect(pageOne).toContain("Historical Notes");
    expect(pageOne).toContain("ProspectusInternalTabs");
    expect(pageOne).not.toContain("at-a-glance");
    expect(pageOne).not.toContain("Working Area");
    expect(pageOne).toContain("PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT");
    expect(pageOne).toContain('key === "shariah"');
    expect(pageOne).toContain("Fixed");
  });

  it("Page 2 edits Company Size and paymaster fields in place", () => {
    expect(pageTwo).toContain("Issuer Profile");
    expect(pageTwo).toContain("Company Size");
    expect(pageTwo).toContain("Invoice & Paymaster");
    expect(pageTwo).toContain("Deed of Assignment");
    expect(pageTwo).toContain("Paymaster Rating");
    expect(pageTwo).toContain("Confidence Grading");
    expect(pageTwo).toContain("Paymaster Track Record");
    expect(pageTwo).toContain("optional");
    expect(pageTwo).toContain("ProspectusFinancialComparisonWorkingTable");
    expect(pageTwo).toContain("About the Invoice / Work Performed");
    expect(pageTwo).toContain("ProspectusInternalTabs");
    expect(pageTwo).not.toContain("data-prospectus-risk-rating-scale");
    expect(pageTwo).not.toContain("SOUKSCORE_RISK_RATING_GRADES");
    expect(pageTwo).toContain("Risk Information");
    expect(pageTwo).toContain("Disabled in Prospectus");
    expect(pageTwo).toContain("Invest with Confidence");
    expect(pageTwo).not.toMatch(/data-prospectus-investment-cta[\s\S]{0,400}<button/);
    expect(pageTwo).not.toContain("Working Area");
  });

  it("Page 2 financial comparison edits inside the table", () => {
    expect(financialComparisonTable).toContain("ProspectusSharedFinancialWorkingTable");
    expect(financialComparisonTable).toContain("one three-year table");
    expect(pageTwo).not.toContain("PAGE_TWO_OFFICER_FINANCIAL_METRICS.map");
  });

  it("Page 3 reuses Page 2 gradings and omits Trend column in working coverage table", () => {
    expect(pageThree).toContain("From Page 2 Invoice & Paymaster");
    expect(pageThree).toContain("From Page 2 Issuer Profile");
    expect(pageThree).toContain("From Invoice Offer");
    expect(pageThree).toContain("ProspectusIncomeStatementWorkingTable");
    expect(pageThree).toContain("ProspectusBalanceSheetWorkingTable");
    expect(pageThree).toContain("ProspectusCoverageWorkingTable");
    expect(pageThree).toContain("Investor Takeaways");
    expect(pageThree).toContain("ProspectusInternalTabs");
    expect(pageThree).not.toContain('label === "Sector"');
    expect(coverageTable).toContain("From Page 2 Financial Comparison");
    expect(coverageTable).not.toContain("Trend (3-Yr)");
    expect(financialComparisonTable).toContain("ProspectusSharedFinancialWorkingTable");
  });

  it("Preview & Approval lists missing required fields", () => {
    expect(preview).toContain("buildProspectusMissingRequiredFields");
    expect(preview).toContain("Missing required fields");
    expect(preview).toContain("Readiness by page");
  });

  it("maps workflow steps to prospectus preview pages for the four-step model", () => {
    expect(PROSPECTUS_STEP_PREVIEW_PAGE).toEqual({
      0: "page1",
      1: "page2",
      2: "page3",
    });
    expect(resolvePreviewPageForStep(0, null)).toBe("page1");
    expect(resolvePreviewPageForStep(1, null)).toBe("page2");
    expect(resolvePreviewPageForStep(2, null)).toBe("page3");
    expect(resolvePreviewPageForStep(3, "page2")).toBe("page2");
    expect(resolvePreviewPageForStep(3, null)).toBe("page1");
  });
});
