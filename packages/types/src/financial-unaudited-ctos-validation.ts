/**
 * Issuer financial questionnaire helpers, CTOS financial year lists, and fixed tab years (system date).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Stored under `financial_statements.questionnaire` (v2). */
export type FinancialStatementsQuestionnaire = {
  last_closing_date: string;
  is_submitted_to_ssm: boolean;
};

function calendarYearFromLastClosingDate(iso: string): number | null {
  const t = iso.trim();
  if (!ISO_DATE.test(t)) return null;
  const y = Number(t.slice(0, 4));
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  const m = Number(t.slice(5, 7));
  const d = Number(t.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return y;
}

/**
 * Parse stored questionnaire JSON (current keys only).
 * `last_closing_date` is reference only; tab years use {@link getFinancialInputBaseYears}.
 */
export function normalizeFinancialStatementsQuestionnaire(
  raw: unknown
): FinancialStatementsQuestionnaire | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const last_closing_date = o.last_closing_date;
  const is_submitted_to_ssm = o.is_submitted_to_ssm;
  if (typeof last_closing_date !== "string" || typeof is_submitted_to_ssm !== "boolean") return null;
  if (!ISO_DATE.test(last_closing_date.trim())) return null;
  if (calendarYearFromLastClosingDate(last_closing_date) == null) return null;
  return { last_closing_date: last_closing_date.trim(), is_submitted_to_ssm };
}

/** year2 = calendar year of `ref` (local); year1 = year2 - 1 (start years for tabs / admin columns). */
export function getFinancialInputBaseYears(ref: Date = new Date()): { year1: number; year2: number } {
  const year2 = ref.getFullYear();
  return { year1: year2 - 1, year2 };
}

/**
 * Issuer tab years (start year per tab). Uses system date only, not `last_closing_date`.
 * Submitted to SSM: one tab (year2). Not submitted: year1 then year2.
 */
export function getIssuerFinancialTabYears(isSubmittedToSsm: boolean, ref: Date = new Date()): number[] {
  const { year1, year2 } = getFinancialInputBaseYears(ref);
  return isSubmittedToSsm ? [year2] : [year1, year2];
}

/** Admin: fixed user-input column headers (always two), left = year1, right = year2. */
export function getAdminUserInputColumnYears(ref: Date = new Date()): [number, number] {
  const { year1, year2 } = getFinancialInputBaseYears(ref);
  return [year1, year2];
}

/** CTOS financial row shape used by helpers (stored as financial_year on each row). */
export type CtosFinancialYearRowInput = { financial_year?: number | null };

/** Latest N CTOS financial years (ascending). */
export function getLatestNCtosYears(rows: CtosFinancialYearRowInput[], count: number): number[] {
  const set = new Set<number>();
  for (const r of rows) {
    const y = r.financial_year;
    if (y != null && Number.isFinite(y)) set.add(y);
  }
  const sorted = [...set].sort((a, b) => a - b);
  if (sorted.length <= count) return sorted;
  return sorted.slice(sorted.length - count);
}

/** Latest three CTOS financial years for admin (oldest to newest among the three). */
export function getLatestThreeCtosYears(rows: CtosFinancialYearRowInput[]): number[] {
  return getLatestNCtosYears(rows, 3);
}

/** Always three CTOS column slots, ascending; pad with null on the right when fewer than three years. */
export function getLatestThreeCtosYearSlots(rows: CtosFinancialYearRowInput[]): (number | null)[] {
  const ys = getLatestThreeCtosYears(rows);
  const out: (number | null)[] = ys.map((y) => y);
  while (out.length < 3) out.push(null);
  return out.slice(0, 3);
}

/**
 * Max financial_year from CTOS financial rows.
 */
export function getCtosLatestYear(rows: CtosFinancialYearRowInput[]): number | null {
  let max: number | null = null;
  for (const r of rows) {
    const y = r.financial_year;
    if (y == null || !Number.isFinite(y)) continue;
    if (max === null || y > max) max = y;
  }
  return max;
}
