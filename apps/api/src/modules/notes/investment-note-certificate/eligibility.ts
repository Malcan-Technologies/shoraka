import { NoteFundingStatus, NoteStatus } from "@prisma/client";

const ISSUED_NOTE_STATUSES = new Set<NoteStatus | string>([
  NoteStatus.ACTIVE,
  NoteStatus.ARREARS,
  NoteStatus.DEFAULTED,
  NoteStatus.REPAID,
]);

export function isNoteEligibleForCertificateGeneration(note: {
  funding_status?: NoteFundingStatus | string | null;
  fundingStatus?: NoteFundingStatus | string | null;
  status: NoteStatus | string;
  disbursement_value_date?: Date | string | null;
  disbursementValueDate?: Date | string | null;
}): boolean {
  const funding = note.funding_status ?? note.fundingStatus;
  const disbursedAt = note.disbursement_value_date ?? note.disbursementValueDate ?? null;
  return (
    funding === NoteFundingStatus.FUNDED &&
    ISSUED_NOTE_STATUSES.has(note.status) &&
    disbursedAt != null
  );
}
