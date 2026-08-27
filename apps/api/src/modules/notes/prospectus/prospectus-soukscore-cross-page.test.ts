/**
 * Cross-page SoukScore grade + freeze of Page 1 risk label/explanation HTML
 */

import {
  SOUKSCORE_RISK_RATING_CATALOGUE,
  SOUKSCORE_RISK_RATING_GRADES,
  resolveSoukscoreRiskRatingPresentation,
} from "@cashsouk/types";
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
    // Risk label under shield: origin/main / Canva size (12px), not the temporary 14px enlargement.
    expect(html).toContain(".risk-panel strong{display:block;text-align:center;font-size:12px}");
    expect(html).not.toContain(
      ".risk-panel strong{display:block;text-align:center;font-size:14px;font-weight:800"
    );
    expect(html).toContain("color:#fff");
    expect(html).toContain("--prospectus-risk-shield-grade-font-size:22px");
    expect(html).toContain(
      "font-size:var(--prospectus-risk-shield-grade-font-size);font-weight:800"
    );
    expect(html).toContain("--prospectus-risk-shield-size:130px");
    expect(html).toContain("--prospectus-risk-shield-height:42px");
    expect(html).toContain("border-radius:9px");
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
    expect(html).toContain('<span class="scale-link">See rating scale on page 2</span>');
    expect(html).not.toContain('<a class="scale-link"');
    expect(html).not.toContain('href="#risk-scale"');
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

  it.each(SOUKSCORE_RISK_RATING_GRADES)(
    "Page 1 shield grade %s renders white centred letter at Canva size",
    (grade) => {
      const page = buildProspectusPageOne({
        ...SAMPLE_PROSPECTUS_PAGE_ONE_INPUT,
        riskAssessment: { soukscoreRiskRating: grade },
      });
      const html = buildProspectusPageOneHtml(page);
      expect(html).toContain(`data-grade="${grade}"`);
      expect(html).toContain(`>${grade}</span>`);
      expect(html).toContain('class="risk-shield-grade"');
      expect(html).toContain("color:#FFFFFF");
      expect(html).toContain("--prospectus-risk-shield-grade-font-size:22px");
      expect(html).toContain("place-items:center");
      expect(html).toContain("--prospectus-risk-shield-size:130px");
      expect(html).toContain(
        ".risk-panel strong{display:block;text-align:center;font-size:12px}"
      );
    }
  );
});

