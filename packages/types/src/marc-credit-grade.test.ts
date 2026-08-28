import {
  MARC_CREDIT_SCORE_RANGE_MESSAGE,
  MARC_CREDIT_SCORE_REQUIRED_MESSAGE,
  MARC_PD_RANGE_MESSAGE,
  MARC_PD_REQUIRED_MESSAGE,
  MARC_SCORE_DEFINITIONS,
  MARC_SME_BANDS,
  MARC_SME_GRADES,
  isCompleteIssuerMarcAssessment,
  marcBandOfficialGradeProfiles,
  marcOfficialPd,
  marcOfficialRiskProfile,
  marcOfficialScoreRange,
  marcSmeGradeFromCreditScore,
  parseMarcCreditScore,
  parseMarcProbabilityOfDefault,
  resolveDefaultInvoiceRiskRating,
  resolveMarcNoteRiskPresentation,
  type MarcAssessmentSnapshot,
  type MarcSmeGrade,
} from "./marc-credit-grade";

const OFFICIAL_RISK_PROFILES: Record<(typeof MARC_SME_GRADES)[number], string> = {
  "SME-1": "Extremely strong credit strength with very low non-repayment risk",
  "SME-2": "Very strong credit strength with low non-repayment risk",
  "SME-3": "Strong credit strength with low non-repayment risk",
  "SME-4": "Strong credit strength with moderate non-repayment risk",
  "SME-5": "Moderate credit strength with moderate non-repayment risk",
  "SME-6": "Moderate credit strength with high non-repayment risk",
  "SME-7": "Weak credit strength with high non-repayment risk",
  "SME-8": "Weak credit strength with potential to default",
  "SME-9": "Very weak credit strength with potential to default",
  "SME-10": "Very weak credit strength with high potential to default",
};

describe("MARC SME official definitions", () => {
  it("keeps five grouped CashSouk bands with V3 grouped copy, not official dual profiles", () => {
    expect(MARC_SME_BANDS).toHaveLength(5);
    expect(MARC_SME_BANDS.map((band) => band.rangeLabel)).toEqual([
      "SME-1 - SME-2",
      "SME-3 - SME-4",
      "SME-5 - SME-6",
      "SME-7 - SME-8",
      "SME-9 - SME-10",
    ]);
    expect(MARC_SME_BANDS[0]?.groupedExplanation).toBe(
      "Very strong credit strength; minimal repayment risk."
    );
    expect(MARC_SME_BANDS[4]?.groupedExplanation).toBe(
      "Very weak credit strength; high default risk."
    );
  });

  it("defaults invoice risk_rating from org MARC without A–F fallback", () => {
    expect(resolveDefaultInvoiceRiskRating(null, "SME-3")).toBe("SME-3");
    expect(resolveDefaultInvoiceRiskRating("SME-4", "SME-3")).toBe("SME-4");
    expect(resolveDefaultInvoiceRiskRating("C", "SME-3")).toBe("SME-3");
    expect(resolveDefaultInvoiceRiskRating("B", null)).toBeNull();
    expect(resolveDefaultInvoiceRiskRating(null, null)).toBeNull();
    expect(resolveDefaultInvoiceRiskRating("A", "A")).toBeNull();
  });

  it("presents official MARC copy for SME grades and an incomplete state otherwise", () => {
    const sme4 = resolveMarcNoteRiskPresentation("SME-4");
    expect(sme4).toMatchObject({
      grade: "SME-4",
      label: "Low Risk",
      riskProfile: OFFICIAL_RISK_PROFILES["SME-4"],
      isAvailable: true,
    });
    const missing = resolveMarcNoteRiskPresentation("C");
    expect(missing.isAvailable).toBe(false);
    expect(missing.grade).toBe("—");
    expect(missing.riskProfile).toBe("—");
    expect(missing.riskProfile).not.toContain("typical SME");
  });

  it("exposes official score range, PD, and Risk Profile for every SME grade", () => {
    expect(MARC_SME_GRADES).toEqual([
      "SME-1",
      "SME-2",
      "SME-3",
      "SME-4",
      "SME-5",
      "SME-6",
      "SME-7",
      "SME-8",
      "SME-9",
      "SME-10",
    ]);
    expect(MARC_SCORE_DEFINITIONS["SME-1"]).toEqual({
      scoreRange: "90-100",
      pd: "0.24%",
      riskProfile: OFFICIAL_RISK_PROFILES["SME-1"],
    });
    expect(MARC_SCORE_DEFINITIONS["SME-4"]).toEqual({
      scoreRange: "60-69.99",
      pd: "7.43%",
      riskProfile: OFFICIAL_RISK_PROFILES["SME-4"],
    });
    expect(MARC_SCORE_DEFINITIONS["SME-10"]).toEqual({
      scoreRange: "0-9.99",
      pd: "45.00%",
      riskProfile: OFFICIAL_RISK_PROFILES["SME-10"],
    });
    for (const grade of MARC_SME_GRADES) {
      expect(marcOfficialRiskProfile(grade)).toBe(OFFICIAL_RISK_PROFILES[grade]);
      expect(marcOfficialScoreRange(grade)).toBe(MARC_SCORE_DEFINITIONS[grade].scoreRange);
      expect(marcOfficialPd(grade)).toBe(MARC_SCORE_DEFINITIONS[grade].pd);
    }
  });

  it("derives SME grade from official score ranges without A–F fallback", () => {
    const examples: Array<[number, MarcSmeGrade]> = [
      [95, "SME-1"],
      [85, "SME-2"],
      [74, "SME-3"],
      [65, "SME-4"],
      [55, "SME-5"],
      [45, "SME-6"],
      [35, "SME-7"],
      [25, "SME-8"],
      [15, "SME-9"],
      [5, "SME-10"],
      [90, "SME-1"],
      [89.99, "SME-2"],
      [80, "SME-2"],
      [79.99, "SME-3"],
      [70, "SME-3"],
      [69.99, "SME-4"],
      [60, "SME-4"],
      [59.99, "SME-5"],
      [50, "SME-5"],
      [49.99, "SME-6"],
      [40, "SME-6"],
      [39.99, "SME-7"],
      [30, "SME-7"],
      [29.99, "SME-8"],
      [20, "SME-8"],
      [19.99, "SME-9"],
      [10, "SME-9"],
      [9.99, "SME-10"],
      [0, "SME-10"],
      [100, "SME-1"],
      [89.5, "SME-2"],
      [7.5, "SME-10"],
    ];
    for (const [score, grade] of examples) {
      expect(marcSmeGradeFromCreditScore(score)).toBe(grade);
    }
    expect(marcSmeGradeFromCreditScore(-0.01)).toBeNull();
    expect(marcSmeGradeFromCreditScore(100.01)).toBeNull();
    expect(marcSmeGradeFromCreditScore("abc")).toBeNull();
    expect(marcSmeGradeFromCreditScore("A")).toBeNull();
    expect(marcSmeGradeFromCreditScore("B")).toBeNull();
    expect(parseMarcCreditScore("")).toEqual({
      ok: false,
      message: MARC_CREDIT_SCORE_REQUIRED_MESSAGE,
    });
    expect(parseMarcCreditScore(-1)).toEqual({
      ok: false,
      message: MARC_CREDIT_SCORE_RANGE_MESSAGE,
    });
    expect(parseMarcCreditScore(101)).toEqual({
      ok: false,
      message: MARC_CREDIT_SCORE_RANGE_MESSAGE,
    });
  });

  it("parses PD as a percentage and does not treat score as PD", () => {
    expect(parseMarcProbabilityOfDefault("")).toEqual({
      ok: false,
      message: MARC_PD_REQUIRED_MESSAGE,
    });
    expect(parseMarcProbabilityOfDefault(-0.1)).toEqual({
      ok: false,
      message: MARC_PD_RANGE_MESSAGE,
    });
    expect(parseMarcProbabilityOfDefault(100.1)).toEqual({
      ok: false,
      message: MARC_PD_RANGE_MESSAGE,
    });
    expect(parseMarcProbabilityOfDefault(1.13)).toEqual({ ok: true, value: 1.13 });
    expect(parseMarcProbabilityOfDefault(3.7)).toEqual({ ok: true, value: 3.7 });
    expect(parseMarcProbabilityOfDefault(7.43)).toEqual({ ok: true, value: 7.43 });
    expect(marcOfficialPd("SME-3")).toBe("1.13%");
    expect(parseMarcProbabilityOfDefault(3.7).ok && parseMarcProbabilityOfDefault(3.7).value).not.toBe(
      1.13
    );
  });

  it("requires score, grade, PD, report, and date for a complete organization MARC", () => {
    const complete: MarcAssessmentSnapshot = {
      creditGrade: "SME-3",
      creditScore: 74,
      probabilityOfDefault: 1.13,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportFileName: "strato.pdf",
      reportS3Key: "marc/org/strato.pdf",
      assessedAt: "2026-09-20T00:00:00.000Z",
    };
    expect(isCompleteIssuerMarcAssessment(complete)).toBe(true);
    expect(isCompleteIssuerMarcAssessment({ ...complete, reportS3Key: null })).toBe(true);
    expect(isCompleteIssuerMarcAssessment({ ...complete, creditGrade: "A" })).toBe(false);
    expect(isCompleteIssuerMarcAssessment({ ...complete, creditScore: null })).toBe(false);
    expect(isCompleteIssuerMarcAssessment({ ...complete, probabilityOfDefault: null })).toBe(false);
    expect(
      isCompleteIssuerMarcAssessment({
        ...complete,
        reportFileName: null,
        reportS3Key: null,
      })
    ).toBe(false);
    expect(isCompleteIssuerMarcAssessment({ ...complete, reportDate: null })).toBe(false);
  });

  it("returns both official profiles for a grouped band", () => {
    const profiles = marcBandOfficialGradeProfiles(MARC_SME_BANDS[0]);
    expect(profiles).toEqual([
      { grade: "SME-1", riskProfile: OFFICIAL_RISK_PROFILES["SME-1"] },
      { grade: "SME-2", riskProfile: OFFICIAL_RISK_PROFILES["SME-2"] },
    ]);
  });
});
