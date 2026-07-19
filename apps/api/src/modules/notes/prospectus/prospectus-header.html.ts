/**
 * SECTION: Plain HTML fragment for shared prospectus header
 * WHY: Reusable across pages; audit/logo paths not shown as visible text
 */

import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";
import type { ProspectusHeader } from "./prospectus-header.types";

export function buildProspectusHeaderHtml(data: ProspectusHeader): string {
  const logoHtml =
    data.logo.kind === "official_asset"
      ? `<img class="prospectus-logo" src="${escapeHtmlAttribute(data.logo.previewSrc)}" alt="${escapeHtmlAttribute(data.logo.alt)}" height="48" />`
      : `<span class="prospectus-logo-text">${escapeHtml(data.logo.text)}</span>`;

  return `<header class="prospectus-header" data-stage="header">
  ${logoHtml}
  <p class="brand-name">${escapeHtml(data.brandName)}</p>
  <p class="brand-tagline">Brand Tagline: ${escapeHtml(data.tagline)}</p>
  <p class="shariah-badge">Shariah Status Badge: ${escapeHtml(data.shariahStatusBadge)}</p>
</header>`;
}
