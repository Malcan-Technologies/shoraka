import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatInvestorReturnRatePercent,
  MARKETPLACE_MIN_COMMIT_MYR,
} from "@cashsouk/types";
import {
  buildProspectusMainFinancialTerms,
  formatProspectusMoneyMyr,
  formatProspectusProfitRatePa,
  formatProspectusProfitRatePercent,
} from "./prospectus-main-financial-terms";
import { SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT } from "./prospectus-main-financial-terms.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_EXPECTED_RETURN_AUDIT,
  PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES,
} from "./prospectus-main-financial-terms.types";
import { buildProspectusMainFinancialTermsDocument } from "./render-prospectus-main-financial-terms";

describe("prospectus Main Financial Terms (Page 1 DATA STAGE 4A)", () => {
  it("documents canonical sources without period-return invention", () => {
    expect(PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.financingAmount.canonicalSource).toBe(
      "notes.target_amount"
    );
    expect(PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.minimumInvestment.canonicalSource).toContain(
      "MARKETPLACE_MIN_COMMIT_MYR"
    );
    expect(PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.profitRate.canonicalSource).toBe(
      "notes.profit_rate_percent"
    );
    expect(PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.profitRate.label).toBe(
      "Profit Rate (p.a.)"
    );
    expect(
      PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.expectedReturnForInvestmentPeriod.availability
    ).toBe("calculated");
    expect(
      PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.expectedReturnForInvestmentPeriod.canonicalSource
    ).toContain("resolveNetExpectedReturnRatePercent");
  });

  it("formats financing amount when available", () => {
    const built = buildProspectusMainFinancialTerms({
      targetAmount: 500_000,
      profitRatePercent: 12,
    });
    expect(built.financingAmount).toBe("RM 500,000.00");
    expect(formatProspectusMoneyMyr(500_000)).toBe("RM 500,000.00");
  });

  it("returns Data not available for missing financing amount", () => {
    const missing = buildProspectusMainFinancialTerms({
      targetAmount: null,
      profitRatePercent: 12,
    });
    expect(missing.financingAmount).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("uses MARKETPLACE_MIN_COMMIT_MYR and does not hardcode the min in the module", () => {
    const built = buildProspectusMainFinancialTerms({
      targetAmount: 1_000,
      profitRatePercent: 10,
    });
    expect(built.minimumInvestment).toBe(formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR));
    expect(built.minimumInvestment).toBe("RM 100.00");

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-main-financial-terms.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("MARKETPLACE_MIN_COMMIT_MYR");
    expect(moduleSource).not.toMatch(/minimumInvestment:\s*formatProspectusMoneyMyr\(\s*100\s*\)/);
    expect(moduleSource).not.toMatch(/formatProspectusMoneyMyr\(\s*100\s*\)/);
  });

  it("formats annual gross profit rate without duplicating p.a. in the value", () => {
    expect(formatProspectusProfitRatePercent(12)).toBe("12%");
    expect(formatProspectusProfitRatePercent(null)).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    // Legacy helper for stages whose labels omit (p.a.)
    expect(formatProspectusProfitRatePa(12)).toBe("12% p.a.");

    const built = buildProspectusMainFinancialTerms(SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT);
    expect(built.profitRate).toBe("12%");
    expect(built.profitRate).not.toContain("p.a.");
  });

  it("reuses platform rate precision (1dp investor convention) for decimal rates", () => {
    // formatInvestorReturnRatePercent intentionally rounds to 1 decimal.
    expect(formatInvestorReturnRatePercent(10.25)).toBe("10.3%");
    expect(formatProspectusProfitRatePercent(10.25)).toBe("10.3%");
    expect(formatProspectusProfitRatePercent(10.2)).toBe("10.2%");
    expect(formatProspectusProfitRatePercent(10.375)).toBe("10.4%");
  });

  it("returns Data not available for missing or invalid profit rate", () => {
    expect(
      buildProspectusMainFinancialTerms({
        targetAmount: 500_000,
        profitRatePercent: undefined,
      }).profitRate
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      buildProspectusMainFinancialTerms({
        targetAmount: 500_000,
        profitRatePercent: Number.NaN,
      }).profitRate
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("matches portal net expected return helper (no prospectus-only formula)", () => {
    const built = buildProspectusMainFinancialTerms(SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT);
    expect(built.expectedReturnForInvestmentPeriod).toBe("10.8%");
    expect(built.audit.expectedReturn).toEqual(PROSPECTUS_EXPECTED_RETURN_AUDIT);
    expect(built.audit.expectedReturn.status).toBe("resolved_portal_net_annual");
    expect(built.audit.expectedReturn.helper).toBe("resolveNetExpectedReturnRatePercent");
    expect(built.audit.expectedReturn.periodFormulaUsed).toBe(false);
    expect(built.audit.expectedReturn.closingDateUsedAsStart).toBe(false);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-main-financial-terms.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("resolveNetExpectedReturnRatePercent");
    expect(moduleSource).not.toMatch(/profitDays\s*\//);
  });

  it("renders Canva-facing HTML with portal Expected Return (p.a.)", () => {
    const html = buildProspectusMainFinancialTermsDocument();
    expect(html).toContain("Financing Amount: RM 500,000.00");
    expect(html).toContain("Minimum Investment: RM 100.00");
    expect(html).toContain("Profit Rate (p.a.): 12%");
    expect(html).not.toContain("Profit Rate (p.a.): 12% p.a.");
    expect(html).not.toContain("Profit Rate for Investors");
    expect(html).toContain("Expected Return (p.a.): 10.8%");
    expect(html).not.toContain("3.95%");
    expect(html).not.toContain("formulaDecision");
    expect(html).not.toContain("grossOrNetDecision");
    expect(html).not.toContain("computeNetExpectedReturnRatePercent");
    expect(html).toContain("notes.target_amount");
  });

  it("does not import or call annual-net period substitution in the builder module", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-main-financial-terms.ts"),
      "utf8"
    );
    expect(moduleSource).not.toContain("computeNetExpectedReturnRatePercent");
    expect(moduleSource).not.toContain("expectedReturnRatePercent");
    expect(moduleSource).not.toContain("3.95");
    expect(moduleSource).not.toMatch(/\/\s*365/);
  });
});
