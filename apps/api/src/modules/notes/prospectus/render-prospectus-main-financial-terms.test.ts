import { MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
import {
  buildProspectusMainFinancialTerms,
  formatProspectusMoneyMyr,
  formatProspectusProfitRatePa,
} from "./prospectus-main-financial-terms";
import { SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT } from "./prospectus-main-financial-terms.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
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
    expect(
      PROSPECTUS_MAIN_FINANCIAL_TERMS_FIELD_SOURCES.expectedReturnForInvestmentPeriod.availability
    ).toBe("unresolved");
  });

  it("formats money and gross profit rate; leaves period return unavailable", () => {
    expect(formatProspectusMoneyMyr(500_000)).toBe("RM 500,000.00");
    expect(formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR)).toBe("RM 100.00");
    expect(formatProspectusProfitRatePa(12)).toBe("12% p.a.");
    expect(formatProspectusProfitRatePa(null)).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const built = buildProspectusMainFinancialTerms(SAMPLE_PROSPECTUS_MAIN_FINANCIAL_TERMS_INPUT);
    expect(built.financingAmount).toBe("RM 500,000.00");
    expect(built.minimumInvestment).toBe("RM 100.00");
    expect(built.profitRate).toBe("12% p.a.");
    expect(built.expectedReturnForInvestmentPeriod).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not hardcode 100 and uses MARKETPLACE_MIN_COMMIT_MYR", () => {
    const built = buildProspectusMainFinancialTerms({
      targetAmount: 1_000,
      profitRatePercent: 10,
    });
    expect(built.minimumInvestment).toBe(formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR));
  });

  it("returns Data not available for missing financing amount or profit rate", () => {
    const missing = buildProspectusMainFinancialTerms({
      targetAmount: null,
      profitRatePercent: undefined,
    });
    expect(missing.financingAmount).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.profitRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.expectedReturnForInvestmentPeriod).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 4A lines", () => {
    const html = buildProspectusMainFinancialTermsDocument();
    expect(html).toContain("Financing amount: RM 500,000.00");
    expect(html).toContain("Minimum investment: RM 100.00");
    expect(html).toContain("Profit rate: 12% p.a.");
    expect(html).toContain(
      `Expected return for investment period: ${PROSPECTUS_DATA_NOT_AVAILABLE}`
    );
    expect(html).toContain("notes.target_amount");
  });
});
