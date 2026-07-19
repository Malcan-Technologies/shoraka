/**
 * SECTION: Build Timing & Purpose view-model
 * WHY: Reuse Stage 2 tenure/maturity; purpose from frozen purpose_snapshot only
 */

import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PURPOSE_AUDIT,
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
  // Live Application must not become a render fallback.
  void input.liveApplicationFinancingFor;

  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });
  const purpose = nonEmptyString(input.purposeSnapshotFinancingFor);

  return {
    tenure: timing.tenure,
    maturityDate: timing.maturityDate,
    purposeOfFinancing: purpose ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: {
      purpose: PROSPECTUS_PURPOSE_AUDIT,
    },
  };
}
