/**
 * SECTION: Plain HTML fragment for Page 2 Investment CTA
 * WHY: Link only when confirmed path exists; never href="#" or javascript:
 */

import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

export function buildProspectusInvestmentCtaHtml(data: ProspectusInvestmentCta): string {
  const buttonHtml =
    data.isButtonEnabled && data.buttonHref
      ? `<a class="cta-button" href="${escapeHtmlAttribute(data.buttonHref)}">${escapeHtml(
          data.buttonLabel
        )}</a>`
      : `<button type="button" class="cta-button" disabled aria-disabled="true">${escapeHtml(
          data.buttonLabel
        )}</button>`;

  return `<section class="prospectus-investment-cta">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <p>CTA Paragraph: ${escapeHtml(data.paragraph)}</p>
  <p class="cta-action">${buttonHtml}</p>
  <p>Minimum Investment Statement: ${escapeHtml(data.minimumInvestmentStatement)}</p>
</section>`;
}
