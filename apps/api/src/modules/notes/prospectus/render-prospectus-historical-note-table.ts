/**
 * SECTION: Historical Note Table HTML orchestration
 * WHY: Stage 8 data preview only — no Prisma/S3/routes
 */

import { SAMPLE_PROSPECTUS_HISTORICAL_NOTE_TABLE } from "./prospectus-historical-note-table.sample-data";
import { buildProspectusHistoricalNoteTableHtml } from "./prospectus-historical-note-table.html";
import type { ProspectusHistoricalNoteTable } from "./prospectus-historical-note-table.types";

export function buildProspectusHistoricalNoteTableDocument(
  table: ProspectusHistoricalNoteTable = SAMPLE_PROSPECTUS_HISTORICAL_NOTE_TABLE
): string {
  return buildProspectusHistoricalNoteTableHtml(table);
}
