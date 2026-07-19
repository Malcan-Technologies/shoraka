/**
 * SECTION: Prospectus historical Note status labels
 * WHY: Confirmed investor-facing table labels — not Settled / Fully Repaid / raw enums
 */

import type { ProspectusHistoricalNoteStatus } from "./prospectus-snapshot.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

const PROSPECTUS_HISTORICAL_NOTE_STATUS_LABELS: Record<
  ProspectusHistoricalNoteStatus,
  string
> = {
  ACTIVE: "Active",
  REPAID: "Repaid",
  ARREARS: "In Arrears",
  DEFAULTED: "Defaulted",
};

export function formatProspectusHistoricalNoteStatus(
  status: string | null | undefined
): string {
  if (status == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const key = String(status) as ProspectusHistoricalNoteStatus;
  return PROSPECTUS_HISTORICAL_NOTE_STATUS_LABELS[key] ?? PROSPECTUS_DATA_NOT_AVAILABLE;
}
