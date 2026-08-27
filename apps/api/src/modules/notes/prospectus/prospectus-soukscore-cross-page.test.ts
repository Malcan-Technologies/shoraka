/**
 * Cross-page MARC SME grade: Page 1 card, Page 2 grouped scale, Page 3 metadata
 */

import { MARC_SCORE_DEFINITIONS, MARC_SME_GRADES, resolveMarcNoteRiskPresentation } from "@cashsouk/types";
import { parseInvoiceSnapshotRiskRating } from "./prospectus-json-guards";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import {
  SAMPLE_PROSPECTUS_PAGE_ONE,
  SAMPLE_PROSPECTUS_PAGE_ONE_INPUT,
} from "./prospectus-page-one.sample-data";
import { buildProspectusPageOne } from "./prospectus-page-one-mapper";
import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import { buildProspectusPageThreeMetadata } from "./prospectus-page-three-metadata";
import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT } from "./prospectus-page-three-metadata.sample-data";
import { buildProspectusMarcRatingScaleSectionHtml } from "./prospectus-soukscore-rating-scale.html";

describe("prospectus MARC SME cross-page and freeze", () => {
  it("uses the same SME grade on Page 1 card and Page 3 metadata", () => {
    const grade = parseInvoiceSnapshotRiskRating({
      offer_details: { risk_rating: "SME-5" },
    });
    expect(grade).toBe("SME-5");

    const page1 = buildProspectusRiskAssessment({ soukscoreRiskRating: grade });
    const page2 = buildProspectusMarcRatingScaleSectionHtml();
    const page3 = buildProspectusPageThreeMetadata({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT,
      selectedRiskRating: grade,
    });

    expect(page1.canva.riskGrade).toBe("SME-5");
    expect(page3.metadata.riskRating).toBe("SME-5");
    expect(page1.canva.riskLabel).toBe("Moderate Risk");
    expect(page1.canva.riskExplanation).toBe(MARC_SCORE_DEFINITIONS["SME-5"].riskProfile);
    expect(page2).toContain("SME-5 - SME-6");
    expect(page2).not.toContain('data-grade="C"');
  });

  it("does not treat A–F invoice ratings as a Page 1 or Page 3 grade", () => {
    expect(parseInvoiceSnapshotRiskRating({ offer_details: { risk_rating: "C" } })).toBeNull();
    const page1 = buildProspectusRiskAssessment({ soukscoreRiskRating: "C" });
    const page3 = buildProspectusPageThreeMetadata({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT,
      selectedRiskRating: "C",
    });
    expect(page1.canva.riskGrade).toBe("—");
    expect(page3.metadata.riskRating).toBe("—");
  });

  it("bakes resolved SME label, official profile and colour into Page 1 HTML", () => {
    const presentation = resolveMarcNoteRiskPresentation("SME-3");
    const html = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).toContain(`data-grade="${presentation.grade}"`);
    expect(html).toContain('class="risk-shield-asset"');
    expect(html).toContain("color:#FFFFFF");
    expect(html).toContain(`>${presentation.grade}</span>`);
    expect(html).toContain("risk-shield-grade");
    expect(html).toContain(".risk-panel strong{display:block;text-align:center;font-size:12px}");
    expect(html).toContain("color:#fff");
    expect(html).toContain("--prospectus-risk-shield-grade-font-size:22px");
    expect(html).toContain("See rating scale on page 2");
    expect(html).not.toContain('href="#risk-scale"');
    expect(html).not.toContain("Data not available");
    expect(html).toContain("Low Risk");
    expect(html).not.toContain("Lower Risk");
    expect(html).not.toContain("Moderate-Low Risk");
    expect(html).not.toContain('data-grade="A"');
    expect(html).not.toContain('data-grade="AAA"');
    expect(html).toContain(presentation.riskProfile);

    const published = structuredClone({ html: { page1: html } });
    published.html.page1 = "<p>mutated</p>";
    expect(html).toContain(presentation.riskProfile);
  });

  it.each(MARC_SME_GRADES)("Page 1 shield grade %s renders the SME label", (grade) => {
    const page = buildProspectusPageOne({
      ...SAMPLE_PROSPECTUS_PAGE_ONE_INPUT,
      riskAssessment: { soukscoreRiskRating: grade },
    });
    const html = buildProspectusPageOneHtml(page);
    expect(html).toContain(`data-grade="${grade}"`);
    expect(html).toContain(`>${grade}</span>`);
    expect(html).toContain('class="risk-shield-grade"');
    expect(html).toContain("color:#FFFFFF");
  });
});
