/**
 * SECTION: Embed official CashSouk logo for frozen Prospectus HTML/PDF
 * WHY: Self-contained data URI — PDF setContent cannot resolve /logo.svg paths.
 * SVG viewBox is 1440×540 with large transparent padding; crop to visible artwork.
 */

import { readFileSync } from "node:fs";
import { resolveProspectusAssetAbsolutePath } from "./prospectus-asset-paths";
import {
  PROSPECTUS_LOGO_DISPLAY_HEIGHT_PX,
  PROSPECTUS_LOGO_DISPLAY_WIDTH_PX,
  PROSPECTUS_LOGO_SVG_VIEWBOX,
} from "./prospectus-document-styles";
import { PROSPECTUS_BRAND_NAME } from "./prospectus-header.types";

let cachedDataUri: string | null | undefined;

/**
 * Resolves logo.svg from apps/api/assets/prospectus (production) or investor/public (local).
 * Returns null when the asset is missing.
 */
export function resolveProspectusOfficialLogoAbsolutePath(): string | null {
  return resolveProspectusAssetAbsolutePath("logo.svg");
}

/**
 * Crop transparent padding so CSS width maps to visible artwork.
 * Source asset viewBox is `0 0 1440 540` with content roughly in the middle band.
 */
export function cropProspectusLogoSvg(svgXml: string): string {
  let out = svgXml;
  if (/viewBox="[^"]+"/.test(out)) {
    out = out.replace(/viewBox="[^"]+"/, `viewBox="${PROSPECTUS_LOGO_SVG_VIEWBOX}"`);
  } else {
    out = out.replace(/<svg\b/, `<svg viewBox="${PROSPECTUS_LOGO_SVG_VIEWBOX}"`);
  }
  // Prefer CSS sizing; drop fixed intrinsic width/height that fight the crop.
  out = out.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/preserveAspectRatio=/.test(out)) {
    out = out.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"');
  }
  return out;
}

export function getProspectusOfficialLogoDataUri(): string | null {
  if (cachedDataUri !== undefined) return cachedDataUri;
  const absolute = resolveProspectusOfficialLogoAbsolutePath();
  if (!absolute) {
    cachedDataUri = null;
    return null;
  }
  const cropped = cropProspectusLogoSvg(readFileSync(absolute, "utf8"));
  cachedDataUri = `data:image/svg+xml;base64,${Buffer.from(cropped, "utf8").toString("base64")}`;
  return cachedDataUri;
}

/** Brand mark markup: official logo img, or dimensional placeholder. */
export function buildProspectusBrandMarkHtml(): string {
  const dataUri = getProspectusOfficialLogoDataUri();
  if (dataUri) {
    return `<img class="brand-logo" src="${dataUri}" alt="${PROSPECTUS_BRAND_NAME}" width="${PROSPECTUS_LOGO_DISPLAY_WIDTH_PX}" height="${PROSPECTUS_LOGO_DISPLAY_HEIGHT_PX}" />`;
  }
  return `<div class="brand-mark-placeholder" aria-hidden="true"></div>`;
}
