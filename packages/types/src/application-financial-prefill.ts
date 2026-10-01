/**
 * New-application financial prefill copies the eligible previous FY once.
 * Current / in-progress FY stays blank.
 * Previous FY: raw CTOS for that FY (whole year) → else latest issuer-submitted User Input → else blank.
 * Admin Input, Admin CTOS gap fills, Admin edits of User Input and organisation JSON are never sources.
 *
 * Does not write org master, CTOS storage, or an already-created application.
 */

import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
  FINANCIAL_FIELD_LABELS,
  type ApplicationComrepDetailKey,
} from "./financial-field-labels";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "./financial-field-resolution";
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

/** Same-year submitted block: every present canonical raw key (core, extra issuer raw, ComRep). */
export function pickSubmittedApplicationFinancialYearFields(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw) return out;
  for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
    const value = raw[key];
    if (!isPresentFinancialValue(value)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * CTOS provides these ComRep extras as raw numeric values.
 * We preserve them for CTOS-backed years in the next-application prefill
 * so these fields don't appear blank on issuer screens.
 */
const CTOS_PRESERVED_COMREP_KEYS = [
  "equity_share_premium",
  "equity_accumulated_profit",
  "equity_minority",
  "pl_minority",
] as const;

/** Same exact-year match as before: `financial_year === year` after CTOS row parse. */
function findCtosExactYearRow(ctosFinancials: unknown, year: number) {
  const rows = parseCtosFinancialStatementRows(ctosFinancials);
  return rows.find((item) => item.financial_year === year) ?? null;
}

function mapCtosRowToCoreApplicationFields(
  row: NonNullable<ReturnType<typeof findCtosExactYearRow>>
): Record<string, unknown> | null {
  const fsFields = ctosFinancialRowToFsFields(row);

  const preservedComrep: Record<string, unknown> = {};
  for (const key of CTOS_PRESERVED_COMREP_KEYS) {
    const value = fsFields[key];
    if (!isPresentFinancialValue(value)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    preservedComrep[key] = value;
  }

  const core = pickApplicationFinancialPrefillFields(fsFields);
  const mapped = { ...core, ...preservedComrep };

  // CTOS years may only have these ComRep extras without core line items,
  // but we still must not treat unrelated CTOS totals as “prefillable”.
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
 * One eligible previous FY for a new application.
 * A CTOS row for that exact FY owns the whole year: raw CTOS values only, no Admin gap fills,
 * no field-by-field fallback (a CTOS row without actual amounts → blank).
 * Otherwise the latest issuer-submitted User Input for that FY. Otherwise blank.
 * Never receives Admin Input, CTOS gap fills or `edit_user_input`.
 */
export function resolveNewApplicationHistoricalPrefill(params: {
  year: number;
  ctosFinancials: unknown;
  issuerSubmittedByYear: Record<string, Record<string, unknown>> | null | undefined;
}): ApplicationFinancialYearPrefill {
  const { year } = params;
  const ctosRow = findCtosExactYearRow(params.ctosFinancials, year);
  if (ctosRow) {
    const fields = mapCtosRowToCoreApplicationFields(ctosRow);
    return fields ? { year, source: "ctos", fields } : { year, source: "blank", fields: null };
  }
  const submitted = params.issuerSubmittedByYear?.[String(year)];
  if (submitted && financialYearBlockHasActualData(submitted)) {
    return { year, source: "submitted", fields: { ...submitted } };
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
 * The in-progress (current) FY is always blank and is never passed to the historical resolver.
 * No questionnaire (stale / not yet selected FYE) → no year copies.
 */
export function buildApplicationFinancialPrefillByYear(params: {
  questionnaire: FinancialStatementsQuestionnaire | null;
  ctosFinancials: unknown;
  issuerSubmittedByYear: Record<string, Record<string, unknown>> | null | undefined;
  ref?: Date;
}): ApplicationFinancialPrefillByYear {
  const { questionnaire, ref } = params;
  if (!questionnaire) {
    return { tabYears: [], inProgressYear: null, years: {} };
  }
  const tabYears = getIssuerFinancialTabYears(questionnaire, ref ?? new Date());
  const inProgressYear = getInProgressFinancialYearEndYear(questionnaire);
  const years: Record<string, ApplicationFinancialYearPrefill> = {};
  for (const year of tabYears) {
    years[String(year)] =
      inProgressYear != null && year === inProgressYear
        ? { year, source: "blank", fields: null }
        : resolveNewApplicationHistoricalPrefill({
            year,
            ctosFinancials: params.ctosFinancials,
            issuerSubmittedByYear: params.issuerSubmittedByYear,
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
  // Canonical extra issuer raw keys are persisted with 0 when missing so downstream
  // comparisons and stored-history rendering can rely on the presence of keys.
  for (const key of APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS) {
    out[key] = toStoredFinancialNumber(raw[key]);
  }
  for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
    if (!isPresentFinancialValue(raw[key])) continue;
    out[key] = toStoredFinancialNumber(raw[key]);
  }
  return out;
}
