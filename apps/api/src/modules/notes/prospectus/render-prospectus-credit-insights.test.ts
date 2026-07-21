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
    expect(data).not.toHaveProperty("creditScoreExplanation");
  });

  it("renders Canva demo officer selections with per-row labels", () => {
    const data = buildProspectusCreditInsights({
      creditInsightSelections: {
        creditScore: "good",
        paymentBehaviour: "good",
        creditUtilisation: "healthy",
        litigationCheck: "clear",
        ccrisStatus: "no_record",
      },
    });
    expect(data.creditScore).toBe("Good");
    expect(data.paymentBehaviour).toBe("Good");
    expect(data.creditUtilisation).toBe("Healthy");
    expect(data.litigationCheck).toBe("Clear");
    expect(data.ccrisStatus).toBe("No record");
    expect(data.omittedFields).toEqual([]);
  });

  it("keeps separate catalogues per row", () => {
    expect(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.creditScore.map((o) => o.key)).toEqual([
      "excellent",
      "good",
      "fair",
      "weak",
      "poor",
      "do_not_display",
    ]);
    expect(
      PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.creditUtilisation.map((o) => o.key)
    ).toContain("healthy");
    expect(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.litigationCheck.map((o) => o.key)).toEqual([
      "clear",
      "record_found",
      "under_review",
      "do_not_display",
    ]);
    expect(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.ccrisStatus.map((o) => o.label)).toContain(
      "No record"
    );
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

  it("omits do_not_display rows and handles all five omitted safely", () => {
    const one = buildProspectusCreditInsights({
      creditInsightSelections: {
        creditScore: "good",
        paymentBehaviour: "do_not_display",
        creditUtilisation: "healthy",
        litigationCheck: "clear",
        ccrisStatus: "no_record",
      },
    });
    expect(one.omittedFields).toContain("paymentBehaviour");
    expect(one.paymentBehaviour).toBe("");

    const allHidden = buildProspectusCreditInsights({
      creditInsightSelections: {
        creditScore: "do_not_display",
        paymentBehaviour: "do_not_display",
        creditUtilisation: "do_not_display",
        litigationCheck: "do_not_display",
        ccrisStatus: "do_not_display",
      },
    });
    expect(allHidden.omittedFields).toHaveLength(5);
    const html = buildProspectusCreditInsightsDocument(allHidden);
    expect(html).toContain("CREDIT INSIGHTS");
    expect(html).not.toContain("Credit Score:");
    expect(html).not.toContain("Credit Score Explanation");
    expect(html).not.toMatch(/predictive indicator/i);
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
      creditInsightSelections: {
        creditScore: "good",
        paymentBehaviour: "good",
        creditUtilisation: "healthy",
        litigationCheck: "clear",
        ccrisStatus: "no_record",
      },
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

  it("HTML shows officer labels and hides audit/raw/provider fields", () => {
    const data = buildProspectusCreditInsights({
      ...SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT,
      creditInsightSelections: {
        creditScore: "good",
        paymentBehaviour: "good",
        creditUtilisation: "healthy",
        litigationCheck: "clear",
        ccrisStatus: "no_record",
      },
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
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("candidateSystem");
    expect(html).not.toContain('"audit"');
  });
});
