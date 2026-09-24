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
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
  FINANCIAL_FIELD_LABELS,
  type ApplicationComrepDetailKey,
} from "./financial-field-labels";
import {
  parseAdminFieldOverrides,
  readFiniteFinancialNumber,
} from "./financial-field-resolution";
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

export type ApplicationFinancialPrefillFieldSource = "ctos" | "previous_admin" | "previous_user" | "submitted";

export type ApplicationFinancialYearPrefill = {
  year: number;
  source: ApplicationFinancialPrefillSource;
  fields: Record<string, unknown> | null;
  /** Present only for keys copied from a previous resolved record or CTOS. */
  fieldSources?: Record<string, ApplicationFinancialPrefillFieldSource>;
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

export type ResolvedSubmittedFinancialIndex = {
  submittedByYear: Record<string, Record<string, unknown>>;
  adminSupplementsByYear: Record<string, Record<string, unknown>>;
};

/**
 * Newest-first application financial JSON, including Admin supplements saved after submit.
 * Revision snapshots stay immutable. Live non-draft application JSON is the resolved record.
 */
export function indexResolvedApplicationFinancials(
  rows: Array<{ financialStatements: unknown }>
): ResolvedSubmittedFinancialIndex {
  const submittedByYear: Record<string, Record<string, unknown>> = {};
  const adminSupplementsByYear: Record<string, Record<string, unknown>> = {};

  for (const row of rows) {
    const fs = asRecord(row.financialStatements);
    if (!fs) continue;
    const unaudited = asRecord(fs.unaudited_by_year);
    const adminInput = asRecord(fs.admin_input_by_year);
    const overrides = parseAdminFieldOverrides(fs);

    if (unaudited) {
      for (const [yearKey, blockUnknown] of Object.entries(unaudited)) {
        if (!YEAR_KEY_RE.test(yearKey) || submittedByYear[yearKey]) continue;
        const mapped = pickSubmittedApplicationFinancialYearFields(asRecord(blockUnknown));
        const yearOverrides = overrides[yearKey];
        if (yearOverrides) {
          for (const [key, override] of Object.entries(yearOverrides)) {
            if (override.action !== "edit_user_input") continue;
            const value = readFiniteFinancialNumber(override.value);
            if (value == null) continue;
            mapped[key] = value;
          }
        }
        if (!financialYearBlockHasActualData(mapped)) continue;
        submittedByYear[yearKey] = mapped;
      }
    }

    if (adminInput) {
      for (const [yearKey, blockUnknown] of Object.entries(adminInput)) {
        if (!YEAR_KEY_RE.test(yearKey)) continue;
        const mapped = pickSubmittedApplicationFinancialYearFields(asRecord(blockUnknown));
        if (!financialYearBlockHasActualData(mapped)) continue;
        if (!submittedByYear[yearKey]) submittedByYear[yearKey] = mapped;
        if (!adminSupplementsByYear[yearKey]) adminSupplementsByYear[yearKey] = { ...mapped };
      }
    }

    for (const [yearKey, fields] of Object.entries(overrides)) {
      if (!YEAR_KEY_RE.test(yearKey)) continue;
      const gap = adminSupplementsByYear[yearKey] ? { ...adminSupplementsByYear[yearKey] } : {};
      let added = false;
      for (const [key, override] of Object.entries(fields)) {
        if (override.action !== "add_missing_ctos_field") continue;
        if (gap[key] != null) continue;
        const value = readFiniteFinancialNumber(override.value);
        if (value == null) continue;
        gap[key] = value;
        added = true;
      }
      if (added) adminSupplementsByYear[yearKey] = gap;
    }
  }

  return { submittedByYear, adminSupplementsByYear };
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
  /**
   * Admin-supplied raw values from the previous cycle's resolved record.
   * Applied only where CTOS did not provide that key. Issuer extras on a CTOS year stay excluded.
   */
  adminSupplementsByYear?: Record<string, Record<string, unknown>> | null;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialYearPrefill {
  const { year, inProgressYear, ctosFinancials, submittedByYear, adminSupplementsByYear } = params;
  if (inProgressYear != null && year === inProgressYear) {
    return { year, source: "blank", fields: null };
  }
  const supplements = adminSupplementsByYear?.[String(year)] ?? null;
  const ctosRow = findCtosExactYearRow(ctosFinancials, year);
  if (ctosRow) {
    const fromCtos = mapCtosRowToCoreApplicationFields(ctosRow);
    if (fromCtos) {
      const fields = { ...fromCtos };
      const fieldSources: Record<string, ApplicationFinancialPrefillFieldSource> = {};
      for (const key of Object.keys(fromCtos)) fieldSources[key] = "ctos";
      let usedAdminSupplement = false;
      if (supplements) {
        for (const [key, value] of Object.entries(supplements)) {
          if (!isPresentFinancialValue(value)) continue;
          if (isPresentFinancialValue(fields[key])) continue;
          fields[key] = value;
          fieldSources[key] = "previous_admin";
          usedAdminSupplement = true;
        }
      }
      return usedAdminSupplement
        ? { year, source: "ctos", fields, fieldSources }
        : { year, source: "ctos", fields };
    }
    return { year, source: "blank", fields: null };
  }
  const fromSubmitted = resolveLatestSubmittedFinancialsForYear(submittedByYear ?? null, year);
  if (fromSubmitted) {
    const fields = { ...fromSubmitted };
    const fieldSources: Record<string, ApplicationFinancialPrefillFieldSource> = {};
    for (const key of Object.keys(fields)) fieldSources[key] = "submitted";
    let usedAdminSupplement = false;
    if (supplements) {
      for (const [key, value] of Object.entries(supplements)) {
        if (!isPresentFinancialValue(value)) continue;
        fields[key] = value;
        fieldSources[key] = "previous_admin";
        usedAdminSupplement = true;
      }
    }
    return usedAdminSupplement
      ? { year, source: "submitted", fields, fieldSources }
      : { year, source: "submitted", fields };
  }
  if (supplements && financialYearBlockHasActualData(supplements)) {
    const fieldSources: Record<string, ApplicationFinancialPrefillFieldSource> = {};
    for (const key of Object.keys(supplements)) fieldSources[key] = "previous_admin";
    return { year, source: "submitted", fields: supplements, fieldSources };
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
  adminSupplementsByYear?: Record<string, Record<string, unknown>> | null;
  ref?: Date;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialPrefillByYear {
  const { questionnaire, ctosFinancials, submittedByYear, adminSupplementsByYear, ref } = params;
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
      adminSupplementsByYear,
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
