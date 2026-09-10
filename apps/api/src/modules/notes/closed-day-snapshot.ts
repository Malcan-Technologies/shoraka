import { NoteServicingStatus, NoteSettlementStatus, NoteStatus } from "@prisma/client";
import { mytCalendarParts, mytStartOfDayUtc } from "@cashsouk/types";
import type { ServicingClassification } from "./servicing-classifier";

export function mytSnapshotCutoff(now: Date): Date {
  return mytStartOfDayUtc(mytCalendarParts(now));
}

export function occurredBeforeCutoff(at: Date | null | undefined, cutoff: Date): boolean {
  return at != null && at.getTime() < cutoff.getTime();
}

/** Legacy funded notes with no close timestamp stay on the closed-day book. */
export function fundedAsOfCutoff(fundingClosedAt: Date | null | undefined, cutoff: Date): boolean {
  return fundingClosedAt == null || occurredBeforeCutoff(fundingClosedAt, cutoff);
}

/** Legacy active notes with no activation timestamp stay on the closed-day book. */
export function activatedAsOfCutoff(activatedAt: Date | null | undefined, cutoff: Date): boolean {
  return activatedAt == null || occurredBeforeCutoff(activatedAt, cutoff);
}

export type SnapshotSettlement = {
  status: NoteSettlementStatus;
  posted_at: Date | null;
  approved_at?: Date | null;
  tawidh_amount: unknown;
  gharamah_amount: unknown;
  investor_principal: unknown;
  investor_profit_gross: unknown;
};

export type SnapshotWaiver = {
  created_at: Date;
  tawidh_waived_amount: unknown;
  gharamah_waived_amount: unknown;
};

export function settlementPostedAsOfCutoff(
  row: Pick<SnapshotSettlement, "status" | "posted_at">,
  cutoff: Date
): boolean {
  return row.status === NoteSettlementStatus.POSTED && occurredBeforeCutoff(row.posted_at, cutoff);
}

export function settlementAppliedAsOfCutoff(
  row: Pick<SnapshotSettlement, "status" | "posted_at" | "approved_at">,
  cutoff: Date
): boolean {
  if (settlementPostedAsOfCutoff(row, cutoff)) return true;
  return (
    (row.status === NoteSettlementStatus.APPROVED || row.status === NoteSettlementStatus.POSTED) &&
    occurredBeforeCutoff(row.approved_at, cutoff)
  );
}

export function settlementsAsOfCutoff<T extends SnapshotSettlement>(
  settlements: T[],
  cutoff: Date
): { applied: T[]; posted: T[] } {
  const posted = settlements.filter((row) => settlementPostedAsOfCutoff(row, cutoff));
  const applied = settlements.filter((row) => settlementAppliedAsOfCutoff(row, cutoff));
  return { applied, posted };
}

export function waiversAsOfCutoff<T extends SnapshotWaiver>(waivers: T[], cutoff: Date): T[] {
  return waivers.filter((row) => occurredBeforeCutoff(row.created_at, cutoff));
}

export function closedDaySnapshotStatuses(input: {
  repaidAsOfCutoff: boolean;
  postedAsOfCutoff: boolean;
  defaultedAsOfCutoff: boolean;
  classification: ServicingClassification;
  liveNoteStatus: NoteStatus;
}): {
  daysPastDue: number;
  servicingStatus: NoteServicingStatus;
  noteStatus: NoteStatus;
} {
  if (input.repaidAsOfCutoff) {
    return {
      daysPastDue: 0,
      servicingStatus: NoteServicingStatus.SETTLED,
      noteStatus: NoteStatus.REPAID,
    };
  }
  if (input.postedAsOfCutoff) {
    return {
      daysPastDue: 0,
      servicingStatus: NoteServicingStatus.CURRENT,
      noteStatus: NoteStatus.ACTIVE,
    };
  }
  if (input.defaultedAsOfCutoff) {
    return {
      daysPastDue: input.classification.daysPastDue,
      servicingStatus: NoteServicingStatus.DEFAULTED,
      noteStatus: NoteStatus.DEFAULTED,
    };
  }
  const liveIsTerminal =
    input.liveNoteStatus === NoteStatus.DEFAULTED || input.liveNoteStatus === NoteStatus.REPAID;
  return {
    daysPastDue: input.classification.daysPastDue,
    servicingStatus: input.classification.servicingStatus,
    noteStatus:
      input.classification.noteStatus ??
      (liveIsTerminal ? NoteStatus.ACTIVE : input.liveNoteStatus),
  };
}
