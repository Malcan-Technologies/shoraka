/**
 * SECTION: Load Note data required for Prospectus Page 3
 * WHY: Keep Prisma out of HTML; select only Page 3 fields; shared freeze with Page 2
 */

import type { ApprovedFinancialResult, MarcAssessmentSnapshot } from "@cashsouk/types";
import { NoteStatus, type PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";
import { resolveMarcSnapshotForProspectus } from "./prospectus-marc-snapshot";
import { readProspectusNoteFinancialSnapshot } from "./prospectus-note-financial-inputs";

export { isProspectusNotePublished };

export const PROSPECTUS_PAGE_THREE_NOTE_SELECT = {
  id: true,
  status: true,
  published_at: true,
  source_application_id: true,
  issuer_organization_id: true,
  issuer_snapshot: true,
  invoice_snapshot: true,
  paymaster_snapshot: true,
  prospectus_snapshot: true,
  financial_snapshot: true,
  created_at: true,
} as const;

export type ProspectusPageThreeNoteRecord = {
  id: string;
  status: NoteStatus;
  published_at: Date | null;
  source_application_id: string;
  issuer_organization_id: string;
  issuer_snapshot: unknown;
  invoice_snapshot: unknown;
  paymaster_snapshot: unknown;
  prospectus_snapshot: unknown;
  financial_snapshot: unknown;
  created_at: Date;
};

export type ProspectusPageThreeLoadedData = {
  note: ProspectusPageThreeNoteRecord;
  /**
   * Approved Financial Review result from the Note financial snapshot — unpublished preview only.
   * Null when published: published Notes render from their frozen Prospectus snapshot.
   */
  approvedFinancialResult: ApprovedFinancialResult | null;
  marcSnapshot?: MarcAssessmentSnapshot | null;
};

export async function loadProspectusPageThreeNote(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageThreeNoteRecord> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: PROSPECTUS_PAGE_THREE_NOTE_SELECT,
  });

  if (!note) {
    throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  }

  return note;
}

/**
 * Load Note + the approved Financial Review result from its financial snapshot for unpublished
 * preview. A missing or invalid snapshot throws; the application and CTOS are never read.
 * Published Notes never receive a financial result from this loader.
 */
export async function loadProspectusPageThreeData(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageThreeLoadedData> {
  const note = await loadProspectusPageThreeNote(db, noteId);
  const approvedFinancialResult = isProspectusNotePublished(note)
    ? null
    : readProspectusNoteFinancialSnapshot(note).approved_financial_result;
  const marcSnapshot = await resolveMarcSnapshotForProspectus(note);

  return { note, approvedFinancialResult, marcSnapshot };
}
