/**
 * Field-level financial provenance on top of one primary source per FY.
 * Formulas stay in ctos-report-table-math.ts. This module only resolves values and edit rights.
 */

import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
} from "./financial-field-labels";
import {
  ctosFinancialRowToFsFields,
  financialYearBlockHasActualData,
  getEligibleAdminInputYears,
  parseCtosFinancialStatementRows,
  type FinancialStatementRecordSource,
  type FinancialStatementStatementType,
} from "./financial-statement-year-resolution";
import {
  getLatestThreeCtosYears,
} from "./financial-unaudited-ctos-validation";

export const ADMIN_EDITABLE_RAW_FINANCIAL_KEYS = [
  ...APPLICATION_CORE_MONEY_KEYS,
  ...APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
  ...APPLICATION_COMREP_DETAIL_KEYS,
] as const;

export type AdminEditableRawFinancialKey = (typeof ADMIN_EDITABLE_RAW_FINANCIAL_KEYS)[number];

/** Finished metrics. Admin must not type these. */
export const CALCULATED_FINANCIAL_METRIC_KEYS = [
  "totass",
  "totlib",
  "networth",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "return_of_equity",
  "currat",
  "workcap",
  "gear",
  "roa",
  "assetTurnover",
  "ebit",
  "quickRatio",
  "interestCoverage",
  "receivablesDays",
  "payablesDays",
  "dscr",
  "netDebtEquity",
] as const;

const RAW_KEY_SET = new Set<string>(ADMIN_EDITABLE_RAW_FINANCIAL_KEYS);
const CALCULATED_KEY_SET = new Set<string>(CALCULATED_FINANCIAL_METRIC_KEYS);

export type FinancialFieldProvenance = "ctos" | "user_input" | "admin_input";

export type AdminFieldOverrideAction =
  | "add_missing_ctos_field"
  | "edit_user_input"
  | "edit_admin_input"
  | "add_missing_fy";

export type AdminFieldOverride = {
  value: number | string | null;
  baseSource: FinancialFieldProvenance;
  action: AdminFieldOverrideAction;
  updated_by_user_id: string;
  updated_at: string;
};

export type ResolvedRawFinancialField = {
  value: number | null;
  source: FinancialFieldProvenance;
  editedByAdmin: boolean;
  readOnly: boolean;
  unavailableReason?: "not_provided_by_ctos" | "not_provided";
};

export type AdminFinancialReviewPrimarySource = "ctos" | "user_input" | "admin_input" | "add_year";

export type AdminFinancialReviewColumn = {
  kind: "ctos" | "unaudited" | "admin_input" | "admin_fallback_placeholder";
  year: number;
  statementType?: FinancialStatementStatementType;
  primarySource: AdminFinancialReviewPrimarySource;
  recordSource: FinancialStatementRecordSource | null;
  fields: Record<string, ResolvedRawFinancialField>;
};

export function isAdminEditableRawFinancialKey(key: string): boolean {
  return RAW_KEY_SET.has(key);
}

export function isCalculatedFinancialMetricKey(key: string): boolean {
  return CALCULATED_KEY_SET.has(key);
}

export function readFiniteFinancialNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseAdminFieldOverrides(
  financialStatements: unknown
): Record<string, Record<string, AdminFieldOverride>> {
  const root = asRecord(financialStatements);
  const byYear = asRecord(root?.admin_field_overrides);
  if (!byYear) return {};
  const out: Record<string, Record<string, AdminFieldOverride>> = {};
  for (const [year, yearValue] of Object.entries(byYear)) {
    const fields = asRecord(yearValue);
    if (!fields) continue;
    const parsed: Record<string, AdminFieldOverride> = {};
    for (const [fieldKey, raw] of Object.entries(fields)) {
      const rec = asRecord(raw);
      if (!rec) continue;
      const action = rec.action;
      const baseSource = rec.baseSource;
      if (
        action !== "add_missing_ctos_field" &&
        action !== "edit_user_input" &&
        action !== "edit_admin_input" &&
        action !== "add_missing_fy"
      ) {
        continue;
      }
      if (baseSource !== "ctos" && baseSource !== "user_input" && baseSource !== "admin_input") {
        continue;
      }
      parsed[fieldKey] = {
        value: (rec.value as number | string | null) ?? null,
        baseSource,
        action,
        updated_by_user_id: typeof rec.updated_by_user_id === "string" ? rec.updated_by_user_id : "",
        updated_at: typeof rec.updated_at === "string" ? rec.updated_at : "",
      };
    }
    if (Object.keys(parsed).length > 0) out[year] = parsed;
  }
  return out;
}

export function financialFieldSourceBadge(field: ResolvedRawFinancialField): string {
  if (field.editedByAdmin && field.source === "user_input") return "User Input · Edited by Admin";
  if (field.source === "ctos") return "CTOS";
  if (field.source === "user_input") return "User Input";
  return "Admin Input";
}

function resolveRawField(params: {
  primary: Exclude<AdminFinancialReviewPrimarySource, "add_year">;
  key: string;
  ctosRaw: Record<string, unknown> | null;
  issuerRaw: Record<string, unknown> | null;
  adminRaw: Record<string, unknown> | null;
  override: AdminFieldOverride | undefined;
}): ResolvedRawFinancialField {
  const ctosValue = params.ctosRaw ? readFiniteFinancialNumber(params.ctosRaw[params.key]) : null;
  const issuerValue = params.issuerRaw ? readFiniteFinancialNumber(params.issuerRaw[params.key]) : null;
  const adminValue = params.adminRaw ? readFiniteFinancialNumber(params.adminRaw[params.key]) : null;
  const overrideValue =
    params.override != null ? readFiniteFinancialNumber(params.override.value) : null;

  if (params.primary === "ctos") {
    if (ctosValue != null) {
      return { value: ctosValue, source: "ctos", editedByAdmin: false, readOnly: true };
    }
    if (params.override?.action === "add_missing_ctos_field" && overrideValue != null) {
      return { value: overrideValue, source: "admin_input", editedByAdmin: true, readOnly: false };
    }
    return {
      value: null,
      source: "ctos",
      editedByAdmin: false,
      readOnly: false,
      unavailableReason: "not_provided_by_ctos",
    };
  }

  if (params.primary === "user_input") {
    if (params.override?.action === "edit_user_input" && overrideValue != null) {
      return { value: overrideValue, source: "user_input", editedByAdmin: true, readOnly: false };
    }
    if (issuerValue != null) {
      return { value: issuerValue, source: "user_input", editedByAdmin: false, readOnly: false };
    }
    return {
      value: null,
      source: "user_input",
      editedByAdmin: false,
      readOnly: false,
      unavailableReason: "not_provided",
    };
  }

  const adminResolved =
    params.override?.action === "edit_admin_input" && overrideValue != null ? overrideValue : adminValue;
  if (adminResolved != null) {
    return { value: adminResolved, source: "admin_input", editedByAdmin: false, readOnly: false };
  }
  return {
    value: null,
    source: "admin_input",
    editedByAdmin: false,
    readOnly: false,
    unavailableReason: "not_provided",
  };
}

function yearFields(params: {
  primary: Exclude<AdminFinancialReviewPrimarySource, "add_year">;
  ctosRaw: Record<string, unknown> | null;
  issuerRaw: Record<string, unknown> | null;
  adminRaw: Record<string, unknown> | null;
  overrides: Record<string, AdminFieldOverride> | undefined;
}): Record<string, ResolvedRawFinancialField> {
  const fields: Record<string, ResolvedRawFinancialField> = {};
  for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
    fields[key] = resolveRawField({
      primary: params.primary,
      key,
      ctosRaw: params.ctosRaw,
      issuerRaw: params.issuerRaw,
      adminRaw: params.adminRaw,
      override: params.overrides?.[key],
    });
  }
  return fields;
}

function statementTypeOf(raw: Record<string, unknown> | null): FinancialStatementStatementType | undefined {
  const value = raw?.statementType;
  if (value === "AUDITED" || value === "NOT_AUDITED" || value === "MANAGEMENT_ACCOUNTS") return value;
  return undefined;
}

/**
 * Chronological Admin review columns. One column per FY. CTOS wins a duplicate year.
 * Missing window years stay in calendar position as add-year placeholders.
 */
export function resolveAdminFinancialReviewColumns(input: {
  financialStatements?: unknown;
  ctosFinancials?: unknown;
  ref?: Date;
  eligibleAdminInputYears?: number[];
}): AdminFinancialReviewColumn[] {
  const root = asRecord(input.financialStatements);
  const unauditedByYear = asRecord(root?.unaudited_by_year) ?? {};
  const adminInputByYear = asRecord(root?.admin_input_by_year) ?? {};
  const overrides = parseAdminFieldOverrides(input.financialStatements);
  const ctosRows = parseCtosFinancialStatementRows(input.ctosFinancials);
  const ctosByYear = new Map<number, Record<string, unknown>>();
  for (const row of ctosRows) {
    if (row.financial_year == null || !Number.isFinite(row.financial_year)) continue;
    ctosByYear.set(row.financial_year, ctosFinancialRowToFsFields(row));
  }

  const eligible =
    input.eligibleAdminInputYears ??
    getEligibleAdminInputYears({
      financialStatements: input.financialStatements,
      ctosFinancials: input.ctosFinancials,
      ref: input.ref,
    });
  const eligibleSet = new Set<number>(eligible);

  const issuerYears = Object.keys(unauditedByYear)
    .map((key) => Number(key))
    .filter((year) => Number.isInteger(year))
    .filter((year) => {
      const block = asRecord(unauditedByYear[String(year)]);
      return block != null && financialYearBlockHasActualData(block);
    })
    .sort((a, b) => a - b);

  const issuerYearSet = new Set<number>(issuerYears);

  const adminYearsAny = Object.keys(adminInputByYear)
    .map((key) => Number(key))
    .filter((year) => Number.isInteger(year))
    .filter((year) => {
      const block = asRecord(adminInputByYear[String(year)]);
      return block != null && financialYearBlockHasActualData(block);
    })
    .sort((a, b) => a - b);
  const adminYearSetAny = new Set<number>(adminYearsAny);

  // Preserve existing rule: if issuer (user) already has actual data for a FY, we do not show a second admin_input column for the same FY.
  const adminYears = adminYearsAny.filter((y) => !issuerYearSet.has(y));

  // CTOS history window: always 3 consecutive FY slots ending at the latest CTOS FY present in the data.
  const ctosYearsPresent = [...ctosByYear.keys()].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
  const latestCtosYear = ctosYearsPresent.length > 0 ? ctosYearsPresent[ctosYearsPresent.length - 1] : null;
  const ctosWindowYears = latestCtosYear != null ? [latestCtosYear - 2, latestCtosYear - 1, latestCtosYear] : [];

  const columns: AdminFinancialReviewColumn[] = [];
  const placeholderRenderedYears = new Set<number>();

  const addCtosColumn = (year: number, ctosRaw: Record<string, unknown> | null) => {
    columns.push({
      kind: "ctos",
      year,
      primarySource: "ctos",
      recordSource: "ctos_audited",
      fields: yearFields({
        primary: "ctos",
        ctosRaw,
        issuerRaw: asRecord(unauditedByYear[String(year)]),
        adminRaw: null,
        overrides: overrides[String(year)],
      }),
    });
  };

  const addPlaceholderColumn = (year: number) => {
    columns.push({
      kind: "admin_fallback_placeholder",
      year,
      primarySource: "add_year",
      recordSource: null,
      fields: {},
    });
    placeholderRenderedYears.add(year);
  };

  // CTOS-side 3 chronological slots (with missing CTOS years optionally turning into Add Financial Statement placeholders).
  for (const year of ctosWindowYears) {
    if (ctosByYear.has(year)) {
      addCtosColumn(year, ctosByYear.get(year) ?? null);
      continue;
    }

    const canAddMissingCtosWindowYear =
      eligibleSet.has(year) && !issuerYearSet.has(year) && !adminYearSetAny.has(year);

    // If eligible, show the Add Financial Statement action in the CTOS-history window.
    if (canAddMissingCtosWindowYear) {
      addPlaceholderColumn(year);
    } else {
      // Otherwise keep the missing CTOS slot as a CTOS column with no CTOS values.
      addCtosColumn(year, null);
    }
  }

  // User/Admin submitted financial years (do not suppress CTOS years; same FY may appear twice intentionally).
  for (const year of issuerYears) {
    columns.push({
      kind: "unaudited",
      year,
      primarySource: "user_input",
      recordSource: "unaudited_management",
      fields: yearFields({
        primary: "user_input",
        ctosRaw: null,
        issuerRaw: asRecord(unauditedByYear[String(year)]),
        adminRaw: null,
        overrides: overrides[String(year)],
      }),
    });
  }

  for (const year of adminYears) {
    const adminRaw = asRecord(adminInputByYear[String(year)]);
    columns.push({
      kind: "admin_input",
      year,
      statementType: statementTypeOf(adminRaw),
      primarySource: "admin_input",
      recordSource: "admin_input",
      fields: yearFields({
        primary: "admin_input",
        ctosRaw: null,
        issuerRaw: null,
        adminRaw,
        overrides: overrides[String(year)],
      }),
    });
  }

  // Remaining eligible missing years: render as Add Financial Statement placeholders (but do not duplicate placeholders already rendered inside the CTOS window).
  for (const year of eligible) {
    if (placeholderRenderedYears.has(year)) continue;
    if (issuerYearSet.has(year)) continue;
    if (adminYearSetAny.has(year)) continue;
    columns.push({
      kind: "admin_fallback_placeholder",
      year,
      primarySource: "add_year",
      recordSource: null,
      fields: {},
    });
  }

  const kindPriority: Record<AdminFinancialReviewColumn["kind"], number> = {
    ctos: 0,
    admin_fallback_placeholder: 1,
    unaudited: 2,
    admin_input: 3,
  };

  return columns.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return kindPriority[a.kind] - kindPriority[b.kind];
  });
}

export type AdminFieldEditDecision =
  | {
      ok: true;
      action: AdminFieldOverrideAction;
      previousValue: number | null;
      originalSource: FinancialFieldProvenance;
      baseSource: FinancialFieldProvenance;
    }
  | { ok: false; code: string; message: string };

export function decideAdminFinancialFieldEdit(params: {
  columns: AdminFinancialReviewColumn[];
  financialYear: number;
  fieldKey: string;
}): AdminFieldEditDecision {
  if (isCalculatedFinancialMetricKey(params.fieldKey)) {
    return {
      ok: false,
      code: "CALCULATED_FIELD_NOT_EDITABLE",
      message: "Calculated metrics cannot be edited directly",
    };
  }
  if (!isAdminEditableRawFinancialKey(params.fieldKey)) {
    return { ok: false, code: "FIELD_NOT_EDITABLE", message: "This field cannot be edited" };
  }
  const column = params.columns.find((item) => item.year === params.financialYear);
  if (!column || column.primarySource === "add_year") {
    return {
      ok: false,
      code: "ADMIN_FINANCIAL_YEAR_NOT_EDITABLE",
      message: `FY${params.financialYear} must be added as a financial statement before individual fields can be edited`,
    };
  }
  const field = column.fields[params.fieldKey];
  if (column.primarySource === "ctos" && field?.readOnly) {
    return {
      ok: false,
      code: "CTOS_FIELD_READONLY",
      message: "CTOS provided this value and it cannot be overwritten",
    };
  }
  if (column.primarySource === "ctos") {
    return {
      ok: true,
      action: "add_missing_ctos_field",
      previousValue: field?.value ?? null,
      originalSource: "ctos",
      baseSource: "ctos",
    };
  }
  if (column.primarySource === "user_input") {
    return {
      ok: true,
      action: "edit_user_input",
      previousValue: field?.value ?? null,
      originalSource: "user_input",
      baseSource: "user_input",
    };
  }
  return {
    ok: true,
    action: "edit_admin_input",
    previousValue: field?.value ?? null,
    originalSource: "admin_input",
    baseSource: "admin_input",
  };
}

/** Copy resolved raw values onto a Stage 4A year block. Present CTOS values stay put. */
export function applyResolvedRawFields(params: {
  recordSource: FinancialStatementRecordSource;
  rawFinancials: Record<string, unknown>;
  overridesForYear: Record<string, AdminFieldOverride> | undefined;
}): Record<string, unknown> {
  const next = { ...params.rawFinancials };
  const primary: Exclude<AdminFinancialReviewPrimarySource, "add_year"> =
    params.recordSource === "ctos_audited"
      ? "ctos"
      : params.recordSource === "admin_input"
        ? "admin_input"
        : "user_input";
  for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
    const resolved = resolveRawField({
      primary,
      key,
      ctosRaw: primary === "ctos" ? params.rawFinancials : null,
      issuerRaw: primary === "user_input" ? params.rawFinancials : null,
      adminRaw: primary === "admin_input" ? params.rawFinancials : null,
      override: params.overridesForYear?.[key],
    });
    if (resolved.value == null) continue;
    if (primary === "ctos" && readFiniteFinancialNumber(params.rawFinancials[key]) != null) continue;
    next[key] = resolved.value;
  }
  return next;
}

export function receivablesDaysUnavailableReason(params: {
  year: number;
  endingTradeReceivables: number | null;
  priorTradeReceivables: number | null;
  turnover: number | null;
}): string | null {
  if (params.priorTradeReceivables == null) {
    return "Unable to calculate — previous year Trade Receivables unavailable";
  }
  if (params.endingTradeReceivables == null) {
    return "Unable to calculate — Trade Receivables unavailable";
  }
  if (params.turnover == null || params.turnover === 0) {
    return "Unable to calculate — Revenue unavailable";
  }
  return null;
}

/**
 * Drop User Input overrides the issuer has replaced. CTOS gap fills stay.
 */
export function reconcileAdminFieldOverridesAfterIssuerSave(params: {
  existingFinancialStatements: unknown;
  previousUnauditedByYear: Record<string, unknown> | null;
  nextUnauditedByYear: Record<string, Record<string, unknown>>;
}): Record<string, Record<string, AdminFieldOverride>> {
  const overrides = parseAdminFieldOverrides(params.existingFinancialStatements);
  const previous = params.previousUnauditedByYear ?? {};
  const next: Record<string, Record<string, AdminFieldOverride>> = {};
  for (const [year, fields] of Object.entries(overrides)) {
    const kept: Record<string, AdminFieldOverride> = {};
    const prevBlock = asRecord(previous[year]);
    const nextBlock = params.nextUnauditedByYear[year];
    for (const [key, override] of Object.entries(fields)) {
      if (override.action !== "edit_user_input") {
        kept[key] = override;
        continue;
      }
      const before = readFiniteFinancialNumber(prevBlock?.[key]);
      const after = readFiniteFinancialNumber(nextBlock?.[key]);
      if (before === after) kept[key] = override;
    }
    if (Object.keys(kept).length > 0) next[year] = kept;
  }
  return next;
}
