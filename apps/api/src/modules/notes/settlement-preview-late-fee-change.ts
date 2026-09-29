/**
 * Late/default fee amounts belong to notes.default.manage, but they are saved through
 * settlement preview (notes.settlement.manage). A preview that changes them needs both.
 */

const LATE_FEE_TOLERANCE = 0.005;

export type SettlementPreviewLateFeeFields = {
  tawidhAmount?: number | null;
  tawidhInvestorSharePercent?: number | null;
  gharamahAmount?: number | null;
};

/**
 * True when the preview request sets, changes or clears Ta'widh, Gharamah or the Ta'widh
 * investor share. The baseline is the saved PREVIEW settlement, or zero when there is none.
 */
export function settlementPreviewChangesLateFees(
  input: SettlementPreviewLateFeeFields,
  baseline: SettlementPreviewLateFeeFields | null
): boolean {
  const nextTawidh = input.tawidhAmount ?? 0;
  const nextGharamah = input.gharamahAmount ?? 0;
  const savedTawidh = baseline?.tawidhAmount ?? 0;
  const savedGharamah = baseline?.gharamahAmount ?? 0;

  if (Math.abs(nextTawidh - savedTawidh) > LATE_FEE_TOLERANCE) return true;
  if (Math.abs(nextGharamah - savedGharamah) > LATE_FEE_TOLERANCE) return true;

  // The investor share only splits Ta'widh, so it has no effect when Ta'widh is zero.
  if (nextTawidh <= LATE_FEE_TOLERANCE) return false;

  const nextShare = input.tawidhInvestorSharePercent ?? 0;
  const savedShare = baseline?.tawidhInvestorSharePercent ?? 0;
  return Math.abs(nextShare - savedShare) > LATE_FEE_TOLERANCE;
}
