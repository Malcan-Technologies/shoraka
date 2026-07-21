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
    expect(pageSource).toContain("Save &amp; Preview");
    expect(pageSource).not.toMatch(/Submit for Review/);
    expect(pageSource).not.toMatch(/Reopen/);
  });

  it("uses operations-friendly section titles and drops technical names", () => {
    expect(pageSource).not.toContain("Metadata Strip");
    expect(pageSource).not.toContain("Page 3 Overview");
    expect(pageSource).not.toContain("Trend Verification");
    expect(pageSource).not.toContain("Resolved Takeaway Text");
    expect(pageSource).toContain("Financial Summary");
    expect(pageSource).toContain("Financing & Risk Details");
    expect(pageSource).toContain("3-Year Financial Comparison");
    expect(pageSource).toContain(
      'title="3-Year Income Statement Summary (MYR mil.)"'
    );
    expect(pageSource).toContain("Enter amounts in full MYR.");
    expect(pageSource).toContain("displays them in MYR millions.");
    expect(pageSource).toContain(
      'title="3-Year Balance Sheet & Liquidity (MYR mil.)"'
    );
    expect(pageSource).toContain(
      "Values sourced or calculated from financial statements are read-only."
    );
    expect(pageSource).toContain("except Quick Ratio");
    expect(pageSource).toContain("ProspectusBalanceSheetWorkingTable");
    expect(pageSource).toContain("Officer Input");
    expect(pageSource).toContain("ProspectusIncomeStatementWorkingTable");
    expect(pageSource).toContain(
      "Values sourced from financial statements are read-only. Complete only the"
    );
    expect(pageSource).not.toContain("MANUAL_INCOME_FIELDS");
  });

  it("keeps Page 3 Financing & Risk Details read-only without Issuer or duplicate grading inputs", () => {
    expect(pageSource).toContain(
      "Paymaster and confidence gradings are taken from the Page 2 Invoice &"
    );
    expect(pageSource).toContain("buildPageThreeMetadataRows(note,");
    expect(pageSource).toContain("officerCompanySize");
    expect(pageSource).toContain("officerPaymasterRating");
    expect(pageSource).toContain("officerConfidenceGrading");
    expect(pageSource).not.toMatch(
      /Financing & Risk Details[\s\S]{0,1200}<Select/
    );
    expect(pageSource).not.toMatch(
      /Financing & Risk Details[\s\S]{0,1200}<Input/
    );
    expect(pageSource).not.toMatch(
      /Financing & Risk Details[\s\S]{0,800}Issuer/
    );
  });

  it("shows read-only Risk Rating Scale from frozen Note grade", () => {
    expect(pageSource).toContain("Risk Rating Scale");
    expect(pageSource).toContain("data-prospectus-risk-rating-scale");
    expect(pageSource).toContain(
      "Risk rating is taken from the approved invoice offer and cannot be edited"
    );
    expect(pageSource).toContain("SOUKSCORE_RISK_RATING_GRADES");
    expect(pageSource).toContain("note?.riskRating");
    expect(pageSource).not.toMatch(
      /data-prospectus-risk-rating-scale[\s\S]{0,800}<Select/
    );
    expect(pageSource).not.toMatch(
      /data-prospectus-risk-rating-scale[\s\S]{0,800}<Input/
    );
    expect(pageSource).not.toMatch(
      /data-prospectus-risk-rating-scale[\s\S]{0,800}<Textarea/
    );
  });

  it("shows read-only Investment CTA with non-clickable Invest Now preview", () => {
    expect(pageSource).toContain("Investment CTA");
    expect(pageSource).toContain("data-prospectus-investment-cta");
    expect(pageSource).toContain("INVEST WITH CONFIDENCE");
    expect(pageSource).toContain("INVEST NOW");
    expect(pageSource).toContain("MARKETPLACE_MIN_COMMIT_MYR");
    expect(pageSource).toContain("not clickable");
    expect(pageSource).toContain("disabled");
    expect(pageSource).toContain('aria-disabled="true"');
    expect(pageSource).not.toMatch(
      /data-prospectus-investment-cta[\s\S]{0,800}<Select/
    );
    expect(pageSource).not.toMatch(
      /data-prospectus-investment-cta[\s\S]{0,800}<Input/
    );
    expect(pageSource).not.toMatch(
      /data-prospectus-investment-cta[\s\S]{0,800}<Textarea/
    );
    expect(pageSource).not.toMatch(
      /data-prospectus-investment-cta[\s\S]{0,500}href=/
    );
  });

  it("shows read-only Issuer Track Record from API rows on Page 1", () => {
    expect(pageSource).toContain("appendIssuerTrackRecordSection");
    expect(pageSource).toContain("issuerTrackRecord");
    expect(pageSource).toContain('section.id === "issuer-track-record"');
    expect(pageSource).toContain(
      "These figures are calculated automatically from the issuer"
    );
    // No editable controls for Issuer Track Record (Paymaster Track Record remains editable on step 2).
    expect(pageSource).not.toMatch(/issuerTrackRecord[\s\S]{0,200}<Input/);
    expect(pageSource).not.toMatch(/Issuer Track Record[\s\S]{0,400}<Input/);
    expect(pageSource).not.toMatch(/Issuer Track Record[\s\S]{0,400}<Textarea/);
    expect(pageSource).not.toMatch(/Issuer Track Record[\s\S]{0,400}<Select/);
  });

  it("shows Issuer Profile from API rows plus editable Company Size on Page 2", () => {
    expect(pageSource).toContain('title="Issuer Profile"');
    expect(pageSource).toContain("issuerProfile");
    expect(pageSource).toContain("data-prospectus-issuer-profile");
    expect(pageSource).toContain(
      "Business profile information shown in the investor Prospectus."
    );
    expect(pageSource).toContain("prospectus-company-size");
    expect(pageSource).toContain("PROSPECTUS_COMPANY_SIZE_VALUES");
    expect(pageSource).toContain(
      "Select the company size to display in the investor Prospectus."
    );
    expect(pageSource).toContain("Required before Approve");
    expect(pageSource).toContain('placeholder="Select company size"');
    expect(pageSource).not.toContain("__none__");
    expect(pageSource).not.toContain("Industry | Company Size");
    expect(pageSource).not.toContain("buildIssuerProfileRows");
    expect(pageSource).not.toContain("Issuer Information");
  });

  it("shows 3-Year Financial Comparison from API table plus officer overrides on Page 2", () => {
    expect(pageSource).toContain('title="3-Year Financial Comparison (MYR mil.)"');
    expect(pageSource).toContain("financialComparison");
    expect(pageSource).toContain("data-prospectus-financial-comparison");
    expect(pageSource).toContain("financial-comparison-ops-warning");
    expect(pageSource).toContain("opsWarning");
    expect(pageSource).not.toContain("TEMPORARY: local visual review only");
    expect(pageSource).not.toContain("temporaryFinancialComparisonOpsWarning");
    expect(pageSource).toContain("PAGE_TWO_OFFICER_FINANCIAL_METRICS");
    expect(pageSource).toContain("mergeOfficerOverridesIntoFinancialTable");
    expect(pageSource).not.toContain("buildPageTwoFinancialComparisonTable");
    expect(pageSource).not.toContain("calculateGearing");
  });

  it("shows Paymaster Track Record from API rows plus officer inputs on Page 2", () => {
    expect(pageSource).toContain('title="Paymaster Track Record"');
    expect(pageSource).toContain("paymasterTrackRecord");
    expect(pageSource).toContain("data-prospectus-paymaster-track-record");
    expect(pageSource).toContain(
      "Historical payment performance for the selected Paymaster."
    );
    expect(pageSource).toContain("totalInvoicesPaid");
    expect(pageSource).toContain("averagePaymentPeriodDays");
    // Read-only preview from API; inputs remain for officer entry (not local aggregates).
    expect(pageSource).not.toContain("computeProspectusSuccessfulRepaymentPercent");
    expect(pageSource).not.toContain("computeOnTimePaymentRatePercent");
    expect(pageSource).not.toContain("track-record-aggregates");
  });

  it("shows About the Invoice / Work Performed as editable statements like Highlights", () => {
    expect(pageSource).toContain('title="About the Invoice / Work Performed"');
    expect(pageSource).toContain("data-prospectus-about-invoice");
    expect(pageSource).toContain("aboutInvoice");
    expect(pageSource).toContain("OFFICER_ENTERED");
    expect(pageSource).toContain("SYSTEM_SUGGESTION");
    expect(pageSource).toContain("Same pattern as Key Investor Highlights");
    expect(pageSource).not.toContain('title="Invoice / Work Information"');
  });

  it("shows Invoice & Paymaster Information from API rows plus officer selects on Page 2", () => {
    expect(pageSource).toContain('title="Invoice & Paymaster Information"');
    expect(pageSource).toContain("invoicePaymaster");
    expect(pageSource).toContain("data-prospectus-invoice-paymaster");
    expect(pageSource).toContain(
      "Invoice and paymaster facts shown in the investor Prospectus."
    );
    expect(pageSource).toContain("prospectus-deed-of-assignment");
    expect(pageSource).toContain("prospectus-paymaster-rating");
    expect(pageSource).toContain("prospectus-confidence-grading");
    expect(pageSource).toContain("PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES");
    expect(pageSource).toContain("PROSPECTUS_PAYMASTER_RATING_VALUES");
    expect(pageSource).toContain("PROSPECTUS_CONFIDENCE_GRADING_VALUES");
    expect(pageSource).not.toContain("buildInvoicePaymasterVerificationRows");
    expect(pageSource).not.toMatch(
      /Invoice & Paymaster Information[\s\S]{0,800}financing_ratio/
    );
    expect(pageSource).not.toMatch(/data-prospectus-invoice-paymaster[\s\S]{0,400}<Input/);
  });

  it("shows read-only Historical Notes from API table on Page 1 after Issuer Track Record", () => {
    expect(pageSource).toContain("ProspectusHistoricalNotesTable");
    expect(pageSource).toContain("historicalNotes");
    expect(pageSource).toContain('title="Historical Notes"');
    expect(pageSource).toContain(
      "Previous eligible Notes for this issuer, excluding the current Note."
    );
    expect(pageSource).toContain("data-prospectus-historical-notes");
    // No editable controls for Historical Notes.
    expect(pageSource).not.toMatch(/Historical Notes[\s\S]{0,400}<Input/);
    expect(pageSource).not.toMatch(/Historical Notes[\s\S]{0,400}<Textarea/);
    expect(pageSource).not.toMatch(/Historical Notes[\s\S]{0,400}<Select/);
    // Historical Notes section is rendered after Issuer Track Record mapping.
    const issuerIdx = pageSource.indexOf('section.id === "issuer-track-record"');
    const historicalIdx = pageSource.indexOf("data-prospectus-historical-notes");
    expect(issuerIdx).toBeGreaterThan(-1);
    expect(historicalIdx).toBeGreaterThan(issuerIdx);
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
    expect(pageSource).toContain("financialComparison");
    expect(pageSource).toContain("mergeOfficerOverridesIntoFinancialTable");
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
