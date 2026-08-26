import { moneyAmountExceeds } from "./note-money";

/** Hard cap: invoice financing cannot exceed 80% of invoice face value. */

export const MAX_INVOICE_FINANCING_RATIO_PERCENT = 80;
export const DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT = 60;
export const DEFAULT_MAX_INVOICE_FINANCING_RATIO_PERCENT = MAX_INVOICE_FINANCING_RATIO_PERCENT;

export const INVOICE_FINANCING_RATIO_CAP_MESSAGE =
  "Financing cannot exceed 80% of the invoice value.";

const RATIO_COMPARE_EPSILON = 1e-9;

export function effectiveInvoiceFinancingRatioMax(
  productMax?: number | null
): number {
  if (productMax == null || !Number.isFinite(productMax)) {
    return MAX_INVOICE_FINANCING_RATIO_PERCENT;
  }
  return Math.min(productMax, MAX_INVOICE_FINANCING_RATIO_PERCENT);
}

/** Slider / validation bounds: product max is preserved when below 80, otherwise clamped. */
export function resolveInvoiceFinancingRatioBounds(
  minRatio?: number | null,
  maxRatio?: number | null
): { min: number; max: number } {
  const max = effectiveInvoiceFinancingRatioMax(maxRatio);
  const rawMin =
    minRatio != null && Number.isFinite(minRatio)
      ? minRatio
      : DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT;
  const min = Math.min(Math.max(rawMin, 0), max);
  return { min, max };
}

export function invoiceFinancingRatioFromAmount(
  offeredAmount: number,
  invoiceFace: number
): number | null {
  if (!Number.isFinite(offeredAmount) || !Number.isFinite(invoiceFace) || invoiceFace <= 0) {
    return null;
  }
  return (offeredAmount / invoiceFace) * 100;
}

/**
 * True when an explicit ratio or offeredAmount / invoice face exceeds the 80% cap.
 * Amount is the source of truth so a null, stale, or rounded offeredRatioPercent cannot bypass.
 */
export function invoiceFinancingExceedsMaxRatio(input: {
  offeredAmount?: number | null;
  invoiceFace: number;
  offeredRatioPercent?: number | null;
}): boolean {
  const { offeredAmount, invoiceFace, offeredRatioPercent } = input;
  if (
    offeredRatioPercent != null &&
    Number.isFinite(offeredRatioPercent) &&
    offeredRatioPercent > MAX_INVOICE_FINANCING_RATIO_PERCENT + RATIO_COMPARE_EPSILON
  ) {
    return true;
  }
  if (
    offeredAmount == null ||
    !Number.isFinite(offeredAmount) ||
    !Number.isFinite(invoiceFace) ||
    invoiceFace <= 0
  ) {
    return false;
  }
  return moneyAmountExceeds(
    offeredAmount,
    (invoiceFace * MAX_INVOICE_FINANCING_RATIO_PERCENT) / 100
  );
}
