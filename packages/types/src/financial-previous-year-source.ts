export type PreviousYearCurrentSource = "user_input" | "ctos" | "admin_input";

export interface ResolvePreviousYearSourceValueParams {
  currentSource: PreviousYearCurrentSource;
  /**
   * Previous-year value from User Input / unaudited.
   * `null` means unavailable; `0` is a valid value and must stop fallback.
   */
  previousUserInputValue: number | null;
  /**
   * Previous-year value from CTOS.
   * `null` means unavailable; `0` is a valid value and must stop fallback.
   */
  previousCtosValue: number | null;
  /**
   * Previous-year value from active Admin Input.
   * `null` means unavailable (including "superseded" admin input being excluded).
   * `0` is a valid value and must stop fallback.
   */
  previousActiveAdminInputValue: number | null;
}

/**
 * Previous-year fallback rules for Admin Financial Summary calculated metrics.
 *
 * IMPORTANT: This helper only decides which SOURCE to use for the previous-year *raw value*.
 * It never changes formulas.
 */
export function resolvePreviousYearSourceValue(params: ResolvePreviousYearSourceValueParams): number | null {
  const { currentSource, previousUserInputValue, previousCtosValue, previousActiveAdminInputValue } = params;

  if (currentSource === "user_input") {
    if (previousUserInputValue != null) return previousUserInputValue;
    if (previousCtosValue != null) return previousCtosValue;
    return previousActiveAdminInputValue;
  }

  // For CTOS current-year and Admin Input current-year:
  // CTOS is the first historical fallback; User Input is never used.
  if (previousCtosValue != null) return previousCtosValue;
  return previousActiveAdminInputValue;
}

