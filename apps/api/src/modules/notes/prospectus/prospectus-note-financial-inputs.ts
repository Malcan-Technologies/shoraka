/**
 * SECTION: Prospectus financial inputs + year-selection reference date for one Note
 * WHY: A Note with a financial snapshot never re-reads the application or CTOS; a legacy Note
 * (no snapshot) keeps the live application + application-owned CTOS read unchanged
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { loadApplicationOwnedCtosFinancialReport } from "../../applications/application-owned-ctos";
import {
  parseNoteFinancialSnapshot,
  type NoteFinancialSnapshot,
} from "../note-financial-snapshot.types";

type FinancialInputsReader = PrismaClient | Prisma.TransactionClient;

export type ProspectusNoteFinancialInputs = {
  origin: "note_financial_snapshot" | "live_application";
  /** application.financial_statements (snapshot copy, or live for a legacy Note). */
  financialStatements: unknown | null;
  /** Application-owned CTOS financials_json (snapshot copy, or live for a legacy Note). */
  ctosFinancials: unknown | null;
  /** Reference date for financial-year selection. See resolveProspectusFinancialReferenceDate. */
  referenceDate: Date;
};

export type ProspectusNoteFinancialInputsNote = {
  financial_snapshot: unknown;
  source_application_id: string;
  issuer_organization_id: string;
  created_at: Date;
};

/**
 * Reference date for Prospectus financial-year selection.
 * - Snapshot-backed Note: snapshot.reference_date.
 * - Legacy Note: the source application's submitted_at, else the Note's created_at.
 * WHY: submission is the date the issuer's financial-year tabs were validated against, so every
 * submitted User Input year stays selectable; it is also stable for the life of the Note, so the
 * same Note never selects different years on different days.
 */
export function resolveProspectusFinancialReferenceDate(input: {
  snapshot: NoteFinancialSnapshot | null;
  applicationSubmittedAt: Date | null;
  noteCreatedAt: Date;
}): Date {
  if (input.snapshot) return new Date(input.snapshot.reference_date);
  return input.applicationSubmittedAt ?? input.noteCreatedAt;
}

function inputsFromSnapshot(snapshot: NoteFinancialSnapshot): ProspectusNoteFinancialInputs {
  return {
    origin: "note_financial_snapshot",
    financialStatements: snapshot.financial_statements,
    ctosFinancials: snapshot.ctos?.financials ?? null,
    referenceDate: resolveProspectusFinancialReferenceDate({
      snapshot,
      applicationSubmittedAt: null,
      noteCreatedAt: new Date(snapshot.captured_at),
    }),
  };
}

/**
 * Snapshot first; only a Note with no snapshot (SQL NULL or JSON null) takes the legacy live read.
 * A present snapshot that does not parse throws: a snapshot-backed Note never reads live sources.
 */
export async function loadProspectusNoteFinancialInputs(params: {
  db: FinancialInputsReader;
  note: ProspectusNoteFinancialInputsNote;
}): Promise<ProspectusNoteFinancialInputs> {
  const { db, note } = params;
  if (note.financial_snapshot != null) {
    const snapshot = parseNoteFinancialSnapshot(note.financial_snapshot);
    if (!snapshot) {
      throw new AppError(500, "NOTE_FINANCIAL_SNAPSHOT_INVALID", "Note financial snapshot is invalid");
    }
    return inputsFromSnapshot(snapshot);
  }

  const application = await db.application.findUnique({
    where: { id: note.source_application_id },
    select: { financial_statements: true, submitted_at: true },
  });
  const ctosReport = await loadApplicationOwnedCtosFinancialReport({
    db,
    issuerOrganizationId: note.issuer_organization_id,
    submittedAt: application?.submitted_at ?? null,
  });

  return {
    origin: "live_application",
    financialStatements: application?.financial_statements ?? null,
    ctosFinancials: ctosReport?.financialsJson ?? null,
    referenceDate: resolveProspectusFinancialReferenceDate({
      snapshot: null,
      applicationSubmittedAt: application?.submitted_at ?? null,
      noteCreatedAt: note.created_at,
    }),
  };
}
