/**
 * SECTION: Load Note data required for Prospectus Page 1
 * WHY: Keep Prisma queries out of HTML renderers; select only Page 1 fields
 */

import { NoteStatus, type PrismaClient } from "@prisma/client";
import { isNoteProspectusPublished } from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";

export const PROSPECTUS_PAGE_ONE_NOTE_SELECT = {
  id: true,
  note_reference: true,
  issuer_organization_id: true,
  target_amount: true,
  funded_amount: true,
  profit_rate_percent: true,
  service_fee_rate_percent: true,
  maturity_date: true,
  tenure_days: true,
  status: true,
  repaid_at: true,
  published_at: true,
  product_snapshot: true,
  invoice_snapshot: true,
  paymaster_snapshot: true,
  purpose_snapshot: true,
  prospectus_snapshot: true,
  source_application_id: true,
  created_at: true,
  updated_at: true,
  listing: {
    select: {
      opens_at: true,
      closes_at: true,
    },
  },
} as const;

export type ProspectusPageOneNoteRecord = {
  id: string;
  note_reference: string;
  issuer_organization_id: string;
  target_amount: unknown;
  funded_amount: unknown;
  profit_rate_percent: unknown;
  service_fee_rate_percent: unknown;
  maturity_date: Date | null;
  tenure_days: number | null;
  status: NoteStatus;
  repaid_at: Date | null;
  published_at: Date | null;
  product_snapshot: unknown;
  invoice_snapshot: unknown;
  paymaster_snapshot: unknown;
  purpose_snapshot: unknown;
  prospectus_snapshot: unknown;
  source_application_id: string;
  created_at: Date;
  updated_at: Date;
  listing: {
    opens_at: Date | null;
    closes_at: Date | null;
  } | null;
};

/**
 * Published for prospectus freeze: Note completed NoteService.publish (`published_at` set)
 * and was not unpublished (status is not DRAFT). Funding close / servicing keep the freeze.
 */
export function isProspectusNotePublished(note: {
  status: NoteStatus;
  published_at: Date | null;
}): boolean {
  return isNoteProspectusPublished({
    status: note.status,
    publishedAt: note.published_at,
  });
}

export async function loadProspectusPageOneNote(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageOneNoteRecord> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: PROSPECTUS_PAGE_ONE_NOTE_SELECT,
  });

  if (!note) {
    throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
  }

  return note;
}
