/**
 * SECTION: Shared prospectus footer (Pages 1–3)
 * WHY: Match reference layout; use corrected approved disclaimer wording
 */

import { escapeHtml } from "./prospectus-html";
import { prospectusIcon } from "./prospectus-icons";

/** Line 1 — corrected spelling vs static reference. */
export const PROSPECTUS_FOOTER_DISCLAIMER_LINE1 =
  "Investments are subject to credit risk, default risk, and other risks.";

/** Line 2 — Product Terms / Risk Disclosure Statement. */
export const PROSPECTUS_FOOTER_DISCLAIMER_LINE2 =
  "Investors are advised to read and understand the Product Terms and Risk Disclosure Statement before investing.";

export function buildProspectusFooterHtml(): string {
  return `<footer class="prospectus-footer" data-stage="footer">
  ${prospectusIcon.shieldCheck("icon")}
  <span>${PROSPECTUS_FOOTER_DISCLAIMER_LINE1}<br />${PROSPECTUS_FOOTER_DISCLAIMER_LINE2}</span>
</footer>`;
}

/**
 * Bottom-aligned footer shell for A4 flex pages.
 * Optional source line stays immediately above the disclaimer.
 */
export function buildProspectusFooterGroupHtml(options?: {
  sourceLine?: string | null;
}): string {
  const source =
    options?.sourceLine && options.sourceLine.trim().length > 0
      ? `<em class="source financial-source">${escapeHtml(
          options.sourceLine.trim()
        )}</em>`
      : "";
  return `<div class="page-footer-group">${source}${buildProspectusFooterHtml()}</div>`;
}
