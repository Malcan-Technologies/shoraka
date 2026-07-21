/**
 * SECTION: Plain HTML fragment for Page 2 Investment CTA
 * WHY: Static frozen wording only — no links, buttons, or live capacity
 */

import { escapeHtml } from "./prospectus-html";
import type { ProspectusInvestmentCta } from "./prospectus-investment-cta.types";

export function buildProspectusInvestmentCtaHtml(data: ProspectusInvestmentCta): string {
  return `<section class="prospectus-investment-cta" data-stage="8-cta">
  <h2>${escapeHtml(data.sectionHeading)}</h2>
  <p class="cta-minimum">${escapeHtml(data.minimumInvestmentStatement)}</p>
</section>`;
}
