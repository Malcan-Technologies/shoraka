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
const marcSummary = fs.readFileSync(path.join(root, "marc-assessment-summary.tsx"), "utf8");
const completion = fs.readFileSync(path.join(root, "completion.ts"), "utf8");

describe("prospectus review presentation cleanup", () => {
  it("removes local preview shortcuts and preview-only verification copy", () => {
    expect(pageSource).not.toMatch(/Preview Page 1/);
    expect(pageSource).not.toMatch(/View in Preview/);
    expect(pageSource).not.toMatch(/verify in Preview/i);
    expect(pageSource).toContain('"Preview"');
    expect(pageSource).not.toMatch(/Save &(?:amp;)? Preview/);
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
    expect(pageSource).toContain("useIssuerMarcAssessment");
    expect(pageSource).toContain("hasMarcAssessment");
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
    expect(pageOne).not.toContain("From Invoice Offer");
    expect(pageOne).toContain("PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT");
    expect(pageOne).toContain('key === "shariah"');
    expect(pageOne).toContain("Fixed");
  });

  it("Page 2 edits Company Size and paymaster fields in place", () => {
    expect(pageTwo).toContain("Issuer Profile");
    expect(pageTwo).toContain("Company Size");
    expect(pageTwo).toContain("Invoice & Paymaster");
    expect(pageTwo).toContain("Deed of Assignment");
    expect(pageTwo).not.toContain("Page 3 Paymaster Grading");
    expect(pageTwo).not.toContain('label="Paymaster Grading"');
    expect(pageTwo).not.toContain('label="Confidence Grading"');
    expect(pageTwo).not.toContain("data-prospectus-page-three-paymaster-grading");
    expect(pageTwo).not.toContain("Paymaster Grading (Page 3)");
    expect(pageTwo).not.toContain("Confidence Grading (Page 3)");
    expect(pageTwo).not.toContain("MARC Paymaster Grading");
    expect(pageTwo).not.toContain("MARC Confidence Grading");
    expect(pageTwo).toContain("ProspectusMarcAssessmentSummary");
    expect(marcSummary).toContain("MARC Credit Assessment");
    expect(marcSummary).toContain("Manage MARC Assessment");
    expect(marcSummary).toContain("data-prospectus-marc-assessment");
    expect(pageTwo).toContain("Litigation Check");
    expect(pageTwo).toContain("CCRIS Status");
    expect(pageTwo).not.toContain(
      "MARC Credit Grade, Score, and Probability of Default come from the issuer organization MARC assessment."
    );
    expect(pageTwo).toContain("Paymaster Track Record");
    expect(pageTwo).toContain("optional");
    expect(pageTwo).toContain("ProspectusFinancialComparisonWorkingTable");
    expect(pageTwo).toContain("About the Invoice / Work Performed");
    expect(pageTwo).toContain("ProspectusInternalTabs");
    expect(pageTwo).toContain("data-prospectus-risk-rating-scale");
    expect(pageTwo).toContain("MARC_SME_BANDS");
    expect(pageTwo).toContain("Risk Rating Scale");
    expect(pageTwo).not.toContain("Full A–F Cashsouk scale for reference.");
    expect(pageTwo).not.toContain('title="Cashsouk Risk Rating"');
    expect(pageTwo).not.toContain("Cashsouk Risk Rating");
    expect(pageTwo).toContain("Risk Level");
    expect(pageTwo).toContain("Description");
    expect(pageTwo).toContain("CASHSCOUK_RISK_GRADE_LETTER_COLOR");
    expect(pageTwo).toContain("data-grade-color");
    expect(pageTwo).not.toContain("Selected Note grade is highlighted");
    expect(pageTwo).not.toContain(">Selected<");
    expect(pageTwo).not.toContain("ring-foreground");
    expect(pageTwo).not.toContain("data-selected");
    expect(pageTwo).not.toContain("Scale Version");
    expect(pageTwo).not.toContain("soukscore-scale.v1");
    expect(pageTwo).not.toContain("From Invoice Offer");
    expect(pageTwo).toContain("MARC_SME_BANDS");
    expect(pageTwo).toContain("{band.label}");
    expect(pageTwo).not.toContain("Disabled in Prospectus");
    expect(pageTwo).not.toContain("Button Behaviour");
    expect(pageTwo).not.toContain('label="Destination"');
    expect(pageTwo).toContain("CTA Description");
    expect(pageTwo).toContain(
      "Diversify your portfolio and earn attractive return with short-term, Shariah-compliant investment on CashSouk."
    );
    expect(pageTwo).toContain("Invest with Confidence");
    expect(pageTwo).not.toMatch(/data-prospectus-investment-cta[\s\S]{0,400}<button/);
    expect(pageTwo).not.toContain("Working Area");
  });

  it("Page 2 financial comparison edits inside the table", () => {
    expect(financialComparisonTable).toContain("ProspectusSharedFinancialWorkingTable");
    expect(financialComparisonTable).toContain("one three-year table");
    expect(pageTwo).not.toContain("PAGE_TWO_OFFICER_FINANCIAL_METRICS.map");
  });

  it("Page 3 overview and coverage hide source lines; reused cells stay read-only", () => {
    expect(pageThree).not.toContain("From Page 2 — Issuer & Paymaster");
    expect(pageThree).not.toContain("From Page 2 — Issuer Profile");
    expect(pageThree).not.toContain("From Invoice Offer");
    expect(pageThree).not.toContain("From note snapshot");
    expect(pageThree).toContain("ProspectusIncomeStatementWorkingTable");
    expect(pageThree).toContain("ProspectusBalanceSheetWorkingTable");
    expect(pageThree).toContain("ProspectusCoverageWorkingTable");
    expect(pageThree).toContain("Investor Takeaways");
    expect(pageThree).toContain("ProspectusInternalTabs");
    expect(pageThree).toContain('id: "paymaster_grading"');
    expect(pageThree).toContain('label: "Paymaster Grading"');
    expect(pageThree).toContain('tab === "paymaster_grading"');
    expect(pageThree).toContain("Page 3 Paymaster Grading");
    expect(pageThree).toContain('label="Paymaster Grading"');
    expect(pageThree).toContain('label="Confidence Grading"');
    expect(pageThree).toContain("data-prospectus-page-three-paymaster-grading");
    expect(pageThree).toContain("page2.invoicePaymaster");
    expect(pageThree.split("data-prospectus-page-three-paymaster-grading").length - 1).toBe(1);
    expect(pageThree.split('label="Paymaster Grading"').length - 1).toBe(1);
    expect(pageThree.split('label="Confidence Grading"').length - 1).toBe(1);
    expect(pageThree.indexOf('tab === "paymaster_grading"')).toBeLessThan(
      pageThree.indexOf("data-prospectus-page-three-paymaster-grading")
    );
    expect(pageThree.indexOf("data-prospectus-page-three-paymaster-grading")).toBeGreaterThan(
      pageThree.indexOf('tab === "overview"')
    );
    expect(pageThree.indexOf("data-prospectus-page-three-paymaster-grading")).toBeGreaterThan(
      pageThree.indexOf('tab === "income"')
    );
    expect(pageThree.indexOf("data-prospectus-page-three-paymaster-grading")).toBeGreaterThan(
      pageThree.indexOf('tab === "balance"')
    );
    expect(pageThree.indexOf("data-prospectus-page-three-paymaster-grading")).toBeGreaterThan(
      pageThree.indexOf('tab === "coverage"')
    );
    expect(pageThree.indexOf("data-prospectus-page-three-paymaster-grading")).toBeGreaterThan(
      pageThree.indexOf('tab === "takeaways"')
    );
    expect(pageThree).not.toContain("MARC Paymaster Grading");
    expect(pageThree).not.toContain("MARC Confidence Grading");
    expect(pageThree).not.toContain('label === "Sector"');
    expect(coverageTable).toContain('mode: "reused"');
    expect(coverageTable).not.toMatch(/From Page 2[\s\S]{0,40}<\/span>/);
    expect(coverageTable).not.toContain("Trend (3-Yr)");
    expect(financialComparisonTable).toContain("ProspectusSharedFinancialWorkingTable");
  });

  it("makes Paymaster Grading required without an || true workaround", () => {
    expect(completion).toContain('id: "page3Paymaster"');
    expect(completion).toMatch(/id: "page3Paymaster"[\s\S]*?required: true/);
    expect(completion).not.toContain("|| true");
    expect(completion).toContain('tabId: "paymaster_grading"');
    expect(completion).not.toMatch(
      /section: "Page 3 Paymaster Grading"[\s\S]{0,80}tabId: "overview"/
    );
  });

  it("Preview & Approval keeps readiness and missing fields without Completion checklist", () => {
    expect(preview).toContain("buildProspectusMissingRequiredFields");
    expect(preview).toContain("Missing required fields");
    expect(preview).toContain("Readiness by page");
    expect(preview).toContain("Approval unavailable");
    expect(preview).toContain("Ready for approval");
    expect(preview).toContain("All required fields are complete.");
    expect(preview).toContain("The Prospectus is ready for approval.");
    expect(preview).toContain("required field");
    expect(preview).toContain("are still missing.");
    expect(preview).not.toContain("Completion checklist");
    expect(preview).not.toContain("Note & Investment Details");
    expect(preview).not.toContain("Investor Highlights");
    expect(preview).not.toContain("Paymaster Track Record");
    expect(preview).not.toContain("Issuer, Credit & Invoice");
    expect(preview).not.toContain("Financial Review");
    expect(preview).not.toContain("Investor Takeaways");
    expect(preview).not.toContain("buildProspectusCompletionChecklist");
    expect(preview).not.toContain("CHECKLIST_ITEM_STEP");
    expect(preview).not.toContain("statusForCompletionItem");
    expect(preview).not.toContain("ProspectusStatusBadge");
    expect(preview).not.toContain("data-prospectus-action-bar");
    expect(preview).toContain("onNavigate(item.pageStep, item.tabId)");
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
    expect(resolvePreviewPageForStep(3, "allPages")).toBe("allPages");
    expect(resolvePreviewPageForStep(3, null)).toBe("page1");
  });
});
