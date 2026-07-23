import { SOUKSCORE_RISK_RATING_GRADES } from "@cashsouk/types";
import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";
import {
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_CANVA_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_DEMO_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INVALID_INPUT,
  SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT,
} from "./prospectus-soukscore-rating-scale.sample-data";
import {
  PROSPECTUS_SOUKSCORE_GRADE_ORDER,
  PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES,
  PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING,
  PROSPECTUS_SOUKSCORE_SCALE_VERSION,
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
    expect(data.scaleVersion).toBe(PROSPECTUS_SOUKSCORE_SCALE_VERSION);
    expect(data.scaleVersion).toBe("2026.07.21.soukscore-scale.v1");
  });

  it.each(VALID_GRADES)("selects only valid grade %s", (grade) => {
    const data = buildProspectusSoukscoreRatingScale({ selectedRiskRating: grade });
    const selected = data.grades.filter((g) => g.isSelected);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.grade).toBe(grade);
    expect(data.selectedGrade).toBe(grade);
    expect(data.missingRatingMessage).toBeNull();
    expect(data.grades.filter((g) => !g.isSelected)).toHaveLength(5);
  });

  it("highlights demo BBB grade", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_DEMO_INPUT
    );
    expect(data.selectedGrade).toBe("BBB");
    expect(data.grades.find((g) => g.grade === "BBB")?.isSelected).toBe(true);
    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).toContain('data-grade="BBB" data-selected="true"');
    expect((html.match(/data-grade="[^"]+" data-selected="true"/g) ?? []).length).toBe(1);
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
      { selectedRiskRating: "90%" },
      { selectedRiskRating: 90 },
    ]) {
      const data = buildProspectusSoukscoreRatingScale(input);
      expect(data.grades.every((g) => g.isSelected === false)).toBe(true);
      expect(data.selectedGrade).toBeNull();
      expect(data.missingRatingMessage).toBe(PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE);
    }
    expect(
      buildProspectusSoukscoreRatingScale().audit.selection.invalidSelectionDefaultsToGrade
    ).toBe(false);
  });

  it("renders full-scale catalogue labels and explanations without Assessment Note DNA", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    expect(data).not.toHaveProperty("assessmentNote");
    for (const grade of data.grades) {
      expect(grade.label.length).toBeGreaterThan(0);
      expect(grade.explanation.length).toBeGreaterThan(0);
    }
    expect(data.audit.display.assessmentNoteRendered).toBe(false);
    expect(data.audit.display.riskLabelsRendered).toBe(true);
    expect(data.audit.display.definitionsRendered).toBe(true);

    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).toContain('class="grade-label"');
    expect(html).toContain('class="grade-desc"');
    expect(html).toContain("Moderately Low Risk");
    expect(html).not.toContain("Assessment Note");
    expect(html).not.toContain("Definition:");
    expect(html).not.toContain('class="soukscore-missing"');
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

  it("uses catalogue wording only — no PD %, thresholds, or Credit Insights derivation", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).toContain("Very Low Risk");
    expect(html).toContain("Moderately Low Risk");
    expect(html).toContain("Elevated Risk");
    expect(html).not.toMatch(/probability of default|default probability/i);
    expect(html).not.toMatch(/90%|75%|60%/);
    expect(html).not.toMatch(/threshold|score range/i);
    expect(html).not.toContain("Credit Insights");
    expect(html).not.toContain("creditScore");
    expect(data.audit.scale.numericThresholdsAvailable).toBe(false);
    expect(data.audit.scale.creditInsightsDerived).toBe(false);
    expect(data.audit.scale.externalRatingDefinitionsUsed).toBe(false);
    expect(data.audit.claims.generatedRiskClaimAllowed).toBe(false);
    expect(data.audit.selection.prospectusEditable).toBe(false);
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
    expect(html).not.toContain('"audit"');
  });

  it("HTML shows heading, horizontal scale, structural selection, and missing-grade message", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).toContain("RISK RATING SCALE");
    expect(html).toContain('class="soukscore-scale"');
    expect(html).toContain(`data-soukscore-scale-version="${PROSPECTUS_SOUKSCORE_SCALE_VERSION}"`);
    expect(html).toContain('data-grade="AAA"');
    expect(html).toContain('data-grade="AA"');
    expect(html).toContain('data-grade="A"');
    expect(html).toContain('data-grade="BBB"');
    expect(html).toContain('data-grade="BB"');
    expect(html).toContain('data-grade="B"');
    expect(html).toContain('data-grade="AA" data-selected="true"');
    expect(html).toContain('aria-current="true"');
    expect((html.match(/data-grade="[^"]+" data-selected="true"/g) ?? []).length).toBe(1);
    expect((html.match(/data-grade="[^"]+" data-selected="false"/g) ?? []).length).toBe(5);
    expect(html).not.toContain('class="soukscore-missing"');

    const missingHtml = buildProspectusSoukscoreRatingScaleDocument(
      buildProspectusSoukscoreRatingScale(SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT)
    );
    expect(missingHtml).toContain('class="soukscore-missing"');
    expect(missingHtml).toContain(PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE);
    expect((missingHtml.match(/class="soukscore-missing"/g) ?? []).length).toBe(1);
    expect((missingHtml.match(/data-grade="[^"]+" data-selected="true"/g) ?? []).length).toBe(0);

    expect(PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES.assessmentNote.availability).toBe(
      "omitted"
    );
    expect(PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES.selectedRiskRating.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
  });
});
