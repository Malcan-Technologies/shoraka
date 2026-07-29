/**
 * SECTION: Plain HTML fragment for Page 2 Investment CTA
 * WHY: Decorative INVEST NOW bar only — never a link, button, or focusable control
 */

import { escapeHtml } from "./prospectus-html";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

/**
 * Renders the CTA label as a static visual bar.
 * `buttonHref` is ignored — frozen Prospectus never navigates from this control.
 */
export function buildProspectusInvestmentCtaButtonHtml(
  data: Pick<ProspectusInvestmentCta, "buttonLabel" | "buttonHref">
): string {
  const label = escapeHtml(data.buttonLabel);
  void data.buttonHref;
  return `<div class="cta-button" aria-hidden="true">${label}</div>`;
}

export function buildProspectusInvestmentCtaHtml(data: ProspectusInvestmentCta): string {
  return `<section class="prospectus-investment-cta" data-stage="8-cta">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <p class="invest-confidence-description">${escapeHtml(data.description)}</p>
  ${buildProspectusInvestmentCtaButtonHtml(data)}
  <small class="cta-minimum">${escapeHtml(data.minimumInvestmentStatement)}</small>
</section>`;
}
