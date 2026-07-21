import { buildProspectusCreditInsights } from "./prospectus-credit-insights";
import { SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT } from "./prospectus-credit-insights.sample-data";
import {
  PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES,
  PROSPECTUS_CREDIT_INSIGHTS_FOOTER_REQUIRES_LEGAL_APPROVAL,
  PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
  PROSPECTUS_DATA_NOT_AVAILABLE,
} from "./prospectus-credit-insights.types";
import { buildProspectusCreditInsightsDocument } from "./render-prospectus-credit-insights";
import { PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE } from "../prospectus-review/prospectus-option-catalogues";

const SOUKSCORES = ["AAA", "AA", "A", "BBB", "BB", "B"] as const;

const DEMO_SELECTIONS = {
  creditScore: "good",
  paymentBehaviour: "good",
  creditUtilisation: "healthy",
  litigationCheck: "clear",
  ccrisStatus: "no_record",
} as const;

describe("prospectus Page 2 Credit Insights (DATA STAGE 5)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
    expect(data.sectionHeading).toBe("CREDIT INSIGHTS");
    expect(data.sectionHeading).toBe(PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING);
  });

  it("returns DNA for five rows when no officer selections (ignores CTOS-like inputs)", () => {
    const data = buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
    expect(data.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymentBehaviour).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.creditUtilisation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.litigationCheck).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.ccrisStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data).not.toHaveProperty("omittedFields");
    expect(data).not.toHaveProperty("creditScoreExplanation");
  });

  it("renders Canva demo officer selections with all five rows", () => {
    const data = buildProspectusCreditInsights({
      creditInsightSelections: { ...DEMO_SELECTIONS },
    });
    expect(data.creditScore).toBe("Good");
    expect(data.paymentBehaviour).toBe("Good");
    expect(data.creditUtilisation).toBe("Healthy");
    expect(data.litigationCheck).toBe("Clear");
    expect(data.ccrisStatus).toBe("No record");
  });

  it("keeps separate catalogues per row without do_not_display", () => {
    expect(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.creditScore.map((o) => o.key)).toEqual([
      "excellent",
      "good",
      "fair",
      "weak",
      "poor",
    ]);
    expect(
      PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.creditUtilisation.map((o) => o.key)
    ).toContain("healthy");
    expect(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.litigationCheck.map((o) => o.key)).toEqual([
      "clear",
      "record_found",
      "under_review",
    ]);
    for (const options of Object.values(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE)) {
      expect(options.some((o) => o.key === "do_not_display")).toBe(false);
    }
  });

  it("treats do_not_display as invalid (DNA), not as a hidden row", () => {
    const data = buildProspectusCreditInsights({
      creditInsightSelections: {
        creditScore: "do_not_display",
        paymentBehaviour: "do_not_display",
        creditUtilisation: "do_not_display",
        litigationCheck: "do_not_display",
        ccrisStatus: "do_not_display",
      },
    });
    expect(data.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymentBehaviour).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.creditUtilisation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.litigationCheck).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.ccrisStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    const html = buildProspectusCreditInsightsDocument(data);
    expect(html).toContain("Credit Score:");
    expect(html).toContain("Payment Behaviour:");
    expect(html).toContain("Credit Utilisation:");
    expect(html).toContain("Litigation Check:");
    expect(html).toContain("CCRIS Status:");
  });

  it("does not accept retired positive/neutral/negative keys", () => {
    const data = buildProspectusCreditInsights({
      creditInsightSelections: {
        creditScore: "positive",
        paymentBehaviour: "neutral",
        creditUtilisation: "negative",
        litigationCheck: "positive",
        ccrisStatus: "neutral",
      },
    });
    expect(data.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymentBehaviour).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.creditUtilisation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.litigationCheck).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.ccrisStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("ignores CTOS/FICO scores and SoukScore grades (no auto-select)", () => {
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
    expect(
      buildProspectusCreditInsights({ ctosScore: 720 }).audit.creditScore.autoSelectFromCtosAllowed
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

  it("does not render Credit Score Explanation or Canva footer", () => {
    expect(PROSPECTUS_CREDIT_INSIGHTS_FOOTER_REQUIRES_LEGAL_APPROVAL).toBe(true);
    const data = buildProspectusCreditInsights({
      creditInsightSelections: { ...DEMO_SELECTIONS },
      ssmCreditworthinessSentence:
        "Credit Score is a predictive indicator of the issuer’s credit worthiness based on data from SSM",
    });
    const html = buildProspectusCreditInsightsDocument(data);
    expect(html).not.toContain("Credit Score Explanation");
    expect(html).not.toMatch(/predictive indicator/i);
    expect(html).not.toMatch(/credit worthiness based on data from SSM/i);
    expect(data.audit.footer.rendered).toBe(false);
  });

  it("documents officer-selected field sources without CTOS auto-selection", () => {
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.creditScore.availability).toBe("stored");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.paymentBehaviour.availability).toBe("stored");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.creditUtilisation.availability).toBe("stored");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.litigationCheck.availability).toBe("stored");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES.ccrisStatus.availability).toBe("stored");
    expect(PROSPECTUS_CREDIT_INSIGHTS_FIELD_SOURCES).not.toHaveProperty("creditScoreExplanation");
  });

  it("HTML always shows all five rows with officer labels", () => {
    const data = buildProspectusCreditInsights({
      ...SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT,
      creditInsightSelections: { ...DEMO_SELECTIONS },
    });
    const html = buildProspectusCreditInsightsDocument(data);

    expect(html).toContain("CREDIT INSIGHTS");
    expect(html).toContain("Credit Score: Good");
    expect(html).toContain("Payment Behaviour: Good");
    expect(html).toContain("Credit Utilisation: Healthy");
    expect(html).toContain("Litigation Check: Clear");
    expect(html).toContain("CCRIS Status: No record");
    expect(html).not.toContain("Credit Score Explanation");
    expect(html).not.toContain("720");
    expect(html).not.toContain("FICO");
    expect(html).not.toContain('"audit"');
  });
});
