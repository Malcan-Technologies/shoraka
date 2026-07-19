import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import { buildProspectusReturnHighlight } from "./prospectus-return-highlight";
import { SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT } from "./prospectus-return-highlight.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RETURN_HIGHLIGHT_AUDIT_BASE,
  PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-return-highlight.types";
import { buildProspectusReturnHighlightDocument } from "./render-prospectus-return-highlight";

describe("prospectus Return Investor Highlight (Page 1 DATA STAGE 5C)", () => {
  it("documents Stage 4A/2 reuse and unresolved period/marketing fields", () => {
    expect(
      PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.annualGrossProfitRate.canonicalSource
    ).toContain("buildProspectusMainFinancialTerms");
    expect(PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.tenure.canonicalSource).toContain(
      "buildProspectusTenureAndMaturity"
    );
    expect(
      PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.expectedReturnForInvestmentPeriod.availability
    ).toBe("unresolved");
    expect(PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.returnClassification.availability).toBe(
      "unresolved"
    );
  });

  it("formats annual gross rate via Stage 4A", () => {
    const terms = buildProspectusMainFinancialTerms({
      targetAmount: null,
      profitRatePercent: 12,
    });
    const data = buildProspectusReturnHighlight(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT);
    expect(data.annualGrossProfitRate).toBe(terms.profitRate);
    expect(data.annualGrossProfitRate).toBe("12%");
  });

  it("returns Data not available when gross rate is missing", () => {
    const data = buildProspectusReturnHighlight({
      ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
      profitRatePercent: null,
    });
    expect(data.annualGrossProfitRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Stage 2 tenure of 120 days", () => {
    const tenure = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT.maturityDate,
    });
    const data = buildProspectusReturnHighlight(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT);
    expect(data.tenure).toBe(tenure.tenure);
    expect(data.tenure).toBe("120 days");
  });

  it("returns Data not available when tenure inputs are missing", () => {
    const data = buildProspectusReturnHighlight({
      ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
      listingOpensAt: null,
    });
    expect(data.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("formats annual net expected return for 12% gross and 15% fee as 10.2%", () => {
    const data = buildProspectusReturnHighlight(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT);
    expect(data.annualNetExpectedReturnRate).toBe("10.2%");
    expect(data.annualNetExpectedReturnRate).not.toContain("p.a.");
  });

  it("treats zero service fee as valid (net equals gross)", () => {
    const data = buildProspectusReturnHighlight({
      ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
      serviceFeeRatePercent: 0,
    });
    expect(data.annualNetExpectedReturnRate).toBe("12%");
  });

  it("returns Data not available for net rate when service fee is missing or invalid", () => {
    expect(
      buildProspectusReturnHighlight({
        ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
        serviceFeeRatePercent: null,
      }).annualNetExpectedReturnRate
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      buildProspectusReturnHighlight({
        ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
        serviceFeeRatePercent: Number.NaN,
      }).annualNetExpectedReturnRate
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      buildProspectusReturnHighlight({
        ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
        profitRatePercent: Number.NaN,
      }).annualNetExpectedReturnRate
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Stage 4A portal net expected return; keeps classifications DNA", () => {
    const terms = buildProspectusMainFinancialTerms({
      targetAmount: 500_000,
      profitRatePercent: 12,
      serviceFeeRatePercent: 15,
    });
    const data = buildProspectusReturnHighlight(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT);
    expect(data.expectedReturnForInvestmentPeriod).toBe(
      terms.expectedReturnForInvestmentPeriod
    );
    expect(data.expectedReturnForInvestmentPeriod).toBe("10.2%");
    expect(data.returnClassification).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.tenureClassification).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit).toEqual(PROSPECTUS_RETURN_HIGHLIGHT_AUDIT_BASE);
    expect(data.audit.dateBasis.basesEquivalent).toBe(false);
  });

  it("reuses Stage 4A and Stage 2 without period formulas or local tenure math", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-return-highlight.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("buildProspectusMainFinancialTerms");
    expect(moduleSource).toContain("buildProspectusTenureAndMaturity");
    expect(moduleSource).toContain("computeNetExpectedReturnRatePercent");
    expect(moduleSource).not.toContain("calculateCalendarDayCount");
    expect(moduleSource).not.toMatch(/\/\s*365/);
    expect(moduleSource).not.toContain("3.95");
  });

  it("renders Canva-facing HTML without marketing claims or audit keys", () => {
    const html = buildProspectusReturnHighlightDocument();
    expect(html).toContain("Annual Gross Profit Rate: 12%");
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Annual Net Expected Return Rate (p.a.): 10.2%");
    expect(html).toContain("Expected Return (p.a.): 10.2%");
    expect(html).toContain("Return Classification: Data not available");
    expect(html).toContain("Tenure Classification: Data not available");
    expect(html).toContain("Highlight Title: Data not available");
    expect(html).toContain("Highlight Explanation: Data not available");
    expect(html).not.toContain("3.95%");
    expect(html).not.toContain("Attractive short-term returns");
    expect(html).not.toContain("Earn up to");
    expect(html).not.toMatch(/after fees/i);
    expect(html).not.toMatch(/guaranteed/i);
    expect(html).not.toContain("serviceFeeRatePercent");
    expect(html).not.toContain("dateBasis");
    expect(html).not.toContain("claimApproval");
    expect(html).not.toContain("sourceType");
    expect(html).not.toContain("calculationFormula");
    expect(html).not.toContain("activated_at");
    expect(html).not.toContain("opens_at");
  });
});
