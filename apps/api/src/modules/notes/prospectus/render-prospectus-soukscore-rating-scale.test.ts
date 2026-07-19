import { SOUKSCORE_RISK_RATING_GRADES } from "@cashsouk/types";
import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";
import {
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_CANVA_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INVALID_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT,
} from "./prospectus-soukscore-rating-scale.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_SOUKSCORE_GRADE_ORDER,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING,
} from "./prospectus-soukscore-rating-scale.types";
import { buildProspectusSoukscoreRatingScaleDocument } from "./render-prospectus-soukscore-rating-scale";

const VALID_GRADES = ["AAA", "AA", "A", "BBB", "BB", "B"] as const;

describe("prospectus Page 2 SoukScore Risk Rating Scale (DATA STAGE 7)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    expect(data.sectionHeading).toBe("RISK RATING SCALE");
    expect(data.sectionHeading).toBe(PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING);
  });

  it("uses exact shared canonical grade order with six grades", () => {
    const data = buildProspectusSoukscoreRatingScale();
    expect(data.grades.map((g) => g.grade)).toEqual([
      "AAA",
      "AA",
      "A",
      "BBB",
      "BB",
      "B",
    ]);
    expect(data.grades).toHaveLength(6);
    expect(PROSPECTUS_SOUKSCORE_GRADE_ORDER).toBe(SOUKSCORE_RISK_RATING_GRADES);
    expect(data.audit.scale.gradeOrder).toEqual(SOUKSCORE_RISK_RATING_GRADES);
  });

  it.each(VALID_GRADES)("selects only valid grade %s", (grade) => {
    const data = buildProspectusSoukscoreRatingScale({ selectedRiskRating: grade });
    const selected = data.grades.filter((g) => g.isSelected);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.grade).toBe(grade);
    expect(data.grades.filter((g) => !g.isSelected)).toHaveLength(5);
  });

  it("selects no grade for missing or invalid values and does not default", () => {
    for (const input of [
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT,
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INVALID_INPUT,
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_CANVA_INPUT,
      { selectedRiskRating: "D" },
      { selectedRiskRating: "E" },
      { selectedRiskRating: "AA+" },
      { selectedRiskRating: 1 },
      { selectedRiskRating: "Low Risk" },
    ]) {
      const data = buildProspectusSoukscoreRatingScale(input);
      expect(data.grades.every((g) => g.isSelected === false)).toBe(true);
      expect(data.grades.some((g) => g.grade === "AAA" && g.isSelected)).toBe(false);
    }
    expect(
      buildProspectusSoukscoreRatingScale().audit.selection.invalidSelectionDefaultsToGrade
    ).toBe(false);
  });

  it("keeps risk labels, definitions, and assessment note as DNA", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    expect(data.assessmentNote).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    for (const grade of data.grades) {
      expect(grade.riskLabel).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(grade.definition).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    }
    expect(data.audit.labels.approvedMappingAvailable).toBe(false);
    expect(data.audit.definitions.approvedStaticCopyAvailable).toBe(false);
    expect(data.audit.assessmentNote.approvedStaticCopyAvailable).toBe(false);
  });

  it("rejects Canva A–E scale items while keeping valid grade A", () => {
    const data = buildProspectusSoukscoreRatingScale({ selectedRiskRating: "A" });
    const grades = data.grades.map((g) => g.grade);
    expect(grades).toContain("A");
    expect(grades).not.toContain("C");
    expect(grades).not.toContain("D");
    expect(grades).not.toContain("E");
    expect(data.audit.scale.canvaAtoEScaleRejected).toBe(true);

    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).toContain('data-grade="A"');
    expect(html).not.toContain('data-grade="C"');
    expect(html).not.toContain('data-grade="D"');
    expect(html).not.toContain('data-grade="E"');
  });

  it("does not generate Canva labels, external definitions, or thresholds", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).not.toMatch(/Very Low Risk|Low Risk|Moderate Risk|High Risk|Very High Risk/);
    expect(html).not.toMatch(/Excellent capacity|Strong capacity|Adequate capacity/i);
    expect(html).not.toMatch(/Vulnerable|High likelihood of default/i);
    expect(html).not.toMatch(/\d+\s*[-–]\s*\d+/);
    expect(html).not.toMatch(/threshold|score range/i);
    expect(data.audit.scale.numericThresholdsAvailable).toBe(false);
    expect(data.audit.scale.externalRatingDefinitionsUsed).toBe(false);
    expect(data.audit.claims.generatedRiskClaimAllowed).toBe(false);
  });

  it("does not mix CTOS/CCRIS/RegTank/AML/KYC and hides audit metadata", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).not.toContain("CTOS");
    expect(html).not.toContain("CCRIS");
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("AML");
    expect(html).not.toContain("KYC");
    expect(data.audit.systems.ctosMixed).toBe(false);
    expect(data.audit.systems.ccrisMixed).toBe(false);
    expect(data.audit.systems.regTankMixed).toBe(false);
    expect(data.audit.systems.amlKycMixed).toBe(false);

    expect(html).not.toContain("canonicalSystem");
    expect(html).not.toContain("canvaAtoEScaleRejected");
    expect(html).not.toContain("isSoukscoreRiskRating");
    expect(html).not.toContain("approvedMappingAvailable");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain('"audit"');
  });

  it("HTML shows heading, assessment note, six grades, and structural selection only", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).toContain("RISK RATING SCALE");
    expect(html).toContain(`Assessment Note: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain('data-grade="AAA"');
    expect(html).toContain('data-grade="AA"');
    expect(html).toContain('data-grade="A"');
    expect(html).toContain('data-grade="BBB"');
    expect(html).toContain('data-grade="BB"');
    expect(html).toContain('data-grade="B"');
    expect(html).toContain('data-grade="AA" data-selected="true"');
    expect((html.match(/data-selected="true"/g) ?? []).length).toBe(1);
    expect((html.match(/data-selected="false"/g) ?? []).length).toBe(5);
    expect(html).not.toContain("Selected Grade");
    expect(html).toContain(`Risk Label: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);
    expect(html).toContain(`Definition: ${PROSPECTUS_DATA_NOT_AVAILABLE}`);

    expect(PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES.assessmentNote.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES.selectedRiskRating.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
  });
});
