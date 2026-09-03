import {
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
} from "@prisma/client";
import { isTenureBackedNote } from "@cashsouk/types";

export function isTenureNote(tenureDays: number | null | undefined): boolean {
  return isTenureBackedNote(tenureDays);
}

export function isNoteFullySettledForHibahReceipt(note: {
  status: NoteStatus | string;
  servicing_status?: NoteServicingStatus | string;
  servicingStatus?: NoteServicingStatus | string;
}): boolean {
  const servicing = note.servicing_status ?? note.servicingStatus;
  return note.status === NoteStatus.REPAID && servicing === NoteServicingStatus.SETTLED;
}

export function isPostedSettlementStatus(status: NoteSettlementStatus | string): boolean {
  return status === NoteSettlementStatus.POSTED;
}

export function hasReadyHibahReceiptV01(
  rows: Array<{ version: string; status: string }>,
  version: string
): boolean {
  return rows.some((row) => row.version === version && row.status === "READY");
}
