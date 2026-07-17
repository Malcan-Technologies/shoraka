import { SOUKSCORE_RISK_RATING_GRADES } from "@cashsouk/types";
import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import { SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT } from "./prospectus-risk-assessment.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RATING_SCALE_REFERENCE,
  PROSPECTUS_RATING_SCALE_STATUS,
  PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES,
} from "./prospectus-risk-assessment.types";
import { buildProspectusRiskAssessmentDocument } from "./render-prospectus-risk-assessment";

describe("prospectus Risk Assessment (Page 1 DATA STAGE 3)", () => {
  it("documents SoukScore snapshot source and Canva vs audit surfaces", () => {
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.surface).toBe("canva");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskLabel.availability).toBe("not_stored");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskScore.surface).toBe("audit");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskAppliesTo.surface).toBe("audit");
    expect(SOUKSCORE_RISK_RATING_GRADES).toEqual(["AAA", "AA", "A", "BBB", "BB", "B"]);
  });

  it("accepts valid SoukScore grade AA", () => {
    const built = buildProspectusRiskAssessment({ soukscoreRiskRating: "AA" });
    expect(built.canva.riskGrade).toBe("AA");
    expect(built.canva.riskLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.canva.riskExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.canva.ratingScaleReference).toBe(PROSPECTUS_RATING_SCALE_REFERENCE);
    expect(built.audit.isFrozen).toBe(true);
    expect(built.audit.scaleStatus).toBe(PROSPECTUS_RATING_SCALE_STATUS);
  });

  it("rejects Canva A- as Data not available", () => {
    const invalid = buildProspectusRiskAssessment({ soukscoreRiskRating: "A-" });
    expect(invalid.canva.riskGrade).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(invalid.audit.isFrozen).toBe(false);
  });

  it("returns Data not available for missing grade", () => {
    const missing = buildProspectusRiskAssessment({ soukscoreRiskRating: null });
    expect(missing.canva.riskGrade).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.canva.riskLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not derive a risk label from the grade", () => {
    for (const grade of SOUKSCORE_RISK_RATING_GRADES) {
      const built = buildProspectusRiskAssessment({ soukscoreRiskRating: grade });
      expect(built.canva.riskLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(built.canva.riskLabel).not.toMatch(/Low|Moderate|High Risk/i);
    }
  });

  it("does not generate a risk explanation", () => {
    const built = buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
    expect(built.canva.riskExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.canva.riskExplanation).not.toMatch(/government|financial profile|paymaster/i);
  });

  it("keeps numerical score and ownership only on audit; Canva HTML omits them", () => {
    const built = buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
    expect(built.audit.riskScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.audit.riskAppliesTo).toContain("Invoice offer");
    expect(built.audit.assessmentSource).toContain("Admin SoukScore");

    const html = buildProspectusRiskAssessmentDocument(built);
    expect(html).toContain("Risk Rating: AA");
    expect(html).toContain(`Risk label: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(`Risk explanation: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(`Rating scale reference: ${PROSPECTUS_RATING_SCALE_REFERENCE}`);
    expect(html).toContain(PROSPECTUS_RATING_SCALE_STATUS);
    expect(html).not.toContain("Risk score:");
    expect(html).not.toContain("Risk applies to:");
    expect(html).not.toContain("Assessment source:");
    expect(html).not.toContain("Frozen on Note");
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("CTOS");
    expect(html).not.toContain("A-");
    expect(html).not.toContain("Low Risk");
  });

  it("does not accept RegTank or CTOS values as Note risk grade", () => {
    expect(
      buildProspectusRiskAssessment({ soukscoreRiskRating: "Low Risk" }).canva.riskGrade
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      buildProspectusRiskAssessment({ soukscoreRiskRating: "72" }).canva.riskGrade
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(
      buildProspectusRiskAssessment({ soukscoreRiskRating: "HIGH" }).canva.riskGrade
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });
});
