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
