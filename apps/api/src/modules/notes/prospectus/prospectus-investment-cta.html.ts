/**
 * SECTION: Plain HTML fragment for Page 2 Investment CTA
 * WHY: Visual INVEST NOW control; clickable only when a future buttonHref is set
 */

import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

/**
 * Renders the CTA control.
 * - `buttonHref == null` → disabled presentation button (current frozen Prospectus).
 * - `buttonHref` set → `<a>` for a future approved investor route (not used today).
 */
export function buildProspectusInvestmentCtaButtonHtml(
  data: Pick<ProspectusInvestmentCta, "buttonLabel" | "buttonHref">
): string {
  const label = escapeHtml(data.buttonLabel);
  if (data.buttonHref) {
    return `<a class="cta-button" href="${escapeHtmlAttribute(data.buttonHref)}">${label}</a>`;
  }
  return `<button type="button" class="cta-button" disabled aria-disabled="true">${label}</button>`;
}

export function buildProspectusInvestmentCtaHtml(data: ProspectusInvestmentCta): string {
  return `<section class="prospectus-investment-cta" data-stage="8-cta">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <p class="cta-action">${buildProspectusInvestmentCtaButtonHtml(data)}</p>
  <p class="cta-minimum">${escapeHtml(data.minimumInvestmentStatement)}</p>
</section>`;
}
