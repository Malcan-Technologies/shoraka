/**
 * SECTION: Calculated values of a legacy Page 2 freeze (no freeze_version, 18 raw keys)
 * WHY: Freezes approved or published before calculated values were stored must keep rendering
 * what they rendered then. This is the only Prospectus file allowed to call formula helpers.
 */

import {
  resolveCtosGearingRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosTotalAssetTurnover,
  type FinancialReviewCalculatedValues,
} from "@cashsouk/types";
import { parseProspectusFinancialNumber } from "./prospectus-financial-comparison-metrics";
import { emptyProspectusCalculatedValues } from "./prospectus-financial-comparison-source";
import type { ProspectusPage2FinancialRawSnapshot } from "./prospectus-snapshot.types";

/**
 * Metrics a legacy freeze displayed, from its 18 frozen raw keys. Every other metric is null:
 * legacy freezes never carried the inputs for it.
 */
export function legacyFrozenCalculatedValues(
  raw: ProspectusPage2FinancialRawSnapshot
): FinancialReviewCalculatedValues {
  const turnover = parseProspectusFinancialNumber(raw.turnover);
  const plnpat = parseProspectusFinancialNumber(raw.plnpat);
  const totass = parseProspectusFinancialNumber(raw.totass);
  const totlib = parseProspectusFinancialNumber(raw.totlib);
  const networth = parseProspectusFinancialNumber(raw.networth);
  return {
    ...emptyProspectusCalculatedValues(),
    totass,
    totlib,
    networth,
    profit_margin: resolveCtosPatMarginPercent({ plnpat, turnover }),
    return_on_equity: parseProspectusFinancialNumber(raw.return_on_equity),
    currat: parseProspectusFinancialNumber(raw.currat),
    gear: resolveCtosGearingRatio({
      gear: parseProspectusFinancialNumber(raw.gear),
      totlib,
      networth,
    }),
    roa: resolveCtosReturnOnAssetsPercent({ plnpat, totass }),
    assetTurnover: resolveCtosTotalAssetTurnover({ turnover, totass }),
  };
}
