/**
 * SECTION: CTOS vs issuer unaudited year validation
 * WHY: Admin table headers (VALID / PENDING / INVALID) and issuer-side debugging use one ruleset.
 * INPUT: CTOS reporting_year list, unaudited year, questionnaire flags
 * OUTPUT: Latest CTOS year, last three display years, validation status per unaudited column
 * WHERE USED: Admin financial review UI, optional issuer logs
 */

export type UnauditedColumnValidationStatus = "VALID" | "PENDING" | "INVALID";

export interface ValidateUnauditedColumnInput {
  ctosLatestYear: number | null;
  unauditedYear: number;
  latestYearSubmitted: boolean;
  /** Q1 financial year end year (Y) — anchor for CTOS lag / CASE 5 */
  financialYearEndYear: number;
}

export interface ValidateUnauditedColumnResult {
  status: UnauditedColumnValidationStatus;
  reason: string;
}

/**
 * Max reporting_year from CTOS financial rows.
 */
export function getCtosLatestYear(rows: { reporting_year?: number | null }[]): number | null {
  let max: number | null = null;
  for (const r of rows) {
    const y = r.reporting_year;
    if (y == null || !Number.isFinite(y)) continue;
    if (max === null || y > max) max = y;
  }
  return max;
}

/**
 * Distinct reporting years, sorted ascending; keep only the last `count` (most recent).
 */
export function getLatestNCtosYears(
  rows: { reporting_year?: number | null }[],
  count: number
): number[] {
  const set = new Set<number>();
  for (const r of rows) {
    const y = r.reporting_year;
    if (y != null && Number.isFinite(y)) set.add(y);
  }
  const sorted = [...set].sort((a, b) => a - b);
  if (sorted.length <= count) return sorted;
  return sorted.slice(sorted.length - count);
}

/** Latest three CTOS years for admin display (oldest to newest). */
export function getLatestThreeCtosYears(rows: { reporting_year?: number | null }[]): number[] {
  return getLatestNCtosYears(rows, 3);
}

/**
 * Rules:
 * - VALID: unauditedYear === ctosLatest + 1 (needs CTOS baseline)
 * - INVALID: unauditedYear <= ctosLatest (duplicate or outdated)
 * - INVALID: unauditedYear > ctosLatest + 1 (too far ahead)
 * - PENDING (CASE 5): issuer says latest Y submitted but Y > ctosLatest (CTOS not caught up)
 * - No CTOS: PENDING ("No CTOS baseline")
 */
export function validateUnauditedColumn(
  input: ValidateUnauditedColumnInput
): ValidateUnauditedColumnResult {
  const { ctosLatestYear, unauditedYear, latestYearSubmitted, financialYearEndYear } = input;
  const Y = financialYearEndYear;

  if (ctosLatestYear === null) {
    return {
      status: "PENDING",
      reason: "No CTOS baseline yet — cannot verify year against submitted data",
    };
  }

  if (unauditedYear <= ctosLatestYear) {
    return {
      status: "INVALID",
      reason: "Year already in CTOS or older than CTOS latest",
    };
  }

  /** CASE 5: submitted claim for Y but CTOS not at Y yet — flag for admin review. */
  if (latestYearSubmitted && Y > ctosLatestYear) {
    return {
      status: "PENDING",
      reason: "Issuer reports FY ending in Y as submitted; CTOS latest year is still before Y",
    };
  }

  if (unauditedYear === ctosLatestYear + 1) {
    return {
      status: "VALID",
      reason: "Next financial year after CTOS latest",
    };
  }

  return {
    status: "INVALID",
    reason: "Year is more than one step after CTOS latest",
  };
}

/**
 * Expected unaudited year keys from questionnaire (Cases A–D).
 * Y = financial_year_end_year.
 */
export function getExpectedUnauditedYearsFromQuestionnaire(q: {
  financial_year_end_year: number;
  latest_year_submitted: boolean;
  has_next_financial_year_data: boolean;
}): number[] {
  const Y = q.financial_year_end_year;
  if (!q.latest_year_submitted && !q.has_next_financial_year_data) return [Y];
  if (!q.latest_year_submitted && q.has_next_financial_year_data) return [Y, Y + 1];
  if (q.latest_year_submitted && !q.has_next_financial_year_data) return [];
  return [Y + 1];
}
