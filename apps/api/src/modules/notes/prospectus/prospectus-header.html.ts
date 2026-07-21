/**
 * SECTION: Shared prospectus header (Pages 1–3)
 * WHY: Placeholder logo + Shariah badge matching uploaded A4 reference dimensions
 */

import type { ProspectusHeader } from "./prospectus-header.types";

/** Visible presentation placeholders — not final brand assets. */
export const PROSPECTUS_HEADER_TAGLINE_PLACEHOLDER =
  "Invest in Growth. Earn with Purpose.";
export const PROSPECTUS_HEADER_SHARIAH_PLACEHOLDER = "Shariah Compliant";

/**
 * Shared header for all investor Prospectus pages.
 * Uses dimensional placeholders for logo and Shariah badge (no CDN / no final logo asset).
 */
export function buildProspectusHeaderHtml(_data: ProspectusHeader): string {
  return `<header class="page-header" data-stage="header">
  <div class="brand">
    <div class="brand-mark-placeholder" aria-hidden="true">CashSouk</div>
    <div class="brand-copy">
      <div class="brand-name">Cash<span>Souk</span></div>
      <div class="tagline">${PROSPECTUS_HEADER_TAGLINE_PLACEHOLDER}</div>
    </div>
  </div>
  <div class="shariah"><span class="shariah-mark" aria-hidden="true">◆</span> ${PROSPECTUS_HEADER_SHARIAH_PLACEHOLDER}</div>
</header>`;
}
