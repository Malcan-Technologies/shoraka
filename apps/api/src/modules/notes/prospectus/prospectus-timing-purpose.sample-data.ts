/**
 * SECTION: Sample Timing & Purpose for Stage 4B preview
 * WHY: Purpose from frozen purpose_snapshot; live Application text must not appear
 */

import { buildProspectusTimingPurpose } from "./prospectus-timing-purpose";
import type {
  ProspectusTimingPurpose,
  ProspectusTimingPurposeInput,
} from "./prospectus-timing-purpose.types";

export const SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT: ProspectusTimingPurposeInput = {
  listingOpensAt: "2025-05-15T00:00:00.000Z",
  maturityDate: "2025-09-12T00:00:00.000Z",
  purposeSnapshotFinancingFor:
    "To finance purchase of raw materials and working capital requirements",
  liveApplicationFinancingFor: "LIVE APPLICATION TEXT MUST NOT APPEAR",
};

export const SAMPLE_PROSPECTUS_TIMING_PURPOSE: ProspectusTimingPurpose =
  buildProspectusTimingPurpose(SAMPLE_PROSPECTUS_TIMING_PURPOSE_INPUT);
