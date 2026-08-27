/**
 * SECTION: Load Note data required for Prospectus Page 3
 * WHY: Keep Prisma out of HTML; select only Page 3 fields; shared freeze with Page 2
 */

import { NoteStatus, type PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";
import { resolveMarcSnapshotForProspectus } from "./prospectus-marc-snapshot";

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
};

export type ProspectusPageThreeLoadedData = {
  note: ProspectusPageThreeNoteRecord;
  /**
   * Live Application financial_statements for unpublished preview only.
   * Null when published (must not be used) or when Application is missing.
   */
  liveFinancialStatements: unknown | null;
  /**
   * Live organization CTOS financials_json for unpublished preview only.
   * Same source as Admin Financial Statements / Page 2 Stage 4.
   */
  liveCtosFinancials: unknown | null;
  marcSnapshot?: import("@cashsouk/types").MarcAssessmentSnapshot | null;
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
 * Load Note + optional live Application financials + CTOS for unpublished preview.
 * Published Notes never receive live financial statements from this loader.
 */
export async function loadProspectusPageThreeData(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageThreeLoadedData> {
  const note = await loadProspectusPageThreeNote(db, noteId);
  const published = isProspectusNotePublished(note);
  const marcSnapshot = await resolveMarcSnapshotForProspectus(note);

  if (published) {
    return { note, liveFinancialStatements: null, liveCtosFinancials: null, marcSnapshot };
  }

  if (!note.source_application_id) {
    return { note, liveFinancialStatements: null, liveCtosFinancials: null, marcSnapshot };
  }

  const [application, ctosReport] = await Promise.all([
    db.application.findUnique({
      where: { id: note.source_application_id },
      select: { financial_statements: true },
    }),
    db.ctosReport.findFirst({
      where: {
        issuer_organization_id: note.issuer_organization_id,
        subject_ref: null,
      },
      orderBy: { fetched_at: "desc" },
      select: { financials_json: true },
    }),
  ]);

  return {
    note,
    liveFinancialStatements: application?.financial_statements ?? null,
    liveCtosFinancials: ctosReport?.financials_json ?? null,
    marcSnapshot,
  };
}
