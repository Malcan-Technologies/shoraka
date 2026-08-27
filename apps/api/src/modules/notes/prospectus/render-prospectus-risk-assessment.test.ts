import { MARC_SCORE_DEFINITIONS, MARC_SME_GRADES } from "@cashsouk/types";
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
  it("documents frozen invoice MARC SME source", () => {
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade.surface).toBe("canva");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskLabel.availability).toBe("static");
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskExplanation.canonicalSource).toContain(
      "MARC_SCORE_DEFINITIONS"
    );
    expect(PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskScore.surface).toBe("audit");
    expect(PROSPECTUS_RATING_SCALE_STATUS).toBe("marc_sme_1_to_10");
  });

  it("maps every MARC SME grade to the official grouping label and Risk Profile", () => {
    for (const grade of MARC_SME_GRADES) {
      const built = buildProspectusRiskAssessment({ soukscoreRiskRating: grade });
      expect(built.canva.riskGrade).toBe(grade);
      expect(built.canva.riskExplanation).toBe(MARC_SCORE_DEFINITIONS[grade].riskProfile);
      expect(built.canva.marcCreditScoreDisplay).toBeNull();
      expect(built.canva.marcProbabilityOfDefaultDisplay).toBeNull();
      expect(built.canva.riskLabel).not.toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(built.canva.riskExplanation).not.toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    }
  });

  it("accepts SME-3 with Low Risk grouping label and official profile", () => {
    const built = buildProspectusRiskAssessment({ soukscoreRiskRating: "SME-3" });
    expect(built.canva.riskGrade).toBe("SME-3");
    expect(built.canva.riskLabel).toBe("Low Risk");
    expect(built.canva.riskExplanation).toBe(MARC_SCORE_DEFINITIONS["SME-3"].riskProfile);
    expect(built.canva.ratingScaleReference).toBe(PROSPECTUS_RATING_SCALE_REFERENCE);
    expect(built.audit.isFrozen).toBe(true);
    expect(built.audit.scaleStatus).toBe(PROSPECTUS_RATING_SCALE_STATUS);
  });

  it("shows — for missing, letter-grade, or otherwise invalid values", () => {
    for (const bad of ["A", "B", "C", "D", "E", "F", null, undefined, "Low Risk", "AAA"] as const) {
      const built = buildProspectusRiskAssessment({ soukscoreRiskRating: bad });
      expect(built.canva.riskGrade).toBe("—");
      expect(built.canva.riskLabel).toBe("—");
      expect(built.canva.riskExplanation).toBe("—");
      expect(built.audit.isFrozen).toBe(false);
      expect(built.canva.riskExplanation).not.toMatch(/typical SME and transaction-level risks/i);
      expect(built.canva.riskLabel).not.toBe("Moderate Risk");
    }
  });

  it("does not invent label or explanation from CashSouk A–F copy when MARC is missing", () => {
    const built = buildProspectusRiskAssessment({ soukscoreRiskRating: "C" });
    expect(built.canva.riskGrade).toBe("—");
    expect(built.canva.riskExplanation).not.toMatch(/government|paymaster|financial profile/i);
    expect(built.canva.riskExplanation).not.toContain("typical SME and transaction-level risks");
  });

  it("keeps numerical score off the Note card; Canva HTML shows SME copy", () => {
    const built = buildProspectusRiskAssessment(SAMPLE_PROSPECTUS_RISK_ASSESSMENT_INPUT);
    expect(built.audit.riskScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(built.audit.riskAppliesTo).toContain("Invoice offer");
    expect(built.audit.assessmentSource).toContain("MARC SME");

    const html = buildProspectusRiskAssessmentDocument(built);
    expect(html).toContain("Risk Rating: SME-3");
    expect(html).toContain("Risk label: Low Risk");
    expect(html).toContain(
      `Risk explanation: ${MARC_SCORE_DEFINITIONS["SME-3"].riskProfile}`
    );
    expect(html).toContain(`Rating scale reference: ${PROSPECTUS_RATING_SCALE_REFERENCE}`);
    expect(html).not.toContain("Risk label: —");
    expect(html).not.toContain("Risk explanation: —");
    expect(html).not.toContain("Risk score:");
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("CTOS");
    expect(html).not.toContain("Moderate-Low Risk");
  });

  it("does not use organization MARC score/PD on the Note risk card", () => {
    const built = buildProspectusRiskAssessment({
      soukscoreRiskRating: "SME-4",
    });
    expect(built.canva.riskGrade).toBe("SME-4");
    expect(built.canva.marcCreditScoreDisplay).toBeNull();
    expect(built.canva.marcProbabilityOfDefaultDisplay).toBeNull();
    const html = buildProspectusRiskAssessmentDocument(built);
    expect(html).toContain("Risk Rating: SME-4");
    expect(html).not.toContain("Credit Score");
  });
});
