/**
 * SECTION: Embed Shariah Compliant badge SVG for Prospectus header (Pages 1–3)
 * WHY: Self-contained data URI — PDF setContent cannot resolve public asset paths
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";

/** Compact icon size — small mark beside label (Canva-style pill badge). */
export const PROSPECTUS_SHARIAH_BADGE_DISPLAY_SIZE_PX = 14;

export const PROSPECTUS_SHARIAH_BADGE_LABEL = "Shariah Compliant";

let cachedDataUri: string | null | undefined;

export function resolveProspectusShariahBadgeAbsolutePath(): string | null {
  const absolute = join(
    __dirname,
    "../../../../../investor/public/prospectus-shariah-badge.svg"
  );
  return existsSync(absolute) ? absolute : null;
}

function prepareProspectusShariahBadgeSvg(svgXml: string): string {
  let out = svgXml;
  out = out.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/preserveAspectRatio=/.test(out)) {
    out = out.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"');
  }
  return out;
}

export function getProspectusShariahBadgeDataUri(): string | null {
  if (cachedDataUri !== undefined) return cachedDataUri;
  const absolute = resolveProspectusShariahBadgeAbsolutePath();
  if (!absolute) {
    cachedDataUri = null;
    return null;
  }
  const prepared = prepareProspectusShariahBadgeSvg(readFileSync(absolute, "utf8"));
  cachedDataUri = `data:image/svg+xml;base64,${Buffer.from(prepared, "utf8").toString("base64")}`;
  return cachedDataUri;
}

/** Shared header Shariah badge — SVG asset + label. */
export function buildProspectusShariahBadgeHtml(): string {
  const dataUri = getProspectusShariahBadgeDataUri();
  const size = PROSPECTUS_SHARIAH_BADGE_DISPLAY_SIZE_PX;
  if (dataUri) {
    return `<div class="shariah" aria-label="${escapeHtmlAttribute(PROSPECTUS_SHARIAH_BADGE_LABEL)}">
  <img class="shariah-badge" src="${dataUri}" alt="" width="${size}" height="${size}" />
  <span class="shariah-label">${escapeHtml(PROSPECTUS_SHARIAH_BADGE_LABEL)}</span>
</div>`;
  }
  return `<div class="shariah" aria-label="${escapeHtmlAttribute(PROSPECTUS_SHARIAH_BADGE_LABEL)}">
  <span class="shariah-label">${escapeHtml(PROSPECTUS_SHARIAH_BADGE_LABEL)}</span>
</div>`;
}
