/**
 * SECTION: Load Note data required for Prospectus Page 2
 * WHY: Keep Prisma queries out of HTML; select only Page 2 fields
 */

import { NoteStatus, type PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";
import { resolveMarcSnapshotForProspectus } from "./prospectus-marc-snapshot";
import { loadProspectusNoteFinancialInputs } from "./prospectus-note-financial-inputs";

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
   * Application financial_statements for unpublished Stage 4 preview only: the Note financial
   * snapshot when present, else the live Application (legacy Note).
   * Null when published (must not be used) or when Application is missing.
   */
  liveFinancialStatements: unknown | null;
  /**
   * Application-owned CTOS financials for unpublished Stage 4 preview only: the Note financial
   * snapshot when present, else the report that existed at first submission (legacy Note).
   */
  liveCtosFinancials: unknown | null;
  /** Financial-year selection reference date; null only when published (frozen years are used). */
  financialReferenceDate: Date | null;
  marcSnapshot?: import("@cashsouk/types").MarcAssessmentSnapshot | null;
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
 * Load Note + financial inputs (Note financial snapshot, else live Application + owned CTOS)
 * for unpublished preview. Published Notes never receive financial inputs from this loader.
 */
export async function loadProspectusPageTwoData(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageTwoLoadedData> {
  const note = await loadProspectusPageTwoNote(db, noteId);
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
