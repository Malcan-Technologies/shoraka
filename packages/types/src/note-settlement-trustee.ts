import type { NoteSettlement, NoteSettlementPoolSummary } from "./notes";

const TRUSTEE_MOVEMENT_TOLERANCE = 0.005;

export function hasSettlementTrusteeMovementFromSettlement(
  settlement: Pick<
    NoteSettlement,
    | "investorPrincipal"
    | "investorProfitNet"
    | "tawidhInvestorAmount"
    | "serviceFeeAmount"
    | "tawidhAccountAmount"
    | "gharamahAmount"
    | "issuerResidualAmount"
  >
): boolean {
  return (
    settlement.investorPrincipal +
      settlement.investorProfitNet +
      settlement.tawidhInvestorAmount >
      TRUSTEE_MOVEMENT_TOLERANCE ||
    settlement.serviceFeeAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    settlement.tawidhAccountAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    settlement.gharamahAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    settlement.issuerResidualAmount > TRUSTEE_MOVEMENT_TOLERANCE
  );
}

export function hasSettlementTrusteeMovementFromPoolSummary(
  summary: Pick<
    NoteSettlementPoolSummary,
    | "investorPoolAmount"
    | "operatingAccountAmount"
    | "tawidhAccountAmount"
    | "gharamahAccountAmount"
    | "issuerResidualAmount"
  >
): boolean {
  return (
    summary.investorPoolAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    summary.operatingAccountAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    summary.tawidhAccountAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    summary.gharamahAccountAmount > TRUSTEE_MOVEMENT_TOLERANCE ||
    summary.issuerResidualAmount > TRUSTEE_MOVEMENT_TOLERANCE
  );
}

export function isSettlementSummaryTrusteeInstructionComplete(
  summary: NoteSettlementPoolSummary
): boolean {
  if (!hasSettlementTrusteeMovementFromPoolSummary(summary)) {
    return true;
  }
  return summary.serviceFeeTrusteeStatus === "COMPLETED";
}

export function areAllPostedSettlementTrusteeInstructionsComplete(
  settlements: NoteSettlement[]
): boolean {
  const postedNeedingTrustee = settlements.filter(
    (settlement) =>
      settlement.status === "POSTED" &&
      hasSettlementTrusteeMovementFromSettlement(settlement)
  );
  if (postedNeedingTrustee.length === 0) {
    return true;
  }
  return postedNeedingTrustee.every(
    (settlement) => settlement.serviceFeeTrusteeStatus === "COMPLETED"
  );
}

export function isSettlementWrappingUpFromSettlements(
  settlements: NoteSettlement[]
): boolean {
  const hasPostedSettlement = settlements.some(
    (settlement) => settlement.status === "POSTED"
  );
  return (
    hasPostedSettlement &&
    !areAllPostedSettlementTrusteeInstructionsComplete(settlements)
  );
}

export function isSettlementWrappingUpFromSummary(
  summary: NoteSettlementPoolSummary | null | undefined
): boolean {
  if (!summary || summary.status !== "POSTED") {
    return false;
  }
  return !isSettlementSummaryTrusteeInstructionComplete(summary);
}
