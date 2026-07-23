import {
  CASHSCOUK_RISK_RATING_CATALOGUE,
  SOUKSCORE_RISK_RATING_CATALOGUE,
  SOUKSCORE_RISK_RATING_GRADES,
  SOUKSCORE_RISK_RATING_UNAVAILABLE,
  resolveSoukscoreRiskRatingPresentation,
} from "@cashsouk/types";
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
  it("documents Cashsouk snapshot source and catalogue-backed label/description", () => {
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.surface).toBe("canva");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskLabel.availability).toBe("static");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskLabel.canonicalSource).toContain(
      "CASHSCOUK_RISK_RATING_CATALOGUE"
    );
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskScore.surface).toBe("audit");
    expect(SOUKSCORE_RISK_RATING_GRADES).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("maps every Cashsouk grade to the shared catalogue label, description and colour", () => {
    for (const grade of SOUKSCORE_RISK_RATING_GRADES) {
      const entry = SOUKSCORE_RISK_RATING_CATALOGUE[grade];
      const built = buildProspectusRiskAssessment({ soukscoreRiskRating: grade });
      const resolved = resolveSoukscoreRiskRatingPresentation(grade);
      expect(built.canva.riskGrade).toBe(grade);
      expect(built.canva.riskLabel).toBe(entry.label);
      expect(built.canva.riskExplanation).toBe(entry.explanation);
      expect(built.canva.riskGradeColor).toBe(CASHSCOUK_RISK_RATING_CATALOGUE[grade].color);
      expect(resolved.label).toBe(entry.label);
      expect(resolved.explanation).toBe(entry.explanation);
      expect(built.canva.riskLabel).not.toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(built.canva.riskExplanation).not.toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    }
  });

  it("accepts valid Cashsouk grade B with Moderate-Low Risk catalogue copy", () => {
    const built = buildProspectusRiskAssessment({ soukscoreRiskRating: "B" });
    expect(built.canva.riskGrade).toBe("B");
    expect(built.canva.riskLabel).toBe("Moderate-Low Risk");
    expect(built.canva.riskExplanation).toBe(
      CASHSCOUK_RISK_RATING_CATALOGUE.B.description
    );
    expect(built.canva.riskGradeColor).toBe("#79CF54");
    expect(built.canva.ratingScaleReference).toBe(PROSPECTUS_RATING_SCALE_REFERENCE);
    expect(built.audit.isFrozen).toBe(true);
    expect(built.audit.scaleStatus).toBe(PROSPECTUS_RATING_SCALE_STATUS);
  });

  it("shows — for invalid or missing grade", () => {
    for (const bad of ["A-", null, undefined, "Low Risk", "72", "HIGH", "AAA"] as const) {
      const built = buildProspectusRiskAssessment({ soukscoreRiskRating: bad });
      expect(built.canva.riskGrade).toBe(SOUKSCORE_RISK_RATING_UNAVAILABLE);
      expect(built.canva.riskLabel).toBe(SOUKSCORE_RISK_RATING_UNAVAILABLE);
      expect(built.canva.riskExplanation).toBe(SOUKSCORE_RISK_RATING_UNAVAILABLE);
      expect(built.audit.isFrozen).toBe(false);
    }
  });

  it("does not invent label or explanation from financial or RegTank wording when grade is invalid", () => {
    const built = buildProspectusRiskAssessment({ soukscoreRiskRating: "AAA" });
    expect(built.canva.riskLabel).toBe(SOUKSCORE_RISK_RATING_UNAVAILABLE);
    expect(built.canva.riskExplanation).not.toMatch(/government|paymaster|financial profile/i);
  });

  it("keeps numerical score and ownership only on audit; Canva HTML shows catalogue copy", () => {
    const built = buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
    expect(built.audit.riskScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.audit.riskAppliesTo).toContain("Invoice offer");
    expect(built.audit.assessmentSource).toContain("Cashsouk Risk Rating");

    const html = buildProspectusRiskAssessmentDocument(built);
    expect(html).toContain("Risk Rating: B");
    expect(html).toContain("Risk label: Moderate-Low Risk");
    expect(html).toContain(
      `Risk explanation: ${CASHSCOUK_RISK_RATING_CATALOGUE.B.description}`
    );
    expect(html).toContain(`Rating scale reference: ${PROSPECTUS_RATING_SCALE_REFERENCE}`);
    expect(html).not.toContain("Risk label: —");
    expect(html).not.toContain("Risk explanation: —");
    expect(html).not.toContain("Risk score:");
    expect(html).not.toContain("Risk applies to:");
    expect(html).not.toContain("Assessment source:");
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("CTOS");
    expect(html).not.toContain("A-");
  });
});
