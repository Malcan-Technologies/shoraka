import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import { buildProspectusAtAGlance } from "./prospectus-at-a-glance";
import { SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT } from "./prospectus-at-a-glance.sample-data";
import {
  PROSPECTUS_AT_A_GLANCE_AUDIT,
  PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES,
  PROSPECTUS_DATA_NOT_AVAILABLE,
} from "./prospectus-at-a-glance.types";
import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import {
  buildProspectusMainFinancialTerms,
  formatProspectusMoneyMyr,
  formatProspectusProfitRatePercent,
} from "./prospectus-main-financial-terms";
import { buildProspectusAtAGlanceDocument } from "./render-prospectus-at-a-glance";

describe("prospectus At a Glance (Page 1 DATA STAGE 6)", () => {
  it("documents Stage 4A/Stage 2 reuse and corrected labels", () => {
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.profitRate.label).toBe("Profit Rate (p.a.)");
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.expectedReturn.label).toBe(
      "Expected Return (p.a.)"
    );
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.financingAmount.reusedFrom).toContain("Stage 4A");
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.tenure.reusedFrom).toContain("Stage 2");
    expect(PROSPECTUS_AT_A_GLANCE_FIELD_SOURCES.profitRate.notes).toMatch(/Investors/i);
  });

  it("matches Stage 4A financing amount when available and DNA when missing", () => {
    const available = buildProspectusAtAGlance(SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT);
    const terms = buildProspectusMainFinancialTerms({
      targetAmount: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.targetAmount,
      profitRatePercent: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.profitRatePercent,
    });
    expect(available.financingAmount).toBe(terms.financingAmount);
    expect(available.financingAmount).toBe("RM 500,000.00");

    const missing = buildProspectusAtAGlance({
      ...SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT,
      targetAmount: null,
    });
    expect(missing.financingAmount).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("matches Stage 4A profit rate formatting including decimals and missing", () => {
    const available = buildProspectusAtAGlance(SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT);
    expect(available.profitRate).toBe("12%");
    expect(available.profitRate).toBe(
      formatProspectusProfitRatePercent(SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.profitRatePercent)
    );

    const decimal = buildProspectusAtAGlance({
      ...SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT,
      profitRatePercent: 10.25,
    });
    expect(decimal.profitRate).toBe(formatProspectusProfitRatePercent(10.25));

    const missing = buildProspectusAtAGlance({
      ...SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT,
      profitRatePercent: null,
    });
    expect(missing.profitRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Stage 4A portal expected return and Stage 2 tenure / min", () => {
    const glance = buildProspectusAtAGlance(SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT);
    const terms = buildProspectusMainFinancialTerms({
      targetAmount: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.targetAmount,
      profitRatePercent: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.profitRatePercent,
      serviceFeeRatePercent: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.serviceFeeRatePercent,
    });
    const timing = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT.maturityDate,
    });

    expect(glance.expectedReturn).toBe(terms.expectedReturnForInvestmentPeriod);
    expect(glance.expectedReturn).toBe("10.8%");
    expect(glance.tenure).toBe(timing.tenure);
    expect(glance.tenure).toBe("120 days");
    expect(glance.minimumInvestment).toBe(terms.minimumInvestment);
    expect(glance.minimumInvestment).toBe(formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR));
    expect(glance.minimumInvestment).toBe("RM 100.00");

    const missingTenure = buildProspectusAtAGlance({
      ...SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT,
      listingOpensAt: null,
      maturityDate: null,
    });
    expect(missingTenure.tenure).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Stage 4A and Stage 2 builders without duplicate formulas or hardcoded min", () => {
    const moduleSource = readFileSync(join(__dirname, "prospectus-at-a-glance.ts"), "utf8");
    expect(moduleSource).toContain("buildProspectusMainFinancialTerms");
    expect(moduleSource).toContain("buildProspectusTenureAndMaturity");
    expect(moduleSource).not.toContain("/365");
    expect(moduleSource).not.toContain("computeNetExpectedReturnRatePercent");
    expect(moduleSource).not.toContain("calculateCalendarDayCount");
    expect(moduleSource).not.toMatch(/\b100\b/);
    expect(moduleSource).not.toContain("formatProspectusMoneyMyr");
    expect(moduleSource).not.toContain("formatProspectusProfitRatePercent");
  });

  it("renders Canva-facing labels only and hides audit metadata", () => {
    const data = buildProspectusAtAGlance(SAMPLE_PROSPECTUS_AT_A_GLANCE_INPUT);
    expect(data.audit).toEqual(PROSPECTUS_AT_A_GLANCE_AUDIT);
    expect(data.audit.profitRate.meaning).toBe("annual_gross_before_fees");
    expect(data.audit.expectedReturn.formulaDecision).toBe(
      "resolveNetExpectedReturnRatePercent"
    );

    const html = buildProspectusAtAGlanceDocument(data);
    expect(html).toContain("Financing Amount: RM 500,000.00");
    expect(html).toContain("Profit Rate (p.a.): 12%");
    expect(html).toContain("Expected Return (p.a.): 10.8%");
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Minimum Investment: RM 100.00");
    expect(html).toContain("Profit Rate (p.a.)");
    expect(html).toContain("Expected Return (p.a.)");
    expect(html).not.toContain("Profit Rate for Investors");
    expect(html).not.toContain("Profit Rate (p.a.): 12% p.a.");
    expect(html).not.toContain("Expected Returns");
    expect(html).not.toContain("for investment period");
    expect(html).not.toContain("3.95%");
    expect(html).not.toContain("reusedFromStage4A");
    expect(html).not.toContain("annual_gross_before_fees");
    expect(html).not.toContain("formulaDecision");
    expect(html).not.toContain("sourceType");
    expect(html).not.toContain("labelDecision");
    expect(html).not.toContain("Canonical source");
    expect(html).not.toContain("Reused from");
  });
});
