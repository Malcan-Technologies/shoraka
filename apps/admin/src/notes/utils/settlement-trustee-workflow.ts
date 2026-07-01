import type { NoteDetail } from "@cashsouk/types";

export function hasSettlementTrusteeMovement(
  settlement: NoteDetail["settlements"][number]
): boolean {
  return (
    settlement.investorPrincipal +
      settlement.investorProfitNet +
      settlement.tawidhInvestorAmount >
      0.005 ||
    settlement.serviceFeeAmount > 0.005 ||
    settlement.tawidhAccountAmount > 0.005 ||
    settlement.gharamahAmount > 0.005 ||
    settlement.issuerResidualAmount > 0.005
  );
}

export function postedSettlementsNeedingTrusteeInstruction(note: NoteDetail) {
  return note.settlements.filter(
    (settlement) =>
      settlement.status === "POSTED" && hasSettlementTrusteeMovement(settlement)
  );
}

export function isSettlementTrusteeInstructionComplete(note: NoteDetail): boolean {
  const postedNeedingTrustee = postedSettlementsNeedingTrusteeInstruction(note);
  if (postedNeedingTrustee.length === 0) {
    return true;
  }
  return postedNeedingTrustee.every(
    (settlement) => settlement.serviceFeeTrusteeStatus === "COMPLETED"
  );
}

export function isNoteLifecycleVisuallyComplete(note: NoteDetail): boolean {
  return (
    (note.status === "REPAID" || note.servicingStatus === "SETTLED") &&
    isSettlementTrusteeInstructionComplete(note)
  );
}

export function isSettlementWrappingUp(note: NoteDetail): boolean {
  const hasPostedSettlement = note.settlements.some(
    (settlement) => settlement.status === "POSTED"
  );
  return hasPostedSettlement && !isSettlementTrusteeInstructionComplete(note);
}
