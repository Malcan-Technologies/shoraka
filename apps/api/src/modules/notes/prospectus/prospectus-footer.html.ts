/**
 * SECTION: Plain HTML fragment for shared prospectus footer
 * WHY: Reusable across pages; audit/source paths excluded
 */

import { escapeHtml } from "./prospectus-html";
import type { ProspectusFooter } from "./prospectus-footer.types";

export function buildProspectusFooterHtml(data: ProspectusFooter): string {
  return `<footer class="prospectus-footer">
  <p>Investment Risk Warning: ${escapeHtml(data.investmentRiskWarning)}</p>
  <p>Product Terms / Risk Disclosure Statement: ${escapeHtml(
    data.productTermsRiskDisclosureStatement
  )}</p>
</footer>`;
}
