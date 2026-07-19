import { buildProspectusCreditInsights } from "./prospectus-credit-insights";
import { SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT } from "./prospectus-credit-insights.sample-data";
import {
  PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES,
  PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
  PROSPECTUS_DATA_NOT_AVAILABLE,
} from "./prospectus-credit-insights.types";
import { buildProspectusCreditInsightsDocument } from "./render-prospectus-credit-insights";

const SOUKSCORES = ["AAA", "AA", "A", "BBB", "BB", "B"] as const;

describe("prospectus Page 2 Credit Insights (DATA STAGE 5)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
    expect(data.sectionHeading).toBe("CREDIT INSIGHTS");
    expect(data.sectionHeading).toBe(PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING);
  });

  it("returns DNA for all six fields even when unsupported credit inputs are supplied", () => {
    const data = buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
    expect(data.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymentBehaviour).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.creditUtilisation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.litigationCheck).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.ccrisStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.creditScoreExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("ignores CTOS/FICO scores and SoukScore grades", () => {
    for (const soukScore of SOUKSCORES) {
      const data = buildProspectusCreditInsights({
        ctosScore: 720,
        ficoScore: 720,
        soukScore,
        creditScoreLabel: "Good",
      });
      expect(data.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    }
    expect(
      buildProspectusCreditInsights({ soukScore: "AA" }).audit.creditScore.soukScoreReused
    ).toBe(false);
  });

  it("ignores issuer on-time, CCRIS, and facility utilisation substitutes", () => {
    const data = buildProspectusCreditInsights({
      issuerOnTimePaymentPercent: 94,
      ccrisPaymentData: { arrears: 0 },
      facilityUtilisationPercent: 45,
      paymentBehaviourLabel: "Good",
      creditUtilisationLabel: "Healthy",
    });
    expect(data.paymentBehaviour).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.creditUtilisation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.paymentBehaviour.issuerOnTimeMetricReused).toBe(false);
    expect(data.audit.creditUtilisation.facilityUtilisationSubstitutionAllowed).toBe(false);
  });

  it("does not treat zero/empty litigation or CCRIS as clear/no record", () => {
    const data = buildProspectusCreditInsights({
      litigationCount: 0,
      legalRecords: [],
      ccrisAccountCount: 0,
      litigationLabel: "Clear",
      ccrisStatusLabel: "No record",
    });
    expect(data.litigationCheck).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.ccrisStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.litigationCheck.emptyResultMeansClear).toBe(false);
  });

  it("rejects SSM explanatory sentence and Canva classifications", () => {
    const data = buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
    expect(data.creditScoreExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.creditScoreExplanation.ssmStatementAllowed).toBe(false);

    const html = buildProspectusCreditInsightsDocument(data);
    expect(html).not.toMatch(/predictive indicator/i);
    expect(html).not.toMatch(/credit worthiness based on data from SSM/i);
    expect(html).not.toMatch(/creditworthiness based on SSM/i);
    expect(html).not.toMatch(/\bGood\b|\bHealthy\b|\bClear\b|No record|Excellent|Poor/);
  });

  it("ignores RegTank, AML, and KYC and documents unresolved field sources", () => {
    const data = buildProspectusCreditInsights({
      regTankStatus: "approved",
      amlStatus: "clear",
      kycStatus: "completed",
    });
    expect(data.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.systems.regTankMixedWithCreditInsights).toBe(false);
    expect(data.audit.systems.amlKycMixedWithCreditInsights).toBe(false);
    expect(data.audit.systems.soukScoreMixedWithCreditInsights).toBe(false);

    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.creditScore.availability).toBe("unresolved");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.paymentBehaviour.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.creditUtilisation.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.litigationCheck.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.ccrisStatus.availability).toBe("unresolved");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.creditScoreExplanation.availability).toBe(
      "unresolved"
    );
  });

  it("HTML shows exactly approved labels and hides audit/raw/provider fields", () => {
    const data = buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
    const html = buildProspectusCreditInsightsDocument(data);

    expect(html).toContain("CREDIT INSIGHTS");
    expect(html).toContain("Credit Score:");
    expect(html).toContain("Payment Behaviour:");
    expect(html).toContain("Credit Utilisation:");
    expect(html).toContain("Litigation Check:");
    expect(html).toContain("CCRIS Status:");
    expect(html).toContain("Credit Score Explanation:");
    expect(html).toContain(PROSPECTUS_DATA_NOT_AVAILABLE);

    expect(html).not.toContain("720");
    expect(html).not.toContain("FICO");
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("AML");
    expect(html).not.toContain("KYC");
    expect(html).not.toContain("account count");
    expect(html).not.toContain("litigation count");
    expect(html).not.toContain("report date");
    expect(html).not.toContain("provider");
    expect(html).not.toContain("Strong credit profile");
    expect(html).not.toContain("Good creditworthiness");
    expect(html).not.toContain("Healthy utilisation");
    expect(html).not.toContain("Clear litigation");
    expect(html).not.toContain("Low credit risk");

    expect(html).not.toContain("candidateSystem");
    expect(html).not.toContain("classifierDecision");
    expect(html).not.toContain("rawScoreDisplayAllowed");
    expect(html).not.toContain("emptyResultMeansClear");
    expect(html).not.toContain("summaryDecision");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain('"audit"');
  });
});
