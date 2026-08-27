import { MARC_SCORE_DEFINITIONS, MARC_SME_BANDS, MARC_SME_GRADES } from "@cashsouk/types";
import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { buildProspectusMarcRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

describe("prospectus Page 2 MARC risk rating scale", () => {
  const html = buildProspectusMarcRatingScaleSectionHtml();

  it("renders five equal grouped bands without truncated grade labels", () => {
    expect(html).toContain('class="soukscore-scale marc-sme-scale"');
    expect(html).not.toContain("text-overflow:ellipsis");
    expect(html).not.toContain("ellipsis");
    for (const band of MARC_SME_BANDS) {
      expect(html).toContain(`data-grade="${band.rangeLabel}"`);
      expect(html).toContain(band.compactRangeLabel);
      expect(html).toContain(band.label);
    }
    expect(html).toContain("SME-1–2");
    expect(html).toContain("SME-9–10");
    expect(html).not.toContain("SME-1 - S...");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      "grid-template-columns:repeat(5,minmax(0,1fr))"
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".soukscore-scale.marc-sme-scale .grade.marc");
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(
      /\.soukscore-scale\.marc-sme-scale \.grade\.marc\{[\s\S]*white-space:nowrap/
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(
      /\.soukscore-scale\.marc-sme-scale \.grade\.marc\{[\s\S]*overflow:visible/
    );
  });

  it("uses official MARC Risk Profile wording for both grades in each band", () => {
    for (const grade of MARC_SME_GRADES) {
      expect(html).toContain(`${grade}:`);
      expect(html).toContain(MARC_SCORE_DEFINITIONS[grade].riskProfile);
    }
    expect(html).not.toContain("minimal repayment risk");
    expect(html).not.toContain("elevated default risk");
    expect(html).not.toContain("Suitable for investors comfortable");
    expect(html).not.toContain("typical SME and transaction-level risks");
  });

  it("does not render legacy A–F grade letters on the MARC scale", () => {
    expect(html).not.toContain('data-grade="A"');
    expect(html).not.toContain('data-grade="C"');
    expect(html).not.toContain('data-grade="F"');
  });
});
