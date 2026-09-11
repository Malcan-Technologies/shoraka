/**
 * New-application financial prefill: CTOS for completed years; in-progress year stays blank.
 *
 * Does not write org master or CTOS storage. Callers copy the returned fields into application form state.
 * Organisation profile JSON is not a prefill fallback.
 */

import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  FINANCIAL_FIELD_LABELS,
  type ApplicationComrepDetailKey,
} from "./financial-field-labels";
import {
  ctosFinancialRowToFsFields,
  financialYearBlockHasActualData,
  parseCtosFinancialStatementRows,
} from "./financial-statement-year-resolution";
import {
  getInProgressFinancialYearEndYear,
  getIssuerFinancialTabYears,
  type FinancialStatementsQuestionnaire,
} from "./financial-unaudited-ctos-validation";

/** Exact issuer application money keys (CTOS-overlapping). Do not add ComRep-only splits. */
export const APPLICATION_FINANCIAL_PREFILL_KEYS = APPLICATION_CORE_MONEY_KEYS;

export type ApplicationFinancialPrefillKey = (typeof APPLICATION_FINANCIAL_PREFILL_KEYS)[number];

export type ApplicationFinancialPrefillSource = "ctos" | "blank";

export type ApplicationFinancialYearPrefill = {
  year: number;
  source: ApplicationFinancialPrefillSource;
  fields: Record<string, unknown> | null;
};

export function isPresentFinancialValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

export function toStoredFinancialNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function pickApplicationFinancialPrefillFields(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const key of APPLICATION_FINANCIAL_PREFILL_KEYS) {
    const value = raw[key];
    if (!isPresentFinancialValue(value)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

function ctosYearApplicationFields(ctosFinancials: unknown, year: number): Record<string, unknown> | null {
  const rows = parseCtosFinancialStatementRows(ctosFinancials);
  const row = rows.find((item) => item.financial_year === year);
  if (!row) return null;
  const mapped = pickApplicationFinancialPrefillFields(ctosFinancialRowToFsFields(row));
  if (!financialYearBlockHasActualData(mapped)) return null;
  return mapped;
}

/**
 * Effective starting values for one application tab year.
 * In-progress year is always blank. Completed years: CTOS application fields only.
 */
export function resolveApplicationFinancialYearPrefill(params: {
  year: number;
  inProgressYear: number | null;
  ctosFinancials: unknown;
  /** Ignored. Kept so callers can stop passing org JSON without a signature scramble. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialYearPrefill {
  const { year, inProgressYear, ctosFinancials } = params;
  if (inProgressYear != null && year === inProgressYear) {
    return { year, source: "blank", fields: null };
  }
  const fromCtos = ctosYearApplicationFields(ctosFinancials, year);
  if (fromCtos) {
    return { year, source: "ctos", fields: fromCtos };
  }
  return { year, source: "blank", fields: null };
}

export type ApplicationFinancialPrefillByYear = {
  tabYears: number[];
  inProgressYear: number | null;
  years: Record<string, ApplicationFinancialYearPrefill>;
};

/**
 * Prefill map for the issuer financial step.
 * No questionnaire (stale / not yet selected FYE) → no year copies.
 */
export function buildApplicationFinancialPrefillByYear(params: {
  questionnaire: FinancialStatementsQuestionnaire | null;
  ctosFinancials: unknown;
  ref?: Date;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialPrefillByYear {
  const { questionnaire, ctosFinancials, ref } = params;
  if (!questionnaire) {
    return { tabYears: [], inProgressYear: null, years: {} };
  }
  const tabYears = getIssuerFinancialTabYears(questionnaire, ref ?? new Date());
  const inProgressYear = getInProgressFinancialYearEndYear(questionnaire);
  const years: Record<string, ApplicationFinancialYearPrefill> = {};
  for (const year of tabYears) {
    years[String(year)] = resolveApplicationFinancialYearPrefill({
      year,
      inProgressYear,
      ctosFinancials,
    });
  }
  return { tabYears, inProgressYear, years };
}

export function applicationComrepFieldError(
  key: ApplicationComrepDetailKey | string,
  raw: unknown
): string | null {
  if (!isPresentFinancialValue(raw)) return null;
  const n = toStoredFinancialNumber(raw);
  if (!Number.isFinite(n)) return "Enter a valid amount";
  const allowedNegative = (APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS as readonly string[]).includes(
    key
  );
  if (!allowedNegative && n < 0) {
    const label = FINANCIAL_FIELD_LABELS[key] ?? key;
    return `${label} must be 0 or greater`;
  }
  return null;
}

/** Persist core money keys plus any present ComRep extras. Does not invent missing ComRep values. */
export function buildStoredApplicationFinancialYearBlock(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    pldd: String(raw.pldd ?? ""),
  };
  for (const key of APPLICATION_CORE_MONEY_KEYS) {
    out[key] = toStoredFinancialNumber(raw[key]);
  }
  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
    if (!isPresentFinancialValue(raw[key])) continue;
    out[key] = toStoredFinancialNumber(raw[key]);
  }
  return out;
}
