/**
 * SECTION: Prospectus financial input for one Note (the Note financial snapshot)
 * WHY: The Prospectus displays the approved Financial Review result copied onto the Note; it never
 * reads the application or CTOS, and a Note without a snapshot has no financial input to show
 */

import { AppError } from "../../../lib/http/error-handler";
import {
  parseNoteFinancialSnapshot,
  type NoteFinancialSnapshot,
} from "../note-financial-snapshot.types";

/** The Note's financial snapshot, or a clear error. Never reads the application or CTOS. */
export function readProspectusNoteFinancialSnapshot(note: {
  financial_snapshot: unknown;
}): NoteFinancialSnapshot {
  // SQL NULL and JSON null both arrive as null.
  if (note.financial_snapshot == null) {
    throw new AppError(
      409,
      "NOTE_FINANCIAL_SNAPSHOT_MISSING",
      "This note has no financial snapshot. Recreate the note from an application with an approved Financial review."
    );
  }
  const snapshot = parseNoteFinancialSnapshot(note.financial_snapshot);
  if (!snapshot) {
    throw new AppError(500, "NOTE_FINANCIAL_SNAPSHOT_INVALID", "Note financial snapshot is invalid");
  }
  return snapshot;
}
