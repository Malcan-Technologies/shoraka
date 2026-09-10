import { NoteSettlementStatus } from "@prisma/client";
import { roundNoteMoney } from "@cashsouk/types";

export const PRE_SETTLEMENT_WAIVER_VOID_STATUSES = [
  NoteSettlementStatus.PREVIEW,
  NoteSettlementStatus.APPROVED,
] as const;

export function settlementIdsToVoidForPreSettlementWaiver(
  settlements: readonly { id: string; status: NoteSettlementStatus }[]
): string[] {
  if (settlements.some((row) => row.status === NoteSettlementStatus.POSTED)) {
    return [];
  }
  return settlements
    .filter((row) =>
      (PRE_SETTLEMENT_WAIVER_VOID_STATUSES as readonly NoteSettlementStatus[]).includes(row.status)
    )
    .map((row) => row.id);
}

export function preSettlementWaiverVoidWhere(settlementIds: string[]) {
  return {
    id: { in: settlementIds },
    status: { in: [...PRE_SETTLEMENT_WAIVER_VOID_STATUSES] },
  };
}

export function waiverLinkedSettlementId(input: {
  postedSettlementId: string | null | undefined;
  requestedSettlementId: string | null | undefined;
  noteSettlements: readonly { id: string; status: NoteSettlementStatus }[];
  voidedSettlementIds: readonly string[];
}): string | null {
  if (input.postedSettlementId) return input.postedSettlementId;
  const requested = input.requestedSettlementId;
  if (!requested) return null;
  const match = input.noteSettlements.find((row) => row.id === requested);
  if (!match) return null;
  if (match.status === NoteSettlementStatus.VOID) return null;
  if (input.voidedSettlementIds.includes(requested)) return null;
  return requested;
}

export function remainingCapsIgnoringApprovedSettlements(
  remaining: { remainingTawidhAmount: number; remainingGharamahAmount: number },
  settlements: readonly {
    status: NoteSettlementStatus;
    tawidhAmount: number;
    gharamahAmount: number;
  }[]
): { remainingTawidhAmount: number; remainingGharamahAmount: number } {
  const approved = settlements.filter((row) => row.status === NoteSettlementStatus.APPROVED);
  return {
    remainingTawidhAmount: roundNoteMoney(
      remaining.remainingTawidhAmount +
        approved.reduce((sum, row) => sum + row.tawidhAmount, 0),
      2
    ),
    remainingGharamahAmount: roundNoteMoney(
      remaining.remainingGharamahAmount +
        approved.reduce((sum, row) => sum + row.gharamahAmount, 0),
      2
    ),
  };
}
