/**
 * SECTION: Issuer financial questionnaire + CTOS financial year helpers
 * WHY: Single rules for which user-input years to show and how CTOS rows are keyed for admin.
 * INPUT: questionnaire JSON; CTOS financial rows with financial_year
 * OUTPUT: Normalized questionnaire, year list for tabs, latest N CTOS financial years
 * WHERE USED: Issuer financial step, API save validation, admin financial summary
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Stored under `financial_statements.questionnaire` (v2). */
export type FinancialStatementsQuestionnaire = {
  last_closing_date: string;
  is_submitted_to_ssm: boolean;
};

export function calendarYearFromLastClosingDate(iso: string): number | null {
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
 * Issuer per-year block `pldd`: current calendar year (from last closing) is in progress — empty string.
 * Prior calendar year uses questionnaire `last_closing_date` as financial year end.
 */
export function issuerPlddForUnauditedYear(year: number, lastClosingIso: string): string {
  const cy = calendarYearFromLastClosingDate(lastClosingIso);
  if (cy == null) return "";
  if (year === cy) return "";
  if (year === cy - 1) return lastClosingIso.trim();
  return "";
}

/**
 * Parse stored questionnaire JSON (current keys only).
 * INPUT: raw `questionnaire` object from JSON
 * OUTPUT: typed object or null if missing or wrong shape
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

/**
 * Calendar year keys for unaudited_by_year from questionnaire.
 * Ascending order (older year first) for two tabs; single tab is current year only.
 */
export function getIssuerFinancialInputYearsFromQuestionnaire(
  q: FinancialStatementsQuestionnaire
): number[] {
  const currentYear = calendarYearFromLastClosingDate(q.last_closing_date);
  if (currentYear == null) return [];
  if (q.is_submitted_to_ssm) return [currentYear];
  return [currentYear - 1, currentYear];
}

/** CTOS financial row shape used by helpers (stored as financial_year on each row). */
export type CtosFinancialYearRowInput = { financial_year?: number | null };

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

/**
 * Distinct financial years, sorted ascending; keep only the last `count` (most recent).
 */
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

/** Latest three CTOS financial years for admin display (oldest to newest). */
export function getLatestThreeCtosYears(rows: CtosFinancialYearRowInput[]): number[] {
  return getLatestNCtosYears(rows, 3);
}
