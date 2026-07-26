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
      offer_details: { risk_rating: "C" },
    });
    expect(grade).toBe("C");

    const page1 = buildProspectusRiskAssessment({ soukscoreRiskRating: grade });
    const page2 = buildProspectusSoukscoreRatingScale({ selectedRiskRating: grade });
    const page3 = buildProspectusPageThreeMetadata({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT,
      selectedRiskRating: grade,
    });

    expect(page1.canva.riskGrade).toBe("C");
    expect(page2.selectedGrade).toBe("C");
    expect(page2.grades.find((g) => g.grade === "C")?.isSelected).toBe(true);
    expect(page3.metadata.riskRating).toBe("C");
    expect(page1.canva.riskLabel).toBe(SOUKSCORE_RISK_RATING_CATALOGUE.C.label);
    expect(page1.canva.riskExplanation).toBe(SOUKSCORE_RISK_RATING_CATALOGUE.C.explanation);
  });

  it("bakes resolved label, explanation and colour into Page 1 HTML for freeze/copy publish", () => {
    const presentation = resolveSoukscoreRiskRatingPresentation("A");
    const html = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).toContain(`data-grade="${presentation.grade}"`);
    expect(html).toContain('class="risk-shield-asset"');
    // Page 1 shield grade letter is always white (Canva); catalogue textColor unchanged for scale chips.
    expect(html).toContain("color:#FFFFFF");
    expect(html).toContain(`>${presentation.grade}</span>`);
    expect(html).toContain("risk-shield-grade");
    expect(html).toContain("font-size:14px");
    expect(html).toContain("border:1.5px solid var(--red)");
    // Grade colour is injected into the shield SVG fill (base64 data URI).
    expect(
      Buffer.from(
        html.match(/risk-shield-asset[^>]+src="data:image\/svg\+xml;base64,([^"]+)"/)?.[1] ?? "",
        "base64"
      ).toString("utf8")
    ).toContain(`fill="${presentation.color}"`);
    expect(html).toContain(presentation.label);
    expect(html).toContain(presentation.explanation);
    expect(html).toContain('class="prospectus-risk-description"');
    expect(html).toContain("font-size:10px");
    expect(html).toContain("See rating scale on page 2");
    expect(html).not.toContain("Data not available");
    expect(html).toContain("Lower Risk");
    expect(html).not.toContain('data-grade="AAA"');
    expect(html).not.toContain('data-grade="BBB"');
    expect(html).not.toContain("Very Low Risk");
    expect(html).not.toContain("Moderately Low Risk");

    const published = structuredClone({ html: { page1: html } });
    published.html.page1 = "<p>mutated</p>";
    expect(html).toContain(presentation.explanation);
  });
});

