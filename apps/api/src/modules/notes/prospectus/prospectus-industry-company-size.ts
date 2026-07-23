/**
 * SECTION: Shared Industry | Company Size display
 * WHY: Same compact Canva line for Page 2 About the Issuer and Page 3 Sector
 */

import { normalizeProspectusCompanySize } from "@cashsouk/types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

function nonEmptyTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === PROSPECTUS_DATA_NOT_AVAILABLE) return null;
  return trimmed;
}

/**
 * Compact anonymous classification: `Industry | Company Size`.
 * Missing side → —; both missing → —.
 */
export function formatProspectusIndustryAndCompanySize(
  industry: unknown,
  companySize: unknown
): string {
  const industryText = nonEmptyTrimmed(industry);
  const sizeText = normalizeProspectusCompanySize(companySize);
  if (!industryText && !sizeText) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `${industryText ?? PROSPECTUS_DATA_NOT_AVAILABLE} | ${
    sizeText ?? PROSPECTUS_DATA_NOT_AVAILABLE
  }`;
}
