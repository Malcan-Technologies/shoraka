import {
  MARC_SCORE_DEFINITIONS,
  MARC_SME_BANDS,
  MARC_SME_GRADES,
  marcBandOfficialGradeProfiles,
  marcOfficialPd,
  marcOfficialRiskProfile,
  marcOfficialScoreRange,
  resolveDefaultInvoiceRiskRating,
  resolveMarcNoteRiskPresentation,
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

  it("returns both official profiles for a grouped band", () => {
    const profiles = marcBandOfficialGradeProfiles(MARC_SME_BANDS[0]);
    expect(profiles).toEqual([
      { grade: "SME-1", riskProfile: OFFICIAL_RISK_PROFILES["SME-1"] },
      { grade: "SME-2", riskProfile: OFFICIAL_RISK_PROFILES["SME-2"] },
    ]);
  });
});
