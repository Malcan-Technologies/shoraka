import { combineProspectusPagesHtml } from "./combine-prospectus-pages-html";
import { countProspectusHtmlPages } from "./prospectus-pdf";
import { buildProspectusPageFourHtml, buildProspectusPageFiveHtml } from "./prospectus-marc-appendix.html";

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
