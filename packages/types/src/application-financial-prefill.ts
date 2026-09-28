/**
 * New-application financial prefill copies completed years once.
 * Current / in-progress FY stays blank.
 * Each previous FY uses one source, then only the supplements that belong to that source:
 * CTOS + explicit CTOS gap fills → else Admin Input → else User Input + Admin edits of that User Input → else blank.
 * Organisation profile JSON is not a source and is not a field-level fallback.
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
  /** Newest User Input year block, with `edit_user_input` applied on that same block. */
  submittedByYear: Record<string, Record<string, unknown>>;
  /** Keys on `submittedByYear` that came from `edit_user_input`, not the issuer snapshot. */
  userEditedKeysByYear: Record<string, string[]>;
  /** Newest active Admin Input year block, including `edit_admin_input` on that block. */
  adminInputByYear: Record<string, Record<string, unknown>>;
  /** Explicit `add_missing_ctos_field` values only. Never a whole Admin Input or User Input block. */
  ctosGapFillsByYear: Record<string, Record<string, unknown>>;
  /** Alias of `ctosGapFillsByYear` for callers that still pass CTOS supplements under the old name. */
  adminSupplementsByYear: Record<string, Record<string, unknown>>;
};

/**
 * Newest-first application financial JSON.
 * Each FY is one whole block from the newest row that contains that lane.
 * Missing keys are not filled from an older row.
 * Revision snapshots stay immutable. Live non-draft application JSON carries Admin edits.
 */
export function indexResolvedApplicationFinancials(
  rows: Array<{ financialStatements: unknown }>
): ResolvedSubmittedFinancialIndex {
  const submittedByYear: Record<string, Record<string, unknown>> = {};
  const userEditedKeysByYear: Record<string, string[]> = {};
  const adminInputByYear: Record<string, Record<string, unknown>> = {};
  const ctosGapFillsByYear: Record<string, Record<string, unknown>> = {};

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
        const edited: string[] = [];
        const yearOverrides = overrides[yearKey];
        if (yearOverrides) {
          for (const [key, override] of Object.entries(yearOverrides)) {
            if (override.action !== "edit_user_input") continue;
            const value = readFiniteFinancialNumber(override.value);
            if (value == null) continue;
            mapped[key] = value;
            edited.push(key);
          }
        }
        if (!financialYearBlockHasActualData(mapped)) continue;
        submittedByYear[yearKey] = mapped;
        if (edited.length > 0) userEditedKeysByYear[yearKey] = edited;
      }
    }

    if (adminInput) {
      for (const [yearKey, blockUnknown] of Object.entries(adminInput)) {
        if (!YEAR_KEY_RE.test(yearKey) || adminInputByYear[yearKey]) continue;
        const mapped = pickSubmittedApplicationFinancialYearFields(asRecord(blockUnknown));
        const yearOverrides = overrides[yearKey];
        if (yearOverrides) {
          for (const [key, override] of Object.entries(yearOverrides)) {
            if (override.action !== "edit_admin_input") continue;
            const value = readFiniteFinancialNumber(override.value);
            if (value == null) continue;
            mapped[key] = value;
          }
        }
        if (!financialYearBlockHasActualData(mapped)) continue;
        adminInputByYear[yearKey] = mapped;
      }
    }

    for (const [yearKey, fields] of Object.entries(overrides)) {
      if (!YEAR_KEY_RE.test(yearKey)) continue;
      const gap = ctosGapFillsByYear[yearKey] ? { ...ctosGapFillsByYear[yearKey] } : {};
      let added = false;
      for (const [key, override] of Object.entries(fields)) {
        if (override.action !== "add_missing_ctos_field") continue;
        if (gap[key] != null) continue;
        const value = readFiniteFinancialNumber(override.value);
        if (value == null) continue;
        gap[key] = value;
        added = true;
      }
      if (added) ctosGapFillsByYear[yearKey] = gap;
    }
  }

  return {
    submittedByYear,
    userEditedKeysByYear,
    adminInputByYear,
    ctosGapFillsByYear,
    adminSupplementsByYear: ctosGapFillsByYear,
  };
}

export type HistoricalFinancialYearSource = "ctos" | "admin_input" | "user_input";

export type HistoricalFinancialYearResolution = {
  source: HistoricalFinancialYearSource;
  fields: Record<string, unknown>;
  fieldSources: Record<string, ApplicationFinancialPrefillFieldSource>;
};

/**
 * One previous FY. Source is chosen for the year, then only that source's supplements apply.
 * `orgFinancialStatements` is accepted and ignored so callers cannot use it as a fallback.
 */
export function resolveHistoricalFinancialYearFields(params: {
  year: number;
  ctosFinancials: unknown;
  userByYear?: Record<string, Record<string, unknown>> | null;
  adminInputByYear?: Record<string, Record<string, unknown>> | null;
  ctosGapFillsByYear?: Record<string, Record<string, unknown>> | null;
  userEditedKeysByYear?: Record<string, string[]> | null;
  orgFinancialStatements?: unknown;
}): HistoricalFinancialYearResolution | null {
  void params.orgFinancialStatements;
  const yearKey = String(params.year);
  const ctosRow = findCtosExactYearRow(params.ctosFinancials, params.year);
  if (ctosRow) {
    const fromCtos = mapCtosRowToCoreApplicationFields(ctosRow) ?? {};
    const fields = { ...fromCtos };
    const fieldSources: Record<string, ApplicationFinancialPrefillFieldSource> = {};
    for (const key of Object.keys(fromCtos)) fieldSources[key] = "ctos";
    const gaps = params.ctosGapFillsByYear?.[yearKey];
    if (gaps) {
      for (const [key, value] of Object.entries(gaps)) {
        if (!isPresentFinancialValue(value)) continue;
        if (isPresentFinancialValue(fields[key])) continue;
        fields[key] = value;
        fieldSources[key] = "previous_admin";
      }
    }
    if (!financialYearBlockHasActualData(fields)) return null;
    return { source: "ctos", fields, fieldSources };
  }

  const admin = params.adminInputByYear?.[yearKey];
  if (admin && financialYearBlockHasActualData(admin)) {
    const fields = { ...admin };
    const fieldSources: Record<string, ApplicationFinancialPrefillFieldSource> = {};
    for (const key of Object.keys(fields)) fieldSources[key] = "previous_admin";
    return { source: "admin_input", fields, fieldSources };
  }

  const user = params.userByYear?.[yearKey];
  if (user && financialYearBlockHasActualData(user)) {
    const fields = { ...user };
    const edited = new Set(params.userEditedKeysByYear?.[yearKey] ?? []);
    const fieldSources: Record<string, ApplicationFinancialPrefillFieldSource> = {};
    for (const key of Object.keys(fields)) {
      fieldSources[key] = edited.has(key) ? "previous_admin" : "submitted";
    }
    return { source: "user_input", fields, fieldSources };
  }

  return null;
}

/** Profile history for every FY. Same source order as historical prefill, including the latest submitted FY. */
export function effectiveFinancialHistoryEntries(params: {
  ctosFinancials: unknown;
  userByYear?: Record<string, Record<string, unknown>> | null;
  adminInputByYear?: Record<string, Record<string, unknown>> | null;
  ctosGapFillsByYear?: Record<string, Record<string, unknown>> | null;
  userEditedKeysByYear?: Record<string, string[]> | null;
  orgFinancialStatements?: unknown;
}): Array<{ year: string; block: Record<string, unknown> }> {
  const years = new Set<number>();
  for (const row of parseCtosFinancialStatementRows(params.ctosFinancials)) {
    if (row.financial_year != null && Number.isFinite(row.financial_year)) {
      years.add(row.financial_year);
    }
  }
  for (const map of [params.userByYear, params.adminInputByYear]) {
    if (!map) continue;
    for (const key of Object.keys(map)) {
      if (YEAR_KEY_RE.test(key)) years.add(Number(key));
    }
  }
  const entries: Array<{ year: string; block: Record<string, unknown> }> = [];
  for (const year of years) {
    const resolved = resolveHistoricalFinancialYearFields({
      year,
      ctosFinancials: params.ctosFinancials,
      userByYear: params.userByYear,
      adminInputByYear: params.adminInputByYear,
      ctosGapFillsByYear: params.ctosGapFillsByYear,
      userEditedKeysByYear: params.userEditedKeysByYear,
      orgFinancialStatements: params.orgFinancialStatements,
    });
    if (!resolved) continue;
    entries.push({ year: String(year), block: resolved.fields });
  }
  entries.sort((a, b) => Number(b.year) - Number(a.year));
  return entries;
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

function prefillFromHistorical(
  year: number,
  resolved: HistoricalFinancialYearResolution | null
): ApplicationFinancialYearPrefill {
  if (!resolved) return { year, source: "blank", fields: null };
  const source: ApplicationFinancialPrefillSource = resolved.source === "ctos" ? "ctos" : "submitted";
  const usedAdmin = Object.values(resolved.fieldSources).includes("previous_admin");
  return usedAdmin
    ? { year, source, fields: resolved.fields, fieldSources: resolved.fieldSources }
    : { year, source, fields: resolved.fields };
}

/**
 * Effective starting values for one application tab year.
 * In-progress year is always blank, even when history already has that FY.
 * Previous years: CTOS + CTOS gap fills, else Admin Input, else reviewed User Input, else blank.
 */
export function resolveApplicationFinancialYearPrefill(params: {
  year: number;
  inProgressYear: number | null;
  ctosFinancials: unknown;
  submittedByYear?: Record<string, Record<string, unknown>> | null;
  adminInputByYear?: Record<string, Record<string, unknown>> | null;
  ctosGapFillsByYear?: Record<string, Record<string, unknown>> | null;
  userEditedKeysByYear?: Record<string, string[]> | null;
  /**
   * Treated as CTOS gap fills when `ctosGapFillsByYear` is omitted.
   * Not applied onto Admin Input or User Input, and not used as a whole-year source.
   */
  adminSupplementsByYear?: Record<string, Record<string, unknown>> | null;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialYearPrefill {
  const { year, inProgressYear } = params;
  if (inProgressYear != null && year === inProgressYear) {
    return { year, source: "blank", fields: null };
  }
  return prefillFromHistorical(
    year,
    resolveHistoricalFinancialYearFields({
      year,
      ctosFinancials: params.ctosFinancials,
      userByYear: params.submittedByYear,
      adminInputByYear: params.adminInputByYear,
      ctosGapFillsByYear: params.ctosGapFillsByYear ?? params.adminSupplementsByYear,
      userEditedKeysByYear: params.userEditedKeysByYear,
      orgFinancialStatements: params.orgFinancialStatements,
    })
  );
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
  adminInputByYear?: Record<string, Record<string, unknown>> | null;
  ctosGapFillsByYear?: Record<string, Record<string, unknown>> | null;
  userEditedKeysByYear?: Record<string, string[]> | null;
  adminSupplementsByYear?: Record<string, Record<string, unknown>> | null;
  ref?: Date;
  /** Ignored. Organisation profile is not an application prefill source. */
  orgFinancialStatements?: unknown;
}): ApplicationFinancialPrefillByYear {
  const { questionnaire, ref } = params;
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
      ctosFinancials: params.ctosFinancials,
      submittedByYear: params.submittedByYear,
      adminInputByYear: params.adminInputByYear,
      ctosGapFillsByYear: params.ctosGapFillsByYear,
      userEditedKeysByYear: params.userEditedKeysByYear,
      adminSupplementsByYear: params.adminSupplementsByYear,
      orgFinancialStatements: params.orgFinancialStatements,
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
