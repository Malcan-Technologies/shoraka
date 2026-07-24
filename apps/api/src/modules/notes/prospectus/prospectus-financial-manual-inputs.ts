/**
 * SECTION: Temporary Page 3 manual financial fill helpers
 * WHY: Fill unsupported fields only; never override confirmed derived mappings
 */

import { parseProspectusFinancialNumber } from "./prospectus-financial-comparison-metrics";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import type { ProspectusFinancialYearManualInputs } from "./prospectus-placeholder-publication-content";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export function formatManualMoneyOrDna(
  value: number | string | null | undefined
): string {
  const parsed = parseProspectusFinancialNumber(value);
  if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return formatProspectusMoneyMyr(parsed);
}

export function formatManualRatioOrDna(
  value: number | string | null | undefined
): string {
  const parsed = parseProspectusFinancialNumber(value);
  if (parsed == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `${parsed}`;
}

export function yearManualInputs(
  years: Record<string, ProspectusFinancialYearManualInputs> | undefined,
  year: number
): ProspectusFinancialYearManualInputs | undefined {
  if (!years) return undefined;
  return years[String(year)] ?? years[year];
}
