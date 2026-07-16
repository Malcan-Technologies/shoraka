/**
 * SECTION: Build Timing & Purpose view-model
 * WHY: Reuse Stage 2 tenure/maturity; purpose is live Application text only
 */

import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusTimingPurpose,
  type ProspectusTimingPurposeInput,
} from "./prospectus-timing-purpose.types";

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildProspectusTimingPurpose(
  input: ProspectusTimingPurposeInput
): ProspectusTimingPurpose {
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });
  const purpose = nonEmptyString(input.purposeOfFinancing);

  return {
    tenure: timing.tenure,
    maturityDate: timing.maturityDate,
    purposeOfFinancing: purpose ?? PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
