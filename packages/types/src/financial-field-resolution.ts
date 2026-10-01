/**
 * Field-level financial provenance on top of one primary source per FY.
 * Formulas stay in ctos-report-table-math.ts. This module only resolves values and edit rights.
 */

import { isIssuerFinancialFieldRequired } from "./comrep-requiredness";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
} from "./financial-field-labels";
import {
  ctosFinancialRowToFsFields,
  financialYearBlockHasActualData,
  parseCtosFinancialStatementRows,
  type FinancialStatementRecordSource,
  type FinancialStatementStatementType,
} from "./financial-statement-year-resolution";

import {
  getAdminFinancialSummaryUserColumnYears,
  parseFinancialStatementsQuestionnaireShape,
} from "./financial-unaudited-ctos-validation";
import { isApplicationReviewableStatus } from "./application-review-lifecycle";

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

export const ADMIN_FIELD_OVERRIDE_ACTIONS = [
  "add_missing_ctos_field",
  "edit_user_input",
  "edit_admin_input",
  "add_missing_fy",
] as const;

export type AdminFieldOverrideAction = (typeof ADMIN_FIELD_OVERRIDE_ACTIONS)[number];

export type AdminFieldOverride = {
  value: number | string | null;
  baseSource: FinancialFieldProvenance;
  action: AdminFieldOverrideAction;
  updated_by_user_id: string;
  updated_at: string;
};

/** One FY + field keeps one override per action. The action key is the source identity. */
export type AdminFieldOverrideSlot = Partial<Record<AdminFieldOverrideAction, AdminFieldOverride>>;

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

/** Whole-year Admin Input uses the issuer raw-field requiredness rule. Calculated metrics are excluded. */
export function isWholeYearAdminFinancialFieldRequired(key: string): boolean {
  return isAdminEditableRawFinancialKey(key) && isIssuerFinancialFieldRequired(key);
}

export const WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS = ADMIN_EDITABLE_RAW_FINANCIAL_KEYS.filter((key) =>
  isWholeYearAdminFinancialFieldRequired(key)
);

export const WHOLE_YEAR_ADMIN_OPTIONAL_FINANCIAL_KEYS = ADMIN_EDITABLE_RAW_FINANCIAL_KEYS.filter(
  (key) => !isWholeYearAdminFinancialFieldRequired(key)
);

function wholeYearAdminFieldValueComplete(value: unknown): boolean {
  return readFiniteFinancialNumber(value) != null;
}

export function wholeYearAdminFinancialFieldProgress(
  values: Record<string, unknown>,
  sections: ReadonlyArray<{ id: string; keys: readonly string[] }> = []
): {
  requiredTotal: number;
  completed: number;
  remaining: number;
  missingKeys: string[];
  sections: Array<{ id: string; requiredTotal: number; remaining: number }>;
} {
  const missingKeys = WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS.filter(
    (key) => !wholeYearAdminFieldValueComplete(values[key])
  );
  const requiredTotal = WHOLE_YEAR_ADMIN_REQUIRED_FINANCIAL_KEYS.length;
  const sectionProgress = sections.map((section) => {
    const requiredKeys = section.keys.filter((key) => isWholeYearAdminFinancialFieldRequired(key));
    const remaining = requiredKeys.filter((key) => !wholeYearAdminFieldValueComplete(values[key])).length;
    return { id: section.id, requiredTotal: requiredKeys.length, remaining };
  });
  return {
    requiredTotal,
    completed: requiredTotal - missingKeys.length,
    remaining: missingKeys.length,
    missingKeys: [...missingKeys],
    sections: sectionProgress,
  };
}

/**
 * Section-level Admin application-financial edit lock: Financial is APPROVED.
 * A missing row is treated as not approved (PENDING / reopened after resubmit deletes the amendment row).
 * Use {@link isAdminFinancialEditOpen} to decide whether Admin may edit; it also applies the
 * application review boundary.
 */
export function isAdminFinancialReviewEditLocked(sectionStatus: string | null | undefined): boolean {
  return String(sectionStatus ?? "").trim().toUpperCase() === "APPROVED";
}

/**
 * Admin may edit application financials only while the application is reviewable and the
 * Financial section is not APPROVED. Same application boundary as every other review action.
 */
export function isAdminFinancialEditOpen(input: {
  financialSectionStatus: string | null | undefined;
  applicationStatus: string | null | undefined;
}): boolean {
  return (
    isApplicationReviewableStatus(input.applicationStatus) &&
    !isAdminFinancialReviewEditLocked(input.financialSectionStatus)
  );
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

const ADMIN_FIELD_OVERRIDE_ACTION_SET = new Set<string>(ADMIN_FIELD_OVERRIDE_ACTIONS);

function isAdminFieldOverrideAction(value: unknown): value is AdminFieldOverrideAction {
  return typeof value === "string" && ADMIN_FIELD_OVERRIDE_ACTION_SET.has(value);
}

function isFinancialFieldProvenance(value: unknown): value is FinancialFieldProvenance {
  return value === "ctos" || value === "user_input" || value === "admin_input";
}

function buildAdminFieldOverride(
  rec: Record<string, unknown>,
  action: AdminFieldOverrideAction,
  baseSource: FinancialFieldProvenance
): AdminFieldOverride {
  return {
    value: (rec.value as number | string | null) ?? null,
    baseSource,
    action,
    updated_by_user_id: typeof rec.updated_by_user_id === "string" ? rec.updated_by_user_id : "",
    updated_at: typeof rec.updated_at === "string" ? rec.updated_at : "",
  };
}

/**
 * One stored `admin_field_overrides[year][field]` entry.
 * - Legacy: the entry has a string `action`. It is exactly one override for that action
 *   (valid action + valid baseSource, else ignored). Never read as more than one action.
 * - New: `{ [action]: override }`. Each known action key with a valid baseSource is kept,
 *   and the key wins over any inner `action`.
 * Returns null when nothing valid is stored.
 */
export function parseAdminFieldOverrideEntry(
  raw: unknown
): { slot: AdminFieldOverrideSlot; legacy: boolean } | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  if (typeof rec.action === "string") {
    const action = rec.action;
    const baseSource = rec.baseSource;
    if (!isAdminFieldOverrideAction(action) || !isFinancialFieldProvenance(baseSource)) return null;
    return { slot: { [action]: buildAdminFieldOverride(rec, action, baseSource) }, legacy: true };
  }
  const slot: AdminFieldOverrideSlot = {};
  for (const action of ADMIN_FIELD_OVERRIDE_ACTIONS) {
    const inner = asRecord(rec[action]);
    if (!inner || !isFinancialFieldProvenance(inner.baseSource)) continue;
    slot[action] = buildAdminFieldOverride(inner, action, inner.baseSource);
  }
  if (Object.keys(slot).length === 0) return null;
  return { slot, legacy: false };
}

/** Year → field → one override per action. Legacy and new entries may be mixed. */
export function parseAdminFieldOverrides(
  financialStatements: unknown
): Record<string, Record<string, AdminFieldOverrideSlot>> {
  const root = asRecord(financialStatements);
  const byYear = asRecord(root?.admin_field_overrides);
  if (!byYear) return {};
  const out: Record<string, Record<string, AdminFieldOverrideSlot>> = {};
  for (const [year, yearValue] of Object.entries(byYear)) {
    const fields = asRecord(yearValue);
    if (!fields) continue;
    const parsed: Record<string, AdminFieldOverrideSlot> = {};
    for (const [fieldKey, raw] of Object.entries(fields)) {
      const entry = parseAdminFieldOverrideEntry(raw);
      if (entry) parsed[fieldKey] = entry.slot;
    }
    if (Object.keys(parsed).length > 0) out[year] = parsed;
  }
  return out;
}

/**
 * Next `admin_field_overrides` to store after one Admin edit on one FY + field.
 * Only that field's `override.action` is set. Other actions on the field are kept
 * (a legacy entry is converted to the new shape first). Every other year / field is passed
 * through unchanged, so untouched legacy entries stay legacy.
 */
export function setAdminFieldOverride(
  financialStatements: unknown,
  params: { year: string; fieldKey: string; override: AdminFieldOverride }
): Record<string, unknown> {
  const root = asRecord(financialStatements);
  const byYear = asRecord(root?.admin_field_overrides) ?? {};
  const yearFieldsRaw = asRecord(byYear[params.year]) ?? {};
  const existingRaw = yearFieldsRaw[params.fieldKey];
  const existing = asRecord(existingRaw);

  let entry: Record<string, unknown> = {};
  if (existing && typeof existing.action === "string") {
    // Legacy: keep its one valid action under its own key. An invalid legacy entry was never read.
    if (isAdminFieldOverrideAction(existing.action) && parseAdminFieldOverrideEntry(existing)) {
      entry = { [existing.action]: { ...existing } };
    }
  } else if (existing) {
    entry = { ...existing };
  }

  const action = params.override.action;
  entry[action] = { ...params.override, action };

  return {
    ...byYear,
    [params.year]: { ...yearFieldsRaw, [params.fieldKey]: entry },
  };
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
  /** Each primary reads only its own action. */
  slot: AdminFieldOverrideSlot | undefined;
}): ResolvedRawFinancialField {
  const ctosValue = params.ctosRaw ? readFiniteFinancialNumber(params.ctosRaw[params.key]) : null;
  const issuerValue = params.issuerRaw ? readFiniteFinancialNumber(params.issuerRaw[params.key]) : null;
  const adminValue = params.adminRaw ? readFiniteFinancialNumber(params.adminRaw[params.key]) : null;
  const override =
    params.primary === "ctos"
      ? params.slot?.add_missing_ctos_field
      : params.primary === "user_input"
        ? params.slot?.edit_user_input
        : params.slot?.edit_admin_input;
  const overrideValue = override != null ? readFiniteFinancialNumber(override.value) : null;

  if (params.primary === "ctos") {
    if (ctosValue != null) {
      return { value: ctosValue, source: "ctos", editedByAdmin: false, readOnly: true };
    }
    if (overrideValue != null) {
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
    if (overrideValue != null) {
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

  const adminResolved = overrideValue ?? adminValue;
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

export function yearFields(params: {
  primary: Exclude<AdminFinancialReviewPrimarySource, "add_year">;
  ctosRaw: Record<string, unknown> | null;
  issuerRaw: Record<string, unknown> | null;
  adminRaw: Record<string, unknown> | null;
  overrides: Record<string, AdminFieldOverrideSlot> | undefined;
}): Record<string, ResolvedRawFinancialField> {
  const fields: Record<string, ResolvedRawFinancialField> = {};
  for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
    fields[key] = resolveRawField({
      primary: params.primary,
      key,
      ctosRaw: params.ctosRaw,
      issuerRaw: params.issuerRaw,
      adminRaw: params.adminRaw,
      slot: params.overrides?.[key],
    });
  }
  return fields;
}

/** Three historical FY slots: latest User Input reporting year minus 3, 2, and 1. */
export function adminHistoricalFinancialYearWindow(input: {
  financialStatements?: unknown;
  ref?: Date;
}): number[] {
  const root = asRecord(input.financialStatements);
  const unauditedByYear = asRecord(root?.unaudited_by_year) ?? {};
  const adminInputByYear = asRecord(root?.admin_input_by_year) ?? {};
  const yearsWithData = (byYear: Record<string, unknown>) =>
    Object.keys(byYear)
      .map((key) => Number(key))
      .filter((year) => Number.isInteger(year))
      .filter((year) => {
        const block = asRecord(byYear[String(year)]);
        return block != null && financialYearBlockHasActualData(block);
      })
      .sort((a, b) => a - b);

  const issuerYears = yearsWithData(unauditedByYear);
  const adminYears = yearsWithData(adminInputByYear);
  let latestUserInputYear: number | null =
    issuerYears.length > 0
      ? issuerYears[issuerYears.length - 1]!
      : adminYears.length > 0
        ? adminYears[adminYears.length - 1]!
        : null;
  if (latestUserInputYear == null) {
    const questionnaire = parseFinancialStatementsQuestionnaireShape(root?.questionnaire);
    if (questionnaire) {
      const tabYears = getAdminFinancialSummaryUserColumnYears(questionnaire, input.ref ?? new Date());
      latestUserInputYear = tabYears.length > 0 ? tabYears[tabYears.length - 1]! : null;
    }
  }
  if (latestUserInputYear == null) return [];
  return [latestUserInputYear - 3, latestUserInputYear - 2, latestUserInputYear - 1];
}

function statementTypeOf(raw: Record<string, unknown> | null): FinancialStatementStatementType | undefined {
  const value = raw?.statementType;
  // Admin Financial Summary badges only need audited / not-audited.
  // Treat management accounts as "statement type unavailable" for this UI.
  if (value === "AUDITED" || value === "NOT_AUDITED") return value;
  return undefined;
}

/**
 * Chronological Admin review columns.
 * Historical slots are latest User Input FY − 3/−2/−1. User Input is a separate lane.
 * Each historical FY has one source: CTOS, else User Input, else active Admin Input, else a gap.
 */
export function resolveAdminFinancialReviewColumns(input: {
  financialStatements?: unknown;
  ctosFinancials?: unknown;
  ref?: Date;
  eligibleAdminInputYears?: number[];
  /**
   * CTOS fetch provenance for historical-year UI decisions.
   * - "not_pulled": no CTOS report has been fetched yet
   * - "no_records": CTOS report fetched successfully but contains zero financial statement years
   * - "has_data": CTOS fetched and contains financial statement years
   *
   * Important: field-level locking must still depend on actual CTOS-provided values,
   * not on this flag. This flag only controls historical "Add Financial Statement" placeholders.
   */
  ctosFetchState?: "not_pulled" | "no_records" | "has_data";
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

  const historicalWindowYears = adminHistoricalFinancialYearWindow({
    financialStatements: input.financialStatements,
    ref: input.ref,
  });

  // Active Admin Input columns:
  // - A historical FY with neither a CTOS row nor User Input is satisfied by Admin Input
  //   (one column, not a gap plus Admin Input).
  // - CTOS ownership (financial_year present, even when amounts are null) hides that Admin Input column.
  // - User Input for the same FY covers it in the User Input lane, so Admin Input is inactive.
  //   Inactive admin_input_by_year blocks are kept for audit and are not deleted here.
  // - Outside the historical window, issuer data suppresses a second Admin column (unchanged).
  const adminYears = adminYearsAny.filter((year) => {
    if (historicalWindowYears.includes(year)) {
      return !ctosByYear.has(year) && !issuerYearSet.has(year);
    }
    return !issuerYearSet.has(year);
  });

  const columns: AdminFinancialReviewColumn[] = [];

  // Has CTOS financial context:
  // - true when at least one CTOS financial_year row contains actual numeric line items
  // - false for empty/fetched CTOS shells (no financial_year data with actual fields)
  const hasCtosHistory = [...ctosByYear.entries()].some(([, rawFsFields]) =>
    financialYearBlockHasActualData(rawFsFields)
  );

  // Backwards compatibility:
  // If no explicit fetch state is provided, preserve the previous behavior where
  // "Add Financial Statement" only appears when CTOS actually provides data.
  const ctosFetched =
    input.ctosFetchState == null
      ? hasCtosHistory
      : input.ctosFetchState === "has_data" || input.ctosFetchState === "no_records";

  const addReadOnlyMissingCtosColumn = (year: number) => {
    const fields: Record<string, ResolvedRawFinancialField> = {};
    for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
      fields[key] = {
        value: null,
        source: "ctos",
        editedByAdmin: false,
        readOnly: true,
        unavailableReason: "not_provided_by_ctos",
      };
    }
    columns.push({
      kind: "ctos",
      year,
      primarySource: "ctos",
      recordSource: "ctos_audited",
      fields,
    });
  };

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
  };

  // Historical 3 slots. Each year resolves on its own:
  // CTOS row (financial_year present) → CTOS
  // else User Input for that FY → the User Input lane column is the slot (emitted below)
  // else active whole-year Admin Input → that Admin column is the slot (emitted below)
  // else CTOS was pulled → editable Admin placeholder
  // else CTOS was not pulled → read-only gap (not an editable CTOS statement)
  for (const year of historicalWindowYears) {
    if (ctosByYear.has(year)) {
      addCtosColumn(year, ctosByYear.get(year) ?? null);
      continue;
    }
    if (issuerYearSet.has(year)) continue;
    if (adminYearSetAny.has(year)) continue;
    if (ctosFetched) addPlaceholderColumn(year);
    else addReadOnlyMissingCtosColumn(year);
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

  const kindPriority: Record<AdminFinancialReviewColumn["kind"], number> = {
    ctos: 0,
    admin_fallback_placeholder: 1,
    admin_input: 2,
    unaudited: 3,
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
  /** Year alone is not unique. Same FY can be CTOS and User Input. */
  columnKind?: AdminFinancialReviewColumn["kind"];
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
  const candidates = params.columns.filter(
    (item) => item.year === params.financialYear && item.primarySource !== "add_year"
  );
  const column = params.columnKind
    ? candidates.find((item) => item.kind === params.columnKind)
    : candidates.length === 1
      ? candidates[0]
      : undefined;
  if (!column) {
    if (!params.columnKind && candidates.length > 1) {
      return {
        ok: false,
        code: "ADMIN_FINANCIAL_COLUMN_AMBIGUOUS",
        message: `FY${params.financialYear} has more than one financial column. Choose the column to edit.`,
      };
    }
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
  overridesForYear: Record<string, AdminFieldOverrideSlot> | undefined;
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
      slot: params.overridesForYear?.[key],
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
 * Drop `edit_user_input` where the issuer replaced the value. Every other action stays.
 * Returns the stored shape: a kept legacy entry stays legacy, a new-shape entry stays new-shape.
 */
export function reconcileAdminFieldOverridesAfterIssuerSave(params: {
  existingFinancialStatements: unknown;
  previousUnauditedByYear: Record<string, unknown> | null;
  nextUnauditedByYear: Record<string, Record<string, unknown>>;
}): Record<string, Record<string, unknown>> {
  const root = asRecord(params.existingFinancialStatements);
  const byYear = asRecord(root?.admin_field_overrides) ?? {};
  const previous = params.previousUnauditedByYear ?? {};
  const next: Record<string, Record<string, unknown>> = {};
  for (const [year, yearValue] of Object.entries(byYear)) {
    const fields = asRecord(yearValue);
    if (!fields) continue;
    const kept: Record<string, unknown> = {};
    const prevBlock = asRecord(previous[year]);
    const nextBlock = params.nextUnauditedByYear[year];
    for (const [key, raw] of Object.entries(fields)) {
      const entry = parseAdminFieldOverrideEntry(raw);
      if (!entry) continue;
      const slot: AdminFieldOverrideSlot = { ...entry.slot };
      if (slot.edit_user_input) {
        const before = readFiniteFinancialNumber(prevBlock?.[key]);
        const after = readFiniteFinancialNumber(nextBlock?.[key]);
        if (before !== after) delete slot.edit_user_input;
      }
      const actions = Object.values(slot);
      if (actions.length === 0) continue;
      kept[key] = entry.legacy ? actions[0] : slot;
    }
    if (Object.keys(kept).length > 0) next[year] = kept;
  }
  return next;
}
