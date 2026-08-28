import { MARC_SCORE_DEFINITIONS, MARC_SME_GRADES } from "@cashsouk/types";
import { combineProspectusPagesHtml } from "./combine-prospectus-pages-html";
import { countProspectusHtmlPages } from "./prospectus-pdf";
import { buildProspectusPageFourHtml, buildProspectusPageFiveHtml } from "./prospectus-marc-appendix.html";
import {
  MARC_APPENDIX_FACTOR_FOOTNOTE,
  MARC_APPENDIX_FACTOR_ROWS,
  MARC_APPENDIX_METHODOLOGY_PARAGRAPHS,
  MARC_DISCLAIMER_UPPERCASE,
} from "./prospectus-marc-disclaimer";
import { escapeHtml } from "./prospectus-html";
import { PROSPECTUS_STRATO_CSS } from "./prospectus-strato-styles";

describe("prospectus MARC appendix pages", () => {
  it("renders pages 4 and 5 without sample artefacts", () => {
    const page4 = buildProspectusPageFourHtml();
    const page5 = buildProspectusPageFiveHtml();
    expect(page4).toContain("MARC SCORE DEFINITIONS");
    expect(page4).not.toContain("ABCD1234XR");
    expect(page4).not.toContain("SAMPLE");
    expect(page4).not.toContain("Page 9 of 10");
    expect(page5).toContain("DISCLAIMER AND CONFIDENTIALITY");
    expect(page5).toContain("MARC Data Sdn Bhd");
    expect(page5).not.toContain("sample@gmail.com");
    expect(page5).not.toContain("Page 10 of 10");
    expect(page5).not.toContain("ABCD1234XR");
    expect(page5).not.toContain("SAMPLE");
  });

  it("renders official MARC score definitions, methodology, and factors on Page 4", () => {
    const page4 = buildProspectusPageFourHtml();
    expect(page4).toContain("MARC SME Credit Methodology");
    for (const grade of MARC_SME_GRADES) {
      const def = MARC_SCORE_DEFINITIONS[grade];
      expect(page4).toContain(grade);
      expect(page4).toContain(def.scoreRange);
      expect(page4).toContain(def.pd);
      expect(page4).toContain(def.riskProfile);
    }
    for (const paragraph of MARC_APPENDIX_METHODOLOGY_PARAGRAPHS) {
      expect(page4).toContain(escapeHtml(paragraph));
    }
    for (const row of MARC_APPENDIX_FACTOR_ROWS) {
      expect(page4).toContain(row.title);
      expect(page4).toContain(escapeHtml(row.body));
    }
    expect(page4).toContain(MARC_APPENDIX_FACTOR_FOOTNOTE);
    expect(PROSPECTUS_STRATO_CSS).toContain("table-layout:fixed");
    expect(PROSPECTUS_STRATO_CSS).toContain("overflow-x:hidden");
    expect(PROSPECTUS_STRATO_CSS).toContain("max-width:100%");
  });

  it("renders official MARC customer service and disclaimer wording on Page 5", () => {
    const page5 = buildProspectusPageFiveHtml();
    expect(page5).toContain("CUSTOMER SERVICE");
    expect(page5).toContain("www.marcdata.com.my/contact");
    expect(page5).toContain("data@marc.com.my");
    expect(page5).toContain("Enquiry number");
    expect(page5).toContain(MARC_DISCLAIMER_UPPERCASE);
    expect(page5).toContain("END OF REPORT");
    expect(page5).not.toContain("Order No.");
    expect(page5).not.toContain("User ID");
  });

  it("combines legacy 3-page snapshots without pages 4–5", () => {
    const page = (n: number) =>
      `<html><body><section class="page">P${n}</section></body></html>`;
    const combined = combineProspectusPagesHtml({
      page1: page(1),
      page2: page(2),
      page3: page(3),
    });
    expect(countProspectusHtmlPages(combined)).toBe(3);
  });

  it("combines new 5-page publications", () => {
    const page = (n: number) =>
      `<html><body><section class="page">P${n}</section></body></html>`;
    const combined = combineProspectusPagesHtml({
      page1: page(1),
      page2: page(2),
      page3: page(3),
      page4: buildProspectusPageFourHtml(),
      page5: buildProspectusPageFiveHtml(),
    });
    expect(countProspectusHtmlPages(combined)).toBe(5);
  });
});
