import type { NoteDetail } from "@cashsouk/types";
import {
  areAllPostedSettlementTrusteeInstructionsComplete,
  hasSettlementTrusteeMovementFromSettlement,
  isSettlementWrappingUpFromSettlements,
} from "@cashsouk/types";

export {
  areAllPostedSettlementTrusteeInstructionsComplete,
  hasSettlementTrusteeMovementFromPoolSummary,
  hasSettlementTrusteeMovementFromSettlement,
  isSettlementSummaryTrusteeInstructionComplete,
  isSettlementWrappingUpFromSettlements,
  isSettlementWrappingUpFromSummary,
} from "@cashsouk/types";

export function hasSettlementTrusteeMovement(
  settlement: NoteDetail["settlements"][number]
): boolean {
  return hasSettlementTrusteeMovementFromSettlement(settlement);
}

export function postedSettlementsNeedingTrusteeInstruction(note: NoteDetail) {
  return note.settlements.filter(
    (settlement) =>
      settlement.status === "POSTED" && hasSettlementTrusteeMovement(settlement)
  );
}

export function isSettlementTrusteeInstructionComplete(note: NoteDetail): boolean {
  return areAllPostedSettlementTrusteeInstructionsComplete(note.settlements);
}

export function isNoteLifecycleVisuallyComplete(note: NoteDetail): boolean {
  return (
    (note.status === "REPAID" || note.servicingStatus === "SETTLED") &&
    isSettlementTrusteeInstructionComplete(note)
  );
}

export function isSettlementWrappingUp(note: NoteDetail): boolean {
  return isSettlementWrappingUpFromSettlements(note.settlements);
}
