/**
 * Cross-page SoukScore grade + freeze of Page 1 risk label/explanation HTML
 */

import {
  SOUKSCORE_RISK_RATING_CATALOGUE,
  resolveSoukscoreRiskRatingPresentation,
} from "@cashsouk/types";
import { parseInvoiceSnapshotRiskRating } from "./prospectus-json-guards";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import { buildProspectusPageThreeMetadata } from "./prospectus-page-three-metadata";
import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT } from "./prospectus-page-three-metadata.sample-data";
import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";

describe("prospectus SoukScore cross-page and freeze", () => {
  it("uses the same grade on Page 1 card, Page 2 scale, and Page 3 metadata", () => {
    const grade = parseInvoiceSnapshotRiskRating({
      offer_details: { risk_rating: "BBB" },
    });
    expect(grade).toBe("BBB");

    const page1 = buildProspectusRiskAssessment({ soukscoreRiskRating: grade });
    const page2 = buildProspectusSoukscoreRatingScale({ selectedRiskRating: grade });
    const page3 = buildProspectusPageThreeMetadata({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT,
      selectedRiskRating: grade,
    });

    expect(page1.canva.riskGrade).toBe("BBB");
    expect(page2.selectedGrade).toBe("BBB");
    expect(page2.grades.find((g) => g.grade === "BBB")?.isSelected).toBe(true);
    expect(page3.metadata.riskRating).toBe("BBB");
    expect(page1.canva.riskLabel).toBe(SOUKSCORE_RISK_RATING_CATALOGUE.BBB.label);
    expect(page1.canva.riskExplanation).toBe(SOUKSCORE_RISK_RATING_CATALOGUE.BBB.explanation);
  });

  it("bakes resolved label and explanation into Page 1 HTML for freeze/copy publish", () => {
    const presentation = resolveSoukscoreRiskRatingPresentation("A");
    const html = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).toContain(`<div class="shield">${presentation.grade}</div>`);
    expect(html).toContain(presentation.label);
    expect(html).toContain(presentation.explanation);
    expect(html).toContain("See rating scale on page 2");
    expect(html).not.toContain("Data not available");
    expect(html).toContain("Moderately Low Risk");

    const published = structuredClone({ html: { page1: html } });
    published.html.page1 = "<p>mutated</p>";
    expect(html).toContain(presentation.explanation);
  });
});
