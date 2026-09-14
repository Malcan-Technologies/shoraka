/**
 * New-application financial prefill: completed years from one whole source.
 * CTOS exact FY → core application fields only (Additional Financial Details stay blank).
 * Else newest submitted same-FY revision → core + Additional Financial Details from that block.
 * In-progress year stays blank. Organisation profile JSON is not a prefill fallback.
 *
 * Does not write org master or CTOS storage. Callers copy the returned fields into application form state.
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

export type ApplicationFinancialPrefillSource = "ctos" | "submitted" | "blank";

export type ApplicationFinancialYearPrefill = {
  year: number;
  source: ApplicationFinancialPrefillSource;
  fields: Record<string, unknown> | null;
};

const YEAR_KEY_RE = /^\d{4}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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

/** Same-year submitted block: core application keys plus any present ComRep extras. */
export function pickSubmittedApplicationFinancialYearFields(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out = pickApplicationFinancialPrefillFields(raw);
  if (!raw) return out;
  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
    const value = raw[key];
    if (!isPresentFinancialValue(value)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

/** Same exact-year match as before: `financial_year === year` after CTOS row parse. */
function findCtosExactYearRow(ctosFinancials: unknown, year: number) {
  const rows = parseCtosFinancialStatementRows(ctosFinancials);
  return rows.find((item) => item.financial_year === year) ?? null;
}

function mapCtosRowToCoreApplicationFields(
  row: NonNullable<ReturnType<typeof findCtosExactYearRow>>
): Record<string, unknown> | null {
  const mapped = pickApplicationFinancialPrefillFields(ctosFinancialRowToFsFields(row));
  if (!financialYearBlockHasActualData(mapped)) return null;
  return mapped;
}

/** Prefer `ApplicationRevision.snapshot.application.financial_statements`. */
export function financialStatementsFromRevisionSnapshot(snapshot: unknown): unknown | null {
  const root = asRecord(snapshot);
  if (!root) return null;
  const application = asRecord(root.application);
  if (!application || !("financial_statements" in application)) return null;
  return application.financial_statements ?? null;
}

/**
 * Newest-first submitted revisions → one year block per FY key.
 * A later revision without FY N does not hide an older revision that has FY N.
 */
export function indexLatestSubmittedFinancialsByYear(
  revisions: Array<{ snapshot: unknown }>
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const revision of revisions) {
    const fs = financialStatementsFromRevisionSnapshot(revision.snapshot);
    const byYear = asRecord(asRecord(fs)?.unaudited_by_year);
    if (!byYear) continue;
    for (const [yearKey, blockUnknown] of Object.entries(byYear)) {
      if (!YEAR_KEY_RE.test(yearKey) || out[yearKey]) continue;
      const mapped = pickSubmittedApplicationFinancialYearFields(asRecord(blockUnknown));
      if (!financialYearBlockHasActualData(mapped)) continue;
      out[yearKey] = mapped;
    }
  }
  return out;
}

export function resolveLatestSubmittedFinancialsForYear(
  submittedByYear: Record<string, Record<string, unknown>> | null | undefined,
  year: number
): Record<string, unknown> | null {
  if (!submittedByYear) return null;
  const mapped = submittedByYear[String(year)];
  if (!mapped || !financialYearBlockHasActualData(mapped)) return null;
  return mapped;
}

/**
 * Effective starting values for one application tab year.
 * In-progress year is always blank.
 * Completed years: if CTOS has that exact FY, that CTOS block wins (core only).
 * Submitted history is not consulted for that year — including missing core fields
 * and Additional Financial Details. Else newest submitted same-FY block (core + extras).
 */
export function resolveApplicationFinancialYearPrefill(params: {
  year: number;
  inProgressYear: number | null;
  ctosFinancials: unknown;
  submittedByYear?: Record<string, Record<string, unknown>> | null;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialYearPrefill {
  const { year, inProgressYear, ctosFinancials, submittedByYear } = params;
  if (inProgressYear != null && year === inProgressYear) {
    return { year, source: "blank", fields: null };
  }
  const ctosRow = findCtosExactYearRow(ctosFinancials, year);
  if (ctosRow) {
    const fromCtos = mapCtosRowToCoreApplicationFields(ctosRow);
    if (fromCtos) {
      return { year, source: "ctos", fields: fromCtos };
    }
    return { year, source: "blank", fields: null };
  }
  const fromSubmitted = resolveLatestSubmittedFinancialsForYear(submittedByYear ?? null, year);
  if (fromSubmitted) {
    return { year, source: "submitted", fields: fromSubmitted };
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
  submittedByYear?: Record<string, Record<string, unknown>> | null;
  ref?: Date;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialPrefillByYear {
  const { questionnaire, ctosFinancials, submittedByYear, ref } = params;
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
      submittedByYear,
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
