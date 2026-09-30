/**
 * SECTION: Load Note data required for Prospectus Page 3
 * WHY: Keep Prisma out of HTML; select only Page 3 fields; shared freeze with Page 2
 */

import { NoteStatus, type PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";
import { resolveMarcSnapshotForProspectus } from "./prospectus-marc-snapshot";
import { loadProspectusNoteFinancialInputs } from "./prospectus-note-financial-inputs";

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
   * Application financial_statements for unpublished preview only: the Note financial snapshot
   * when present, else the live Application (legacy Note).
   * Null when published (must not be used) or when Application is missing.
   */
  liveFinancialStatements: unknown | null;
  /**
   * Application-owned CTOS financials_json for unpublished preview only: the Note financial
   * snapshot when present, else live (legacy Note). Same source as Page 2 Stage 4.
   */
  liveCtosFinancials: unknown | null;
  /** Financial-year selection reference date; null only when published (frozen years are used). */
  financialReferenceDate: Date | null;
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
 * Load Note + financial inputs (Note financial snapshot, else live Application + owned CTOS)
 * for unpublished preview. Published Notes never receive financial inputs from this loader.
 */
export async function loadProspectusPageThreeData(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageThreeLoadedData> {
  const note = await loadProspectusPageThreeNote(db, noteId);
  const published = isProspectusNotePublished(note);
  const marcSnapshot = await resolveMarcSnapshotForProspectus(note);

  if (published) {
    return {
      note,
      liveFinancialStatements: null,
      liveCtosFinancials: null,
      financialReferenceDate: null,
      marcSnapshot,
    };
  }

  const financialInputs = await loadProspectusNoteFinancialInputs({ db, note });

  return {
    note,
    liveFinancialStatements: financialInputs.financialStatements,
    liveCtosFinancials: financialInputs.ctosFinancials,
    financialReferenceDate: financialInputs.referenceDate,
    marcSnapshot,
  };
}
