/**
 * SECTION: Load Note data required for Prospectus Page 2
 * WHY: Keep Prisma queries out of HTML; select only Page 2 fields
 */

import type { ApprovedFinancialResult, MarcAssessmentSnapshot } from "@cashsouk/types";
import { NoteStatus, type PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";
import { resolveMarcSnapshotForProspectus } from "./prospectus-marc-snapshot";
import { readProspectusNoteFinancialSnapshot } from "./prospectus-note-financial-inputs";

export { isProspectusNotePublished };

export const PROSPECTUS_PAGE_TWO_NOTE_SELECT = {
  id: true,
  note_reference: true,
  status: true,
  published_at: true,
  source_application_id: true,
  issuer_organization_id: true,
  maturity_date: true,
  target_amount: true,
  funded_amount: true,
  issuer_snapshot: true,
  invoice_snapshot: true,
  paymaster_snapshot: true,
  prospectus_snapshot: true,
  financial_snapshot: true,
  created_at: true,
  updated_at: true,
  listing: {
    select: {
      opens_at: true,
      closes_at: true,
      status: true,
    },
  },
} as const;

export type ProspectusPageTwoNoteRecord = {
  id: string;
  note_reference: string;
  status: NoteStatus;
  published_at: Date | null;
  source_application_id: string;
  issuer_organization_id: string;
  maturity_date: Date | null;
  target_amount: unknown;
  funded_amount: unknown;
  issuer_snapshot: unknown;
  invoice_snapshot: unknown;
  paymaster_snapshot: unknown;
  prospectus_snapshot: unknown;
  financial_snapshot: unknown;
  created_at: Date;
  updated_at: Date;
  listing: {
    opens_at: Date | null;
    closes_at: Date | null;
    status: string;
  } | null;
};

export type ProspectusPageTwoLoadedData = {
  note: ProspectusPageTwoNoteRecord;
  /**
   * Approved Financial Review result from the Note financial snapshot — unpublished preview only.
   * Null when published: published Notes render from their frozen Prospectus snapshot.
   */
  approvedFinancialResult: ApprovedFinancialResult | null;
  marcSnapshot?: MarcAssessmentSnapshot | null;
};

export async function loadProspectusPageTwoNote(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageTwoNoteRecord> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: PROSPECTUS_PAGE_TWO_NOTE_SELECT,
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
export async function loadProspectusPageTwoData(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageTwoLoadedData> {
  const note = await loadProspectusPageTwoNote(db, noteId);
  const approvedFinancialResult = isProspectusNotePublished(note)
    ? null
    : readProspectusNoteFinancialSnapshot(note).approved_financial_result;
  const marcSnapshot = await resolveMarcSnapshotForProspectus(note);

  return { note, approvedFinancialResult, marcSnapshot };
}
