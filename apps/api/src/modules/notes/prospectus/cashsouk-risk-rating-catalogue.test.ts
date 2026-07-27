/**
 * SECTION: Cashsouk A–F risk catalogue contract
 * WHY: Labels/descriptions/colours must match Grade and Pricing Matrix + colour reference
 */

import {
  CASHSCOUK_RISK_GRADES,
  CASHSCOUK_RISK_RATING_CATALOGUE,
  getReadableTextColor,
  isCashsoukRiskGrade,
} from "@cashsouk/types";
import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";
import { buildProspectusSoukscoreRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";
import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import { PROSPECTUS_RISK_SCALE_NOTE } from "./prospectus-static-copy";

describe("Cashsouk risk rating catalogue", () => {
  it("contains exactly A–F with label, description and colour", () => {
    expect([...CASHSCOUK_RISK_GRADES]).toEqual(["A", "B", "C", "D", "E", "F"]);
    for (const grade of CASHSCOUK_RISK_GRADES) {
      const entry = CASHSCOUK_RISK_RATING_CATALOGUE[grade];
      expect(entry.grade).toBe(grade);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("matches Excel Grade and Pricing Matrix labels and descriptions", () => {
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.A.label).toBe("Lower Risk");
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.B.label).toBe("Moderate-Low Risk");
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.C.label).toBe("Moderate Risk");
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.D.label).toBe("Higher Risk");
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.E.label).toBe("High Risk");
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.F.label).toBe("Not Eligible");
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.A.description).toContain(
      "strong paymaster quality"
    );
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.F.description).toContain(
      "will not be made available for investment"
    );
  });

  it("uses colour-reference hex values and exact text colours for A–F", () => {
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.A).toMatchObject({
      color: "#1EB93F",
      textColor: "#FFFFFF",
    });
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.B).toMatchObject({
      color: "#79CF54",
      textColor: "#111111",
    });
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.C).toMatchObject({
      color: "#FFCF45",
      textColor: "#111111",
    });
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.D).toMatchObject({
      color: "#FF8647",
      textColor: "#FFFFFF",
    });
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.E).toMatchObject({
      color: "#CE201D",
      textColor: "#FFFFFF",
    });
    expect(CASHSCOUK_RISK_RATING_CATALOGUE.F).toMatchObject({
      color: "#B10810",
      textColor: "#FFFFFF",
    });
    for (const grade of CASHSCOUK_RISK_GRADES) {
      const entry = CASHSCOUK_RISK_RATING_CATALOGUE[grade];
      expect(getReadableTextColor(entry.color)).toBe(entry.textColor);
    }
  });

  it("omits numerical scores, weights, and pricing from the catalogue", () => {
    for (const grade of CASHSCOUK_RISK_GRADES) {
      const json = JSON.stringify(CASHSCOUK_RISK_RATING_CATALOGUE[grade]);
      expect(json).not.toMatch(/≥85|75–84|weight|8\.00%|profit rate/i);
      expect(CASHSCOUK_RISK_RATING_CATALOGUE[grade]).not.toHaveProperty("score");
    }
  });

  it("keeps readable contrast text for each grade colour", () => {
    expect(getReadableTextColor("#1EB93F")).toBe("#FFFFFF");
    expect(getReadableTextColor("#79CF54")).toBe("#111111");
    expect(getReadableTextColor("#FFCF45")).toBe("#111111");
    expect(getReadableTextColor("#FF8647")).toBe("#FFFFFF");
    expect(getReadableTextColor("#CE201D")).toBe("#FFFFFF");
    expect(getReadableTextColor("#B10810")).toBe("#FFFFFF");
  });

  it("rejects legacy AAA/AA/BBB/BB grades", () => {
    for (const legacy of ["AAA", "AA", "BBB", "BB"]) {
      expect(isCashsoukRiskGrade(legacy)).toBe(false);
    }
  });

  it("renders Page 1 selected grade colour and Page 2 full A–F colours", () => {
    const page1 = buildProspectusRiskAssessment({ soukscoreRiskRating: "C" });
    expect(page1.canva.riskGrade).toBe("C");
    expect(page1.canva.riskGradeColor).toBe("#FFCF45");
    expect(page1.canva.riskLabel).toBe("Moderate Risk");

    const scale = buildProspectusSoukscoreRatingScale({ selectedRiskRating: "C" });
    expect(scale.grades.map((g) => g.grade)).toEqual(["A", "B", "C", "D", "E", "F"]);
    const html = buildProspectusSoukscoreRatingScaleSectionHtml(scale);
    for (const grade of CASHSCOUK_RISK_GRADES) {
      expect(html).toContain(`data-grade="${grade}"`);
      expect(html).toContain(CASHSCOUK_RISK_RATING_CATALOGUE[grade].color);
      expect(html).toContain(
        `background:${CASHSCOUK_RISK_RATING_CATALOGUE[grade].color};color:#FFFFFF`
      );
    }
    expect(html).toContain('data-grade="C"');
    expect(html).not.toContain("is-selected");
    expect(html).not.toContain("data-selected");
    expect(html).not.toContain("color:#111111");
    expect(html).not.toContain('data-grade="AAA"');
    expect(html).not.toContain('data-grade="BBB"');
    expect((html.match(/risk-scale-note/g) ?? []).length).toBe(1);
    expect(html).toContain(PROSPECTUS_RISK_SCALE_NOTE);
    expect(PROSPECTUS_RISK_SCALE_NOTE).toContain(
      "relative risk classification based on information available at the time of listing"
    );
  });
});
