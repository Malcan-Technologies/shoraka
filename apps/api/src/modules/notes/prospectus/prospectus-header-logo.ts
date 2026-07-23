/**
 * SECTION: Embed official CashSouk logo for frozen Prospectus HTML/PDF
 * WHY: Self-contained data URI — PDF setContent cannot resolve /logo.svg paths
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROSPECTUS_BRAND_NAME } from "./prospectus-header.types";

let cachedDataUri: string | null | undefined;

/**
 * Resolves apps/investor/public/logo.svg relative to this module.
 * Returns null when the asset is missing (tests / incomplete checkouts).
 */
export function resolveProspectusOfficialLogoAbsolutePath(): string | null {
  const absolute = join(
    __dirname,
    "../../../../../investor/public/logo.svg"
  );
  return existsSync(absolute) ? absolute : null;
}

export function getProspectusOfficialLogoDataUri(): string | null {
  if (cachedDataUri !== undefined) return cachedDataUri;
  const absolute = resolveProspectusOfficialLogoAbsolutePath();
  if (!absolute) {
    cachedDataUri = null;
    return null;
  }
  const svg = readFileSync(absolute);
  cachedDataUri = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return cachedDataUri;
}

/** Brand mark markup: official logo img, or dimensional placeholder. */
export function buildProspectusBrandMarkHtml(): string {
  const dataUri = getProspectusOfficialLogoDataUri();
  if (dataUri) {
    return `<img class="brand-logo" src="${dataUri}" alt="${PROSPECTUS_BRAND_NAME}" height="46" />`;
  }
  return `<div class="brand-mark-placeholder" aria-hidden="true"></div>`;
}
