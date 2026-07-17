import { buildProspectusAtAGlance } from "./prospectus-at-a-glance";
import { SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT } from "./prospectus-at-a-glance.sample-data";
import {
  PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES,
  PROSPECTUS_DATA_NOT_AVAILABLE,
} from "./prospectus-at-a-glance.types";
import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import { buildProspectusAtAGlanceDocument } from "./render-prospectus-at-a-glance";

describe("prospectus At a Glance (Page 1 DATA STAGE 6)", () => {
  it("documents reuse of Stage 4A and Stage 2 and safer labels than Canva", () => {
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.profitRate.displayLabel).toBe(
      "Profit rate (p.a.)"
    );
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.profitRate.notes).toMatch(/Investors/i);
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.expectedReturn.displayLabel).toBe(
      "Expected return"
    );
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.financingAmount.reusedFrom).toContain("Stage 4A");
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.tenure.reusedFrom).toContain("Stage 2");
  });

  it("matches Stage 4A and Stage 2 outputs for the same inputs", () => {
    const glance = buildProspectusAtAGlance(SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT);
    const terms = buildProspectusMainFinancialTerms({
      targetAmount: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.targetAmount,
      profitRatePercent: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.profitRatePercent,
    });
    const timing = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.maturityDate,
    });

    expect(glance.financingAmount).toBe(terms.financingAmount);
    expect(glance.profitRate).toBe(terms.profitRate);
    expect(glance.expectedReturn).toBe(terms.expectedReturnForInvestmentPeriod);
    expect(glance.expectedReturn).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(glance.minimumInvestment).toBe(terms.minimumInvestment);
    expect(glance.tenure).toBe(timing.tenure);
    expect(glance.financingAmount).toBe("RM 500,000.00");
    expect(glance.profitRate).toBe("12%");
    expect(glance.tenure).toBe("120 days");
    expect(glance.minimumInvestment).toBe("RM 100.00");
  });

  it("renders plain HTML with Stage 6 summary lines", () => {
    const html = buildProspectusAtAGlanceDocument();
    expect(html).toContain("Financing amount: RM 500,000.00");
    expect(html).toContain("Profit rate: 12%");
    expect(html).toContain("Expected return: Data not available");
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Minimum investment: RM 100.00");
    expect(html).not.toContain("Profit Rate for Investors");
    expect(html).not.toContain("Expected Returns");
  });
});
