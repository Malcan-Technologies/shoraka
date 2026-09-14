import {
  CASHSCOUK_RISK_GRADE_LETTER_COLOR,
  MARC_SME_GRADES,
  resolveMarcNoteRiskPresentation,
} from "@cashsouk/types";
import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";
import {
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
import { PROSPECTUS_RISK_SCALE_NOTE } from "./prospectus-static-copy";
import { buildProspectusSoukscoreRatingScaleDocument } from "./render-prospectus-soukscore-rating-scale";

const VALID_GRADES = MARC_SME_GRADES;

describe("prospectus Page 2 Risk Rating Scale (DATA STAGE 7)", () => {
  it("uses static section heading Risk Rating Scale", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    expect(data.sectionHeading).toBe("Risk Rating Scale");
    expect(data.sectionHeading).toBe(PROSPECTUS_SOUKSCORE_RATING_SCALE_SECTION_HEADING);
    expect(data.sectionHeading).not.toBe("Cashsouk Risk Rating");
    expect(data.sectionHeading).not.toBe("CASHSCOUK RISK RATING");
  });

  it("uses exact shared canonical MARC SME grade order with ten grades", () => {
    const data = buildProspectusSoukscoreRatingScale();
    expect(data.grades.map((g) => g.grade)).toEqual(MARC_SME_GRADES);
    expect(data.grades).toHaveLength(10);
    expect(PROSPECTUS_SOUKSCORE_GRADE_ORDER).toBe(MARC_SME_GRADES);
    expect(data.audit.scale.gradeOrder).toEqual(MARC_SME_GRADES);
    expect(data.scaleVersion).toBe(PROSPECTUS_SOUKSCORE_SCALE_VERSION);
    expect(data.scaleVersion).toBe("2026.07.23.cashsouk-risk-scale.v1");
  });

  it.each(VALID_GRADES)("tracks selected grade %s in view-model without HTML highlight", (grade) => {
    const data = buildProspectusSoukscoreRatingScale({ selectedRiskRating: grade });
    const selected = data.grades.filter((g) => g.isSelected);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.grade).toBe(grade);
    expect(data.selectedGrade).toBe(grade);
    expect(data.missingRatingMessage).toBeNull();
    // 10 grades total → 1 selected, 9 unselected.
    expect(data.grades.filter((g) => !g.isSelected)).toHaveLength(9);

    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).not.toContain("is-selected");
    expect(html).not.toContain("data-selected");
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("Selected");
  });

  it("keeps demo SME-4 selected in view-model but does not highlight in HTML", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_DEMO_INPUT
    );
    expect(data.selectedGrade).toBe("SME-4");
    expect(data.grades.find((g) => g.grade === "SME-4")?.isSelected).toBe(true);
    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).toContain('data-grade="SME-4"');
    expect(html).not.toContain("data-selected");
    expect(html).not.toContain("is-selected");
  });

  it("selects no grade for missing or invalid values and does not default", () => {
    for (const input of [
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT,
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INVALID_INPUT,
      { selectedRiskRating: "AAA" },
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

  it("renders full-scale MARC SME labels, colours, and static disclosure once", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    expect(data).not.toHaveProperty("assessmentNote");
    for (const grade of data.grades) {
      expect(grade.label.length).toBeGreaterThan(0);
      expect(grade.explanation.length).toBeGreaterThan(0);
      expect(grade.color).toBe(resolveMarcNoteRiskPresentation(grade.grade).color);
    }
    expect(data.audit.display.assessmentNoteRendered).toBe(false);
    expect(data.audit.display.riskLabelsRendered).toBe(true);
    expect(data.audit.display.definitionsRendered).toBe(true);

    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).toContain('class="grade-label"');
    expect(html).toContain('class="grade-desc"');
    expect(html).toContain("Very Low Risk");
    expect(html).toContain("Low Risk");
    expect(html).toContain("Moderate Risk");
    expect(html).toContain("High Risk");
    expect(html).toContain("Very High Risk");
    expect(html).not.toContain("Assessment Note");
    expect(html).not.toContain("Definition:");
    expect(html).not.toContain('class="soukscore-missing"');
    expect(html.match(/class="risk-scale-note"/g)?.length).toBe(1);
    expect(html).toContain(PROSPECTUS_RISK_SCALE_NOTE);
    const lastGradeIdx = html.lastIndexOf('data-grade="');
    const noteIdx = html.indexOf('class="risk-scale-note"');
    expect(noteIdx).toBeGreaterThan(lastGradeIdx);

    for (const grade of VALID_GRADES) {
      expect(html).toContain(
        `background:${resolveMarcNoteRiskPresentation(grade).color};color:${CASHSCOUK_RISK_GRADE_LETTER_COLOR}`
      );
    }
    expect(html).not.toContain("color:#111111");
  });

  it("keeps the full MARC SME scale as equal reference cells without selected highlight", () => {
    const data = buildProspectusSoukscoreRatingScale({ selectedRiskRating: "SME-4" });
    const grades = data.grades.map((g) => g.grade);
    expect(grades).toEqual(MARC_SME_GRADES);
    expect(data.audit.scale.canvaAtoEScaleRejected).toBe(false);

    const html = buildProspectusSoukscoreRatingScaleDocument(data);
    expect(html).toContain('data-grade="SME-4"');
    expect(html).toContain(`background:${resolveMarcNoteRiskPresentation("SME-4").color}`);
    expect(html).not.toContain("is-selected");
    expect(html).not.toContain("data-selected");
    expect(html).not.toContain("box-shadow:inset 0 0 0 2px #111");
    expect(html).not.toContain("outline:2px solid #111");
  });

  it("uses catalogue wording only — no PD %, thresholds, or Credit Insights derivation", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).toContain("Very Low Risk");
    expect(html).toContain("Very High Risk");
    expect(html).not.toMatch(/≥85|75–84|8\.00%/);
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

  it("HTML shows Risk Rating Scale heading, horizontal scale, no selection chrome, and missing-grade message", () => {
    const data = buildProspectusSoukscoreRatingScale(
      SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_INPUT
    );
    const html = buildProspectusSoukscoreRatingScaleDocument(data);

    expect(html).toContain("Risk Rating Scale");
    expect(html).not.toContain("Cashsouk Risk Rating");
    expect(html).not.toContain("CASHSCOUK RISK RATING");
    expect(html).toContain('class="soukscore-scale"');
    expect(html).toContain(`data-soukscore-scale-version="${PROSPECTUS_SOUKSCORE_SCALE_VERSION}"`);
    for (const grade of VALID_GRADES) {
      expect(html).toContain(`data-grade="${grade}"`);
    }
    expect(html).not.toContain("data-selected");
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("is-selected");
    expect(html).not.toContain('class="soukscore-missing"');
    expect(html).not.toContain('data-grade="AAA"');
    expect(html).not.toContain('data-grade="BBB"');

    const missingHtml = buildProspectusSoukscoreRatingScaleDocument(
      buildProspectusSoukscoreRatingScale(SAMPLE_PROSPECTUS_SOUKSCORE_RATING_SCALE_MISSING_INPUT)
    );
    expect(missingHtml).toContain('class="soukscore-missing"');
    expect(missingHtml).toContain(PROSPECTUS_SOUKSCORE_RATING_NOT_AVAILABLE);
    expect((missingHtml.match(/class="soukscore-missing"/g) ?? []).length).toBe(1);

    expect(PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES.assessmentNote.availability).toBe(
      "omitted"
    );
    expect(PROSPECTUS_SOUKSCORE_RATING_SCALE_FIELD_SOURCES.selectedRiskRating.canonicalSource).toBe(
      "notes.invoice_snapshot.offer_details.risk_rating"
    );
  });
});
