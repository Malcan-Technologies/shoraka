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
  return summary.settlementTrusteeStatus === "COMPLETED";
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
    (settlement) => settlement.settlementTrusteeStatus === "COMPLETED"
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

/**
 * True once the waterfall is posted (or the note is already REPAID/SETTLED).
 * Does not wait for the settlement trustee letter — that is a separate column.
 */
export function isNoteSettlementPosted(note: {
  status?: string;
  servicingStatus?: string | null;
  settlementSummary?: { status: string } | null;
  settlements?: Array<{ status: string }>;
}): boolean {
  if (note.settlements?.some((settlement) => settlement.status === "POSTED")) {
    return true;
  }
  if (note.settlementSummary?.status === "POSTED") return true;
  return note.status === "REPAID" || note.servicingStatus === "SETTLED";
}

export type SettlementTrusteeRegistryState =
  | "none"
  | "pending_letter"
  | "letter_generated"
  | "submitted"
  | "complete";

/**
 * Trustee-instruction column state. Independent of whether the note badge says Settled.
 * Shows a workflow whenever a posted settlement has pool movements or an explicit trustee status.
 */
export function resolveSettlementTrusteeRegistryState(
  summary: NoteSettlementPoolSummary | null | undefined
): SettlementTrusteeRegistryState {
  if (!summary || summary.status !== "POSTED") return "none";
  const status = summary.settlementTrusteeStatus;
  const tracked = hasSettlementTrusteeMovementFromPoolSummary(summary) || status != null;
  if (!tracked) return "none";
  if (status === "COMPLETED") return "complete";
  if (status === "SUBMITTED_TO_TRUSTEE") return "submitted";
  if (status === "LETTER_GENERATED") return "letter_generated";
  return "pending_letter";
}

/** Notes-table labels for the trustee-instruction column. */
export function settlementTrusteeRegistryLabel(
  state: SettlementTrusteeRegistryState
): string | null {
  if (state === "pending_letter") return "Generate letter";
  if (state === "letter_generated") return "Submit to trustee";
  if (state === "submitted") return "Await trustee";
  if (state === "complete") return "Completed";
  return null;
}

export function settlementTrusteeRegistryNeedsAdminAction(
  summary: NoteSettlementPoolSummary | null | undefined
): boolean {
  const state = resolveSettlementTrusteeRegistryState(summary);
  return state === "pending_letter" || state === "letter_generated";
}

