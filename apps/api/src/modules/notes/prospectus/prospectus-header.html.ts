/**
 * SECTION: Shared prospectus header (Pages 1–3)
 * WHY: Official logo when available; shared tagline; dimensional Shariah placeholder
 */

import { buildProspectusBrandMarkHtml } from "./prospectus-header-logo";
import type { ProspectusHeader } from "./prospectus-header.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { escapeHtml } from "./prospectus-html";
import { PROSPECTUS_HEADER_TAGLINE } from "./prospectus-static-copy";

/** Visible presentation placeholder — not a final compliance asset. */
export const PROSPECTUS_HEADER_SHARIAH_PLACEHOLDER = "Shariah Compliant";

/** @deprecated Prefer PROSPECTUS_HEADER_TAGLINE from prospectus-static-copy. */
export const PROSPECTUS_HEADER_TAGLINE_PLACEHOLDER = PROSPECTUS_HEADER_TAGLINE;

/**
 * Shared header for all investor Prospectus pages.
 */
export function buildProspectusHeaderHtml(data: ProspectusHeader): string {
  const tagline =
    data.tagline.trim().length > 0 &&
    data.tagline !== PROSPECTUS_DATA_NOT_AVAILABLE
      ? data.tagline
      : PROSPECTUS_HEADER_TAGLINE;
  return `<header class="page-header" data-stage="header">
  <div class="brand">
    ${buildProspectusBrandMarkHtml()}
    <div class="brand-copy">
      <div class="brand-name">Cash<span>Souk</span></div>
      <div class="tagline">${escapeHtml(tagline)}</div>
    </div>
  </div>
  <div class="shariah"><span class="shariah-mark" aria-hidden="true">◆</span> ${PROSPECTUS_HEADER_SHARIAH_PLACEHOLDER}</div>
</header>`;
}
