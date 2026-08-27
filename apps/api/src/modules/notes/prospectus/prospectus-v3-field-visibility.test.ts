import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "./prospectus-page-three.sample-data";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";

describe("prospectus V3 field visibility", () => {
  it("Page 1 still includes Closing Date", () => {
    const html = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).toMatch(/Closing Date/i);
  });

  it("Page 2 omits Paymaster Rating and Confidence Grading", () => {
    const html = buildProspectusPageTwoHtml(SAMPLE_PROSPECTUS_PAGE_TWO);
    expect(html).not.toContain("Paymaster Rating");
    expect(html).not.toContain("Confidence Grading");
    expect(html).toContain("MARC Credit Grade");
  });

  it("Page 3 keeps Paymaster Grading and Confidence Grading and omits OCF/FCF/Trend", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    expect(html).toContain("Paymaster Grading");
    expect(html).toContain("Confidence Grading");
    expect(html).not.toContain("Operating Cash Flow");
    expect(html).not.toContain("Free Cash Flow");
    expect(html).not.toContain("Trend (3-Yr)");
  });
});
