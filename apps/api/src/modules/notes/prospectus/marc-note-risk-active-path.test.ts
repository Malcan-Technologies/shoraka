import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MARC_SME_GRADES } from "@cashsouk/types";
import { sendInvoiceOfferSchema } from "../../admin/schemas";
import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import { buildProspectusMarcRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";
import { buildProspectusPageFourHtml } from "./prospectus-marc-appendix.html";

function readRepoFile(...segments: string[]) {
  return readFileSync(join(__dirname, ...segments), "utf8");
}

describe("active MARC Note risk path has no A–F fallback", () => {
  it("Page 1 builder source does not call SoukScore presentation", () => {
    const src = readRepoFile("prospectus-risk-assessment.ts");
    expect(src).not.toContain("resolveSoukscoreRiskRatingPresentation");
    expect(src).not.toContain("CASHSCOUK_RISK_RATING_CATALOGUE");
    expect(src).toContain("resolveMarcNoteRiskPresentation");
  });

  it("Admin offer dropdown source lists SME-1 through SME-10 only", () => {
    const src = readRepoFile(
      "../../../../../admin/src/components/invoice-offer-panel.tsx"
    );
    expect(src).toContain("MARC_SME_GRADES");
    expect(src).not.toContain("SOUKSCORE_RISK_RATING_GRADES");
    expect(src).toContain("isMarcSmeGrade");
    expect(src).not.toContain("isSoukscoreRiskRating");
    for (const letter of ["A", "B", "C", "D", "E", "F"]) {
      expect(sendInvoiceOfferSchema.safeParse({
        offeredAmount: 1000,
        offeredRatioPercent: 70,
        offeredProfitRatePercent: 12,
        financingTenureDays: 90,
        risk_rating: letter,
      }).success).toBe(false);
    }
    expect(MARC_SME_GRADES).toHaveLength(10);
    expect(MARC_SME_GRADES[0]).toBe("SME-1");
    expect(MARC_SME_GRADES[9]).toBe("SME-10");
  });

  it("Page 1 runtime does not render letter-grade cards for A–F", () => {
    for (const letter of ["A", "B", "C", "D", "E"] as const) {
      const built = buildProspectusRiskAssessment({ soukscoreRiskRating: letter });
      expect(built.canva.riskGrade).toBe("—");
      expect(built.canva.riskLabel).not.toMatch(/Lower Risk|Moderate-Low Risk|Moderate Risk|Higher Risk|High Risk/);
      expect(built.canva.riskExplanation).not.toContain("typical SME and transaction-level risks");
    }
    const sme = buildProspectusRiskAssessment({ soukscoreRiskRating: "SME-4" });
    expect(sme.canva.riskGrade).toBe("SME-4");
  });

  it("Page 2 grouped V3 scale and Page 4 official definitions stay distinct", () => {
    const page2 = buildProspectusMarcRatingScaleSectionHtml();
    expect(page2).toContain("SME-1 - SME-2");
    expect(page2).toContain("Very strong credit strength; minimal repayment risk.");
    expect(page2.match(/data-grade="/g)?.length).toBe(5);
    const page4 = buildProspectusPageFourHtml();
    expect(page4).toContain("Extremely strong credit strength with very low non-repayment risk");
    expect(page4).toContain("Very weak credit strength with high potential to default");
  });
});
