/**
 * Static Prospectus CTA + rating-scale presentation (non-interactive).
 */
import fs from "node:fs";
import path from "node:path";
import { buildProspectusPageOneHtml } from "./prospectus-page-one.html";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "./prospectus-page-one.sample-data";
import { buildProspectusInvestmentCtaHtml } from "./prospectus-investment-cta.html";
import { SAMPLE_PROSPECTUS_INVESTMENT_CTA } from "./prospectus-investment-cta.sample-data";
import { PROSPECTUS_INVEST_CTA_DESCRIPTION } from "./prospectus-static-copy";
import { PROSPECTUS_RATING_SCALE_REFERENCE } from "./prospectus-risk-assessment.types";

describe("prospectus static rating scale and CTA presentation", () => {
  it("renders rating scale reference as static span text", () => {
    const html = buildProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).toContain(PROSPECTUS_RATING_SCALE_REFERENCE);
    expect(html).toContain(
      `<span class="scale-link">${PROSPECTUS_RATING_SCALE_REFERENCE}</span>`
    );
    expect(html).not.toMatch(/<a[^>]*class="scale-link"/);
    expect(html).not.toContain('href="#risk-scale"');
    expect(html).not.toMatch(/scale-link[^>]*onclick/i);
    expect(html).not.toMatch(/scale-link[^>]*role=/i);
    expect(html).not.toMatch(/scale-link[^>]*tabindex/i);
  });

  it("renders INVEST NOW as a static div without link or button semantics", () => {
    const html = buildProspectusInvestmentCtaHtml(SAMPLE_PROSPECTUS_INVESTMENT_CTA);
    expect(html).toContain(PROSPECTUS_INVEST_CTA_DESCRIPTION);
    expect(html).toContain('<div class="cta-button" aria-hidden="true">INVEST NOW</div>');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('href="');
    expect(html).not.toContain("disabled");
    expect(html).toContain("Minimum investment:");
  });

  it("document styles keep scale-link and cta-button non-interactive", () => {
    const styles = fs.readFileSync(
      path.join(__dirname, "prospectus-document-styles.ts"),
      "utf8"
    );
    expect(styles).toMatch(/\.risk-panel \.scale-link\{[^}]*cursor:default/);
    expect(styles).toMatch(/\.cta-button\{[^}]*pointer-events:none/);
    expect(styles).toMatch(/\.cta-button\{[^}]*cursor:default/);
  });
});
