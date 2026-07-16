import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import { SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT } from "./prospectus-risk-assessment.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RATING_SCALE_REFERENCE,
  PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES,
} from "./prospectus-risk-assessment.types";
import { buildProspectusRiskAssessmentDocument } from "./render-prospectus-risk-assessment";

describe("prospectus Risk Assessment (Page 1 DATA STAGE 3)", () => {
  it("documents SoukScore snapshot source and rejects Canva-only fields as stored", () => {
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskLabel.availability).toBe("not_stored");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskScore.availability).toBe("not_stored");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskExplanation.availability).toBe("not_stored");
  });

  it("accepts valid SoukScore grades and leaves label/score/explanation unavailable", () => {
    const built = buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
    expect(built.riskGrade).toBe("A");
    expect(built.riskLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.riskScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.riskExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.ratingScaleReference).toBe(PROSPECTUS_RATING_SCALE_REFERENCE);
    expect(built.riskAppliesTo).toContain("invoice");
    expect(built.assessmentSource).toContain("Admin SoukScore");
  });

  it("rejects Canva A- and unknown grades as Data not available", () => {
    const invalid = buildProspectusRiskAssessment({ soukscoreRiskRating: "A-" });
    expect(invalid.riskGrade).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(invalid.riskAppliesTo).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(invalid.assessmentSource).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const missing = buildProspectusRiskAssessment({ soukscoreRiskRating: null });
    expect(missing.riskGrade).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 3 lines", () => {
    const html = buildProspectusRiskAssessmentDocument();
    expect(html).toContain("Risk grade: A");
    expect(html).toContain(`Risk label: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(`Risk score: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(`Risk explanation: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(`Rating scale reference: ${PROSPECTUS_RATING_SCALE_REFERENCE}`);
    expect(html).toContain("notes.invoice_snapshot.offer_details.risk_rating");
  });
});
