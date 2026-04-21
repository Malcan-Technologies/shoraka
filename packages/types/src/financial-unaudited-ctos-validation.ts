/**
 * Issuer financial questionnaire helpers (FYE-based tab years), CTOS financial year lists.
 */

import { addDays, addMonths, format, startOfDay, subYears } from "date-fns";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Stored under `financial_statements.questionnaire` (v2). */
export type FinancialStatementsQuestionnaire = {
  financial_year_end: string;
};

function parseIsoDateOnlyLocal(iso: string): Date | null {
  const t = iso.trim();
  if (!ISO_DATE.test(t)) return null;
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7)) - 1;
  const d = Number(t.slice(8, 10));
  if (!Number.isFinite(y) || m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return dt;
}

/**
 * True when the ISO calendar day is strictly after `ref`'s calendar day (local).
 */
export function isFinancialYearEndStrictlyAfterRef(iso: string, ref: Date = new Date()): boolean {
  const chosen = parseIsoDateOnlyLocal(iso);
  if (!chosen) return false;
  return startOfDay(chosen).getTime() > startOfDay(ref).getTime();
}

/**
 * Parse stored questionnaire JSON. `financial_year_end` must be a valid ISO date strictly after `ref`.
 */
export function normalizeFinancialStatementsQuestionnaire(
  raw: unknown,
  ref: Date = new Date()
): FinancialStatementsQuestionnaire | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const financial_year_end = o.financial_year_end;
  if (typeof financial_year_end !== "string") return null;
  if (!ISO_DATE.test(financial_year_end.trim())) return null;
  if (parseIsoDateOnlyLocal(financial_year_end) == null) return null;
  if (!isFinancialYearEndStrictlyAfterRef(financial_year_end, ref)) return null;
  return { financial_year_end: financial_year_end.trim() };
}

/** FY period end for a tab keyed by FY end calendar year (same month/day as selected FYE). */
export function fyEndDateForYear(questionnaire: FinancialStatementsQuestionnaire, fyEndYear: number): Date | null {
  const selected = parseIsoDateOnlyLocal(questionnaire.financial_year_end);
  if (!selected) return null;
  return new Date(fyEndYear, selected.getMonth(), selected.getDate());
}

/** Period start ISO for FY ending in `fyEndYear` (12 months ending on FY end). */
export function getFinancialYearPeriodStartIso(
  questionnaire: FinancialStatementsQuestionnaire,
  fyEndYear: number
): string | null {
  const end = fyEndDateForYear(questionnaire, fyEndYear);
  if (!end) return null;
  const start = addDays(subYears(end, 1), 1);
  return format(start, "yyyy-MM-dd");
}

/** Period end ISO for FY ending in `fyEndYear`. */
export function getFinancialYearPeriodEndIso(
  questionnaire: FinancialStatementsQuestionnaire,
  fyEndYear: number
): string | null {
  const end = fyEndDateForYear(questionnaire, fyEndYear);
  if (!end) return null;
  return format(end, "yyyy-MM-dd");
}

/** Display line e.g. "1 Apr 2025 – 31 Mar 2026". */
export function formatFinancialFyPeriodDisplay(
  questionnaire: FinancialStatementsQuestionnaire,
  fyEndYear: number
): string {
  const startIso = getFinancialYearPeriodStartIso(questionnaire, fyEndYear);
  const endIso = getFinancialYearPeriodEndIso(questionnaire, fyEndYear);
  if (!startIso || !endIso) return "";
  const s = parseIsoDateOnlyLocal(startIso);
  const e = parseIsoDateOnlyLocal(endIso);
  if (!s || !e) return "";
  return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}

/**
 * Per-year `pldd`: FY end date for that column (ISO).
 */
export function issuerUnauditedPlddForFyEndYear(
  fyEndYear: number,
  questionnaire: FinancialStatementsQuestionnaire
): string {
  return getFinancialYearPeriodEndIso(questionnaire, fyEndYear) ?? "";
}

/**
 * Tab years = FY end calendar years (1 or 2). Deadline = previous FY end + 6 calendar months (SSM audited window).
 */
export function getIssuerFinancialTabYears(
  questionnaire: FinancialStatementsQuestionnaire,
  ref: Date = new Date()
): number[] {
  const currentFYEnd = parseIsoDateOnlyLocal(questionnaire.financial_year_end);
  if (!currentFYEnd) return [];
  const previousFYEnd = subYears(currentFYEnd, 1);
  const deadline = addMonths(previousFYEnd, 6);
  const today = startOfDay(ref);
  const deadlineDay = startOfDay(deadline);
  const currentYear = currentFYEnd.getFullYear();
  const previousYear = previousFYEnd.getFullYear();
  if (today.getTime() < deadlineDay.getTime()) {
    const a = Math.min(previousYear, currentYear);
    const b = Math.max(previousYear, currentYear);
    return [a, b];
  }
  return [currentYear];
}

/**
 * Admin Financial Summary: same FY columns as issuer (from questionnaire + `ref`).
 */
export function getAdminFinancialSummaryUserColumnYears(
  questionnaire: FinancialStatementsQuestionnaire | null,
  ref: Date = new Date()
): number[] {
  if (!questionnaire) return [];
  return getIssuerFinancialTabYears(questionnaire, ref);
}

/** Debug values for issuer / API logs. */
export function getFinancialYearEndComputationDetails(
  questionnaire: FinancialStatementsQuestionnaire,
  ref: Date = new Date()
): {
  fye: string;
  previousFYEndIso: string;
  deadlineIso: string;
  todayIso: string;
  years: number[];
} {
  const currentFYEnd = parseIsoDateOnlyLocal(questionnaire.financial_year_end);
  const previousFYEnd = currentFYEnd ? subYears(currentFYEnd, 1) : null;
  const deadline = previousFYEnd ? addMonths(previousFYEnd, 6) : null;
  return {
    fye: questionnaire.financial_year_end,
    previousFYEndIso: previousFYEnd ? format(previousFYEnd, "yyyy-MM-dd") : "",
    deadlineIso: deadline ? format(deadline, "yyyy-MM-dd") : "",
    todayIso: format(startOfDay(ref), "yyyy-MM-dd"),
    years: getIssuerFinancialTabYears(questionnaire, ref),
  };
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

/**
 * Always three CTOS column slots. Real years stay ascending (oldest → newest). When there are fewer than
 * three years, pad with null on the left so the newest CTOS column sits next to user-input columns.
 */
export function getLatestThreeCtosYearSlots(rows: CtosFinancialYearRowInput[]): (number | null)[] {
  const ys = getLatestThreeCtosYears(rows);
  const out: (number | null)[] = ys.map((y) => y);
  while (out.length < 3) out.unshift(null);
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
