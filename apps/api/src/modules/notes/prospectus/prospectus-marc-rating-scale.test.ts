import { MARC_SCORE_DEFINITIONS, MARC_SME_BANDS, MARC_SME_GRADES } from "@cashsouk/types";
import { PROSPECTUS_DOCUMENT_CSS } from "./prospectus-document-styles";
import { PROSPECTUS_RISK_SCALE_NOTE } from "./prospectus-static-copy";
import { buildProspectusMarcRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

describe("prospectus Page 2 MARC risk rating scale", () => {
  const html = buildProspectusMarcRatingScaleSectionHtml();

  it("renders the V3 grouped five-band scale without clipping range labels", () => {
    expect(html).toContain('class="risk-scale marc-scale"');
    expect(html).not.toContain("text-overflow:ellipsis");
    expect(html).not.toContain("ellipsis");
    expect(html).not.toContain("soukscore-scale");
    expect(html).not.toContain("compactRangeLabel");
    for (const band of MARC_SME_BANDS) {
      expect(html).toContain(`data-grade="${band.rangeLabel}"`);
      expect(html).toContain(band.rangeLabel);
      expect(html).toContain(band.label);
      expect(html).toContain(band.groupedExplanation);
    }
    expect(html).toContain("SME-1 - SME-2");
    expect(html).toContain("SME-9 - SME-10");
    expect(html).not.toContain("SME-1–2");
    expect(html).not.toContain("SME-1 - S...");
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(
      "grid-template-columns:repeat(5,minmax(0,1fr))"
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toContain(".risk-scale.marc-scale .grade.marc");
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(
      /\.risk-scale\.marc-scale \.grade\.marc\{[\s\S]*white-space:nowrap/
    );
    expect(PROSPECTUS_DOCUMENT_CSS).toMatch(
      /\.risk-scale\.marc-scale \.grade\.marc\{[\s\S]*overflow:visible/
    );
    expect(html).toContain(PROSPECTUS_RISK_SCALE_NOTE);
  });

  it("uses V3 grouped copy on Page 2, not official individual dual profiles", () => {
    expect(html).toContain("Very strong credit strength; minimal repayment risk.");
    expect(html).toContain("Very weak credit strength; high default risk.");
    expect(html).not.toContain("SME-1:");
    expect(html).not.toContain("SME-2:");
    for (const grade of MARC_SME_GRADES) {
      expect(html).not.toContain(`${grade}:`);
    }
    expect(html).not.toContain(MARC_SCORE_DEFINITIONS["SME-1"].riskProfile);
    expect(html).not.toContain("Suitable for investors comfortable");
    expect(html).not.toContain("typical SME and transaction-level risks");
  });

  it("does not render legacy A–F grade letters on the MARC scale", () => {
    expect(html).not.toContain('data-grade="A"');
    expect(html).not.toContain('data-grade="C"');
    expect(html).not.toContain('data-grade="F"');
  });
});
