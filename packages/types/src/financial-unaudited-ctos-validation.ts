/**
 * Issuer financial questionnaire helpers (FYE-based tab years), CTOS financial year lists.
 */

import { addDays, addMonths, format, startOfDay, subYears } from "date-fns";
import { mytCalendarParts } from "./deadline-config";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local midnight of the Asia/Kuala_Lumpur civil day for `ref` — the business “today”. */
function malaysiaCivilDay(ref: Date): Date {
  const { year, month, day } = mytCalendarParts(ref);
  return new Date(year, month - 1, day);
}

/** Stored under `financial_statements.questionnaire` (v2). */
export type FinancialStatementsQuestionnaire = {
  financial_year_end: string;
};

export type FinancialYearEndValidationError = "invalid" | "not_future" | "beyond_window";

/** Shared issuer/API copy for FYE picker and schema errors. */
export const FINANCIAL_YEAR_END_ERROR_MESSAGES: Record<FinancialYearEndValidationError, string> = {
  invalid: "Enter a valid date",
  not_future: "Please select a future financial year end date.",
  beyond_window: "Financial year end must be within the next 12 months.",
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
 * Valid iff today < FYE and periodStart(FYE) <= today (period already started).
 * Equivalent: today < FYE < today + 12 months.
 * `today` is the Malaysia civil day of `ref`, not the process timezone.
 */
export function getFinancialYearEndValidationError(
  iso: string,
  ref: Date = new Date()
): FinancialYearEndValidationError | null {
  const chosen = parseIsoDateOnlyLocal(iso);
  if (!chosen) return "invalid";
  const today = malaysiaCivilDay(ref);
  const fye = startOfDay(chosen);
  if (fye.getTime() <= today.getTime()) return "not_future";
  const periodStart = startOfDay(addDays(subYears(chosen, 1), 1));
  if (periodStart.getTime() > today.getTime()) return "beyond_window";
  return null;
}

export function isFinancialYearEndWithinAllowedWindow(iso: string, ref: Date = new Date()): boolean {
  return getFinancialYearEndValidationError(iso, ref) === null;
}

/**
 * Inclusive calendar bounds for the next-FYE picker.
 * min = tomorrow; max = last ISO day accepted by `getFinancialYearEndValidationError` (includes leap days
 * that `addYears` would clip, e.g. ref 2027-03-01 → max 2028-02-29).
 */
export function getFinancialYearEndAllowedWindow(ref: Date = new Date()): { minIso: string; maxIso: string } {
  const today = malaysiaCivilDay(ref);
  const min = addDays(today, 1);
  const minIso = format(min, "yyyy-MM-dd");
  let candidate = addDays(today, 366);
  while (candidate.getTime() >= min.getTime()) {
    const iso = format(candidate, "yyyy-MM-dd");
    if (getFinancialYearEndValidationError(iso, ref) === null) {
      return { minIso, maxIso: iso };
    }
    candidate = addDays(candidate, -1);
  }
  return { minIso, maxIso: minIso };
}

/**
 * True when the ISO calendar day is strictly after `ref`'s calendar day (local).
 * Routes through the window helper; `beyond_window` dates remain “after today”.
 */
export function isFinancialYearEndStrictlyAfterRef(iso: string, ref: Date = new Date()): boolean {
  const err = getFinancialYearEndValidationError(iso, ref);
  return err === null || err === "beyond_window";
}

/**
 * Shape/ISO-validity only — no today-relative rule. For admin, prospectus, and org history reads.
 */
export function parseFinancialStatementsQuestionnaireShape(
  raw: unknown
): FinancialStatementsQuestionnaire | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const financial_year_end = o.financial_year_end;
  if (typeof financial_year_end !== "string") return null;
  if (!ISO_DATE.test(financial_year_end.trim())) return null;
  if (parseIsoDateOnlyLocal(financial_year_end) == null) return null;
  return { financial_year_end: financial_year_end.trim() };
}

/**
 * Parse stored questionnaire JSON. `financial_year_end` must be a valid ISO date within the next-12-month window.
 */
export function normalizeFinancialStatementsQuestionnaire(
  raw: unknown,
  ref: Date = new Date()
): FinancialStatementsQuestionnaire | null {
  const parsed = parseFinancialStatementsQuestionnaireShape(raw);
  if (!parsed) return null;
  if (getFinancialYearEndValidationError(parsed.financial_year_end, ref) !== null) return null;
  return parsed;
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

/** True when the period has started and the books have not closed (`periodStart <= ref < periodEnd`). */
export function isFinancialYearPeriodOpen(
  questionnaire: FinancialStatementsQuestionnaire,
  fyEndYear: number,
  ref: Date = new Date()
): boolean {
  const startIso = getFinancialYearPeriodStartIso(questionnaire, fyEndYear);
  const endIso = getFinancialYearPeriodEndIso(questionnaire, fyEndYear);
  const start = startIso ? parseIsoDateOnlyLocal(startIso) : null;
  const end = endIso ? parseIsoDateOnlyLocal(endIso) : null;
  if (!start || !end) return false;
  const today = malaysiaCivilDay(ref).getTime();
  return startOfDay(start).getTime() <= today && today < startOfDay(end).getTime();
}

/** Display line e.g. "1 Apr 2025 – 31 Mar 2026". Pass `clampEndTo` to cap an open year at today. */
export function formatFinancialFyPeriodDisplay(
  questionnaire: FinancialStatementsQuestionnaire,
  fyEndYear: number,
  options?: { clampEndTo?: Date }
): string {
  const startIso = getFinancialYearPeriodStartIso(questionnaire, fyEndYear);
  const endIso = getFinancialYearPeriodEndIso(questionnaire, fyEndYear);
  if (!startIso || !endIso) return "";
  const s = parseIsoDateOnlyLocal(startIso);
  const e = parseIsoDateOnlyLocal(endIso);
  if (!s || !e) return "";
  let displayEnd = e;
  if (options?.clampEndTo && isFinancialYearPeriodOpen(questionnaire, fyEndYear, options.clampEndTo)) {
    displayEnd = malaysiaCivilDay(options.clampEndTo);
  }
  return `${format(s, "d MMM yyyy")} – ${format(displayEnd, "d MMM yyyy")}`;
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
 * Assumes `questionnaire.financial_year_end` is already within the allowed FYE window.
 */
export function getIssuerFinancialTabYears(
  questionnaire: FinancialStatementsQuestionnaire,
  ref: Date = new Date()
): number[] {
  const currentFYEnd = parseIsoDateOnlyLocal(questionnaire.financial_year_end);
  if (!currentFYEnd) return [];
  const previousFYEnd = subYears(currentFYEnd, 1);
  const deadline = addMonths(previousFYEnd, 6);
  const today = malaysiaCivilDay(ref);
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
 * Calendar year of the selected next FYE — the in-progress (not yet ended) financial year.
 * Independent of whether the UI shows one tab or two.
 */
export function getInProgressFinancialYearEndYear(
  questionnaire: FinancialStatementsQuestionnaire
): number | null {
  const currentFYEnd = parseIsoDateOnlyLocal(questionnaire.financial_year_end);
  if (!currentFYEnd) return null;
  return currentFYEnd.getFullYear();
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
    todayIso: format(malaysiaCivilDay(ref), "yyyy-MM-dd"),
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
