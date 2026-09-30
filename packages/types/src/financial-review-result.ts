/**
 * SECTION: Financial Review result (reviewed values + calculated metrics for every reviewed year)
 * WHY: The Admin Financial Review screen and Financial approval must show and store the same
 * values; the Note copies the approved result and the Prospectus only displays it
 */

import type { FinancialFieldProvenance } from "./financial-field-resolution";
import type {
  FinancialStatementRecordSource,
  FinancialStatementStatementType,
} from "./financial-statement-year-resolution";
import {
  resolveCtosGearingRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosTotalAssetTurnover,
} from "./ctos-financial-highlights";
import {
  computeCurrentRatio,
  computeDscr,
  computeEbit,
  computeInterestCoverage,
  computeNetDebtEquity,
  computeNetWorth,
  computePayablesDays,
  computeQuickRatio,
  computeReceivablesDays,
  computeReturnOnEquity,
  computeTotalAssets,
  computeTotalLiabilities,
  computeTurnoverGrowth,
  computeWorkingCapital,
} from "./ctos-report-table-math";
import {
  ADMIN_EDITABLE_RAW_FINANCIAL_KEYS,
  applyResolvedRawFields,
  parseAdminFieldOverrides,
  readFiniteFinancialNumber,
  resolveAdminFinancialReviewColumns,
  yearFields,
  type AdminFieldOverride,
  type ResolvedRawFinancialField,
} from "./financial-field-resolution";
import { resolvePreviousYearSourceValue } from "./financial-previous-year-source";
import {
  buildNormalizedFinancialStatementYearSet,
  ctosFinancialRowToFsFields,
  financialYearBlockHasActualData,
  findMissingSsmExpectedUnauditedYears,
  formatMissingSsmUnauditedYearsOpsWarning,
  getEligibleAdminInputYears,
  parseCtosFinancialStatementRows,
  resolveFinancialStatementSourceFooter,
  selectLatestNormalizedFinancialStatementYears,
  type CtosFinancialStatementRow,
  type NormalizedFinancialStatementYear,
} from "./financial-statement-year-resolution";
import {
  getFinancialYearPeriodEndIso,
  getLatestThreeCtosYears,
  parseFinancialStatementsQuestionnaireShape,
  type FinancialStatementsQuestionnaire,
} from "./financial-unaudited-ctos-validation";

/**
 * Calculated metrics of one reviewed year. Percent metrics (turnover_growth, profit_margin,
 * return_on_equity, roa) are percent points; ratios are plain multiples; null = cannot calculate.
 */
export const FINANCIAL_REVIEW_CALCULATED_KEYS = [
  "totass",
  "totlib",
  "networth",
  "ebit",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "quickRatio",
  "workcap",
  "roa",
  "assetTurnover",
  "gear",
  "netDebtEquity",
  "interestCoverage",
  "receivablesDays",
  "payablesDays",
  "dscr",
] as const;

export type FinancialReviewCalculatedKey = (typeof FINANCIAL_REVIEW_CALCULATED_KEYS)[number];

export type FinancialReviewCalculatedValues = Record<FinancialReviewCalculatedKey, number | null>;

export type FinancialReviewYearKind = "ctos" | "unaudited" | "admin_input";

export type FinancialReviewFieldSource = {
  source: FinancialFieldProvenance;
  /** Admin edit of a User Input value, or an Admin gap-fill on a CTOS year. */
  edited_by_admin: boolean;
  unavailable_reason?: "not_provided_by_ctos" | "not_provided";
};

export type FinancialReviewResolvedYear = {
  year: number;
  kind: FinancialReviewYearKind;
  record_source: FinancialStatementRecordSource;
  statement_type: FinancialStatementStatementType | null;
  financial_year_end_iso: string | null;
  /** Shown as a column on the Admin Financial Review screen. */
  reviewed_column: boolean;
  /** Used downstream (Note, Prospectus): latest three financial years, one source per year. */
  selected: boolean;
  /** Reviewed values after Admin edits and gap-fills. */
  effective_raw_values: Record<string, string | number | null>;
  source_trace: {
    /** Per raw field: where the effective value came from. */
    fields: Record<string, FinancialReviewFieldSource>;
    /** The stored inputs this year was resolved from. */
    inputs: {
      user_input: Record<string, unknown> | null;
      admin_input: Record<string, unknown> | null;
      ctos: Record<string, unknown> | null;
      admin_overrides: Record<string, unknown> | null;
    };
  };
  calculated_values: FinancialReviewCalculatedValues;
};

export type FinancialReviewResult = {
  /** ISO date used for financial-year selection. */
  reference_date: string;
  /** Ascending by year; CTOS before Admin Input before User Input within a year. */
  years: FinancialReviewResolvedYear[];
  source_footer: string;
  missing_ssm_unaudited_years: number[];
  ops_warning: string | null;
};

export const APPROVED_FINANCIAL_RESULT_VERSION = 1 as const;

/** The Financial Review result stored when the Financial section is approved. */
export type ApprovedFinancialResult = FinancialReviewResult & {
  version: typeof APPROVED_FINANCIAL_RESULT_VERSION;
  application_id: string;
  review_cycle: number | null;
  approved_at: string;
  reviewer_user_id: string | null;
  ctos_report: { report_id: string; fetched_at: string } | null;
};

export type ResolveFinancialReviewResultInput = {
  /** application.financial_statements */
  financialStatements: unknown;
  /** Application-owned CTOS financials_json */
  ctosFinancials: unknown;
  /** Financial-year selection reference date (application.submitted_at). */
  referenceDate: Date;
  ctosFetchState?: "not_pulled" | "no_records" | "has_data";
};

/**
 * Reviewed values and calculated metrics for every reviewed or selected financial year.
 * Built only from the existing resolvers and formula helpers, in this order per metric:
 * CTOS value, else CTOS formula, else CashSouk formula. Missing input → null, never 0.
 */
export function resolveFinancialReviewResult(
  input: ResolveFinancialReviewResultInput
): FinancialReviewResult {
  const context = buildReviewContext(input);
  const reviewedColumns = resolveReviewedColumns(input, context);
  const selectedYears = selectDownstreamYears(input, context);

  const seeds = new Map<string, YearSeed>();
  const reviewedFieldsByKey = new Map<string, Record<string, ResolvedRawFinancialField>>();
  for (const column of reviewedColumns) {
    const key = yearKindKey(column.year, column.kind);
    reviewedFieldsByKey.set(key, column.fields);
    seeds.set(key, {
      year: column.year,
      kind: column.kind,
      reviewedColumn: true,
      selectedFinancialYearEndIso: null,
      fields: column.fields,
    });
  }
  for (const selected of selectedYears) {
    const key = yearKindKey(selected.year, selected.kind);
    const existing = seeds.get(key);
    if (existing) {
      existing.selectedFinancialYearEndIso = selected.financialYearEndIso;
      continue;
    }
    seeds.set(key, {
      year: selected.year,
      kind: selected.kind,
      reviewedColumn: false,
      selectedFinancialYearEndIso: selected.financialYearEndIso,
      fields: fieldsForKind(selected.kind, selected.year, context),
    });
  }

  const years = [...seeds.values()]
    .sort((a, b) => a.year - b.year || YEAR_KIND_ORDER[a.kind] - YEAR_KIND_ORDER[b.kind])
    .map((seed) => buildResolvedYear(seed, context, reviewedFieldsByKey));

  const missingSsmUnauditedYears = findMissingSsmExpectedUnauditedYears({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.referenceDate,
  });

  return {
    reference_date: input.referenceDate.toISOString(),
    years,
    source_footer: resolveFinancialStatementSourceFooter(
      years.filter((year) => year.selected).map((year) => ({ recordSource: year.record_source }))
    ),
    missing_ssm_unaudited_years: missingSsmUnauditedYears,
    ops_warning: formatMissingSsmUnauditedYearsOpsWarning(missingSsmUnauditedYears),
  };
}

/** Downstream (Note / Prospectus) shows the latest three financial years. */
const SELECTED_YEAR_COUNT = 3;

/** Issuer-only raw keys copied onto a User Input year (same list as the Prospectus source). */
const ISSUER_OVERLAY_KEYS = [
  "grossProfit",
  "ebitda",
  "cashAndBank",
  "tradeReceivables",
  "tradePayables",
  "costOfSales",
  "annualDebtService",
  "netOperatingIncome",
  "interest_cost",
  "curlib_borrowing",
  "ncl_loan",
  "operatingCashFlow",
  "freeCashFlow",
] as const;

const YEAR_KIND_ORDER: Record<FinancialReviewYearKind, number> = {
  ctos: 0,
  admin_input: 1,
  unaudited: 2,
};

const RECORD_SOURCE_BY_KIND: Record<FinancialReviewYearKind, FinancialStatementRecordSource> = {
  ctos: "ctos_audited",
  unaudited: "unaudited_management",
  admin_input: "admin_input",
};

const KIND_BY_RECORD_SOURCE: Record<FinancialStatementRecordSource, FinancialReviewYearKind> = {
  ctos_audited: "ctos",
  unaudited_management: "unaudited",
  admin_input: "admin_input",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type ReviewContext = {
  questionnaire: FinancialStatementsQuestionnaire | null;
  unauditedByYear: Record<string, unknown>;
  adminInputByYear: Record<string, unknown>;
  /** Parsed overrides (drive resolution). */
  overridesByYear: Record<string, Record<string, AdminFieldOverride>>;
  /** Stored overrides as saved (source trace only). */
  storedOverridesByYear: Record<string, unknown>;
  ctosRows: CtosFinancialStatementRow[];
  /** CTOS owns a financial_year even when every amount is null. */
  ctosByYear: Map<number, CtosFinancialStatementRow>;
};

type YearSeed = {
  year: number;
  kind: FinancialReviewYearKind;
  reviewedColumn: boolean;
  /** Set when the year is selected downstream: the FYE the selection logic produced. */
  selectedFinancialYearEndIso: string | null;
  fields: Record<string, ResolvedRawFinancialField>;
};

type SelectedYear = {
  year: number;
  kind: FinancialReviewYearKind;
  financialYearEndIso: string;
};

function buildReviewContext(input: ResolveFinancialReviewResultInput): ReviewContext {
  const root = asRecord(input.financialStatements);
  const ctosRows = parseCtosFinancialStatementRows(input.ctosFinancials);
  const ctosByYear = new Map<number, CtosFinancialStatementRow>();
  for (const row of ctosRows) {
    if (row.financial_year == null || !Number.isFinite(row.financial_year)) continue;
    ctosByYear.set(row.financial_year, row);
  }
  return {
    questionnaire: parseFinancialStatementsQuestionnaireShape(root?.questionnaire),
    unauditedByYear: asRecord(root?.unaudited_by_year) ?? {},
    adminInputByYear: asRecord(root?.admin_input_by_year) ?? {},
    overridesByYear: parseAdminFieldOverrides(input.financialStatements),
    storedOverridesByYear: asRecord(root?.admin_field_overrides) ?? {},
    ctosRows,
    ctosByYear,
  };
}

function yearKindKey(year: number, kind: FinancialReviewYearKind): string {
  return `${year}:${kind}`;
}

function blockWithActualData(value: unknown): Record<string, unknown> | null {
  const block = asRecord(value);
  if (!block || !financialYearBlockHasActualData(block)) return null;
  return block;
}

function isFinancialYearKey(key: string): boolean {
  if (!/^\d{4}$/.test(key)) return false;
  const year = Number(key);
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

function statementTypeOfBlock(block: Record<string, unknown> | null): FinancialStatementStatementType {
  const statementType = block?.statementType;
  if (
    statementType === "AUDITED" ||
    statementType === "NOT_AUDITED" ||
    statementType === "MANAGEMENT_ACCOUNTS"
  ) {
    return statementType;
  }
  return "NOT_AUDITED";
}

function financialYearEndIsoFor(
  year: number,
  rawFinancials: Record<string, unknown>,
  questionnaire: FinancialStatementsQuestionnaire | null
): string {
  const pldd = rawFinancials.pldd;
  if (typeof pldd === "string" && ISO_DATE.test(pldd.trim())) return pldd.trim();
  if (questionnaire) {
    const fromQuestionnaire = getFinancialYearPeriodEndIso(questionnaire, year);
    if (fromQuestionnaire && ISO_DATE.test(fromQuestionnaire)) return fromQuestionnaire;
  }
  return `${year}-12-31`;
}

/**
 * Admin Review columns backed by a real record. Skips "Add Financial Statement" placeholders and
 * read-only missing-CTOS gaps (no CTOS row for that FY).
 */
function resolveReviewedColumns(
  input: ResolveFinancialReviewResultInput,
  context: ReviewContext
): Array<{
  year: number;
  kind: FinancialReviewYearKind;
  fields: Record<string, ResolvedRawFinancialField>;
}> {
  const columns = resolveAdminFinancialReviewColumns({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.referenceDate,
    ctosFetchState: input.ctosFetchState,
    eligibleAdminInputYears: getEligibleAdminInputYears({
      financialStatements: input.financialStatements,
      ctosFinancials: input.ctosFinancials,
      ref: input.referenceDate,
    }),
  });
  const out: Array<{
    year: number;
    kind: FinancialReviewYearKind;
    fields: Record<string, ResolvedRawFinancialField>;
  }> = [];
  for (const column of columns) {
    if (column.kind === "admin_fallback_placeholder") continue;
    const fyKey = String(column.year);
    const backed =
      column.kind === "ctos"
        ? context.ctosByYear.has(column.year)
        : blockWithActualData(
            (column.kind === "unaudited" ? context.unauditedByYear : context.adminInputByYear)[fyKey]
          ) != null;
    if (!backed) continue;
    out.push({ year: column.year, kind: column.kind, fields: column.fields });
  }
  return out;
}

/**
 * Year selection ported unchanged from the Prospectus comparison source
 * (`buildProspectusFinancialComparisonSource`): shared SSM year set, plus the latest three CTOS
 * years and active Admin Input years outside the issuer filing window, latest three kept.
 * Each kept year resolves to one source: reviewed User Input, else CTOS, else active Admin Input.
 */
function selectDownstreamYears(
  input: ResolveFinancialReviewResultInput,
  context: ReviewContext
): SelectedYear[] {
  const available = buildNormalizedFinancialStatementYearSet({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.referenceDate,
  });

  const presentYears = new Set(available.map((year) => year.year));
  for (const year of getLatestThreeCtosYears(context.ctosRows)) {
    if (presentYears.has(year)) continue;
    const row = context.ctosByYear.get(year);
    if (!row) continue;
    const rawFinancials = ctosFinancialRowToFsFields(row);
    available.push({
      year,
      financialYearEndIso: financialYearEndIsoFor(year, rawFinancials, context.questionnaire),
      recordSource: "ctos_audited",
      statementType: "AUDITED",
      rawFinancials,
    });
    presentYears.add(year);
  }
  for (const [fyKey, storedAdmin] of Object.entries(context.adminInputByYear)) {
    if (!isFinancialYearKey(fyKey)) continue;
    const year = Number(fyKey);
    if (presentYears.has(year) || context.ctosByYear.has(year)) continue;
    const adminBlock = blockWithActualData(storedAdmin);
    if (!adminBlock) continue;
    const userBlock = blockWithActualData(context.unauditedByYear[fyKey]);
    const rawFinancials = { ...(userBlock ?? adminBlock) };
    available.push({
      year,
      financialYearEndIso: financialYearEndIsoFor(year, rawFinancials, context.questionnaire),
      recordSource: userBlock ? "unaudited_management" : "admin_input",
      statementType: userBlock ? "MANAGEMENT_ACCOUNTS" : statementTypeOfBlock(adminBlock),
      rawFinancials,
    });
    presentYears.add(year);
  }

  return selectLatestNormalizedFinancialStatementYears(available, SELECTED_YEAR_COUNT).map(
    (year) => ({
      year: year.year,
      kind: KIND_BY_RECORD_SOURCE[effectiveRecordSource(year, context)],
      financialYearEndIso: year.financialYearEndIso,
    })
  );
}

/** Per-FY source priority: reviewed User Input, else CTOS (row owns the FY), else active Admin Input. */
function effectiveRecordSource(
  year: NormalizedFinancialStatementYear,
  context: ReviewContext
): FinancialStatementRecordSource {
  const fyKey = String(year.year);
  if (blockWithActualData(context.unauditedByYear[fyKey])) return "unaudited_management";
  if (context.ctosByYear.has(year.year)) return "ctos_audited";
  if (blockWithActualData(context.adminInputByYear[fyKey])) return "admin_input";
  return year.recordSource;
}

/** Per-field provenance for a (year, kind) that is not an Admin Review column. */
function fieldsForKind(
  kind: FinancialReviewYearKind,
  year: number,
  context: ReviewContext
): Record<string, ResolvedRawFinancialField> {
  const fyKey = String(year);
  const row = context.ctosByYear.get(year);
  return yearFields({
    primary: kind === "unaudited" ? "user_input" : kind,
    ctosRaw: kind === "ctos" && row ? ctosFinancialRowToFsFields(row) : null,
    issuerRaw: kind === "admin_input" ? null : asRecord(context.unauditedByYear[fyKey]),
    adminRaw: kind === "admin_input" ? asRecord(context.adminInputByYear[fyKey]) : null,
    overrides: context.overridesByYear[fyKey],
  });
}

/** Stored block of a (year, kind) before any Admin edit. */
function baseRawForKind(
  kind: FinancialReviewYearKind,
  year: number,
  context: ReviewContext
): Record<string, unknown> {
  const fyKey = String(year);
  if (kind === "ctos") {
    const row = context.ctosByYear.get(year);
    return row ? ctosFinancialRowToFsFields(row) : {};
  }
  const byYear = kind === "unaudited" ? context.unauditedByYear : context.adminInputByYear;
  return { ...(asRecord(byYear[fyKey]) ?? {}) };
}

/** Same steps as the Prospectus `resolveYearRaw` for one source: overlay, Admin edits, CTOS gap-fills. */
function resolveReviewedRaw(
  kind: FinancialReviewYearKind,
  year: number,
  context: ReviewContext
): Record<string, unknown> {
  const fyKey = String(year);
  const raw = baseRawForKind(kind, year, context);

  if (kind === "unaudited") {
    const storedBlock = asRecord(context.unauditedByYear[fyKey]);
    if (storedBlock) {
      for (const key of ISSUER_OVERLAY_KEYS) {
        const value = storedBlock[key];
        if (value != null && value !== "") raw[key] = value;
      }
    }
  }

  const overridesForYear = context.overridesByYear[fyKey];
  const resolved = applyResolvedRawFields({
    recordSource: RECORD_SOURCE_BY_KIND[kind],
    rawFinancials: raw,
    overridesForYear,
  });

  if (kind === "ctos" && overridesForYear) {
    for (const [fieldKey, override] of Object.entries(overridesForYear)) {
      if (override.action !== "add_missing_ctos_field") continue;
      if (override.baseSource !== "ctos") continue;
      if (override.value == null) continue;
      const current = resolved[fieldKey];
      const isMissing =
        current == null || current === "" || (typeof current === "number" && Number.isNaN(current));
      if (isMissing) resolved[fieldKey] = override.value;
    }
  }
  return resolved;
}

/** Scalars only: strings and finite numbers kept, "" → null, non-finite → null, other shapes dropped. */
function serializeRawValues(raw: Record<string, unknown>): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === "") out[key] = null;
    else if (typeof value === "string") out[key] = value;
    else if (typeof value === "number") out[key] = Number.isFinite(value) ? value : null;
  }
  return out;
}

function serializeFieldSources(
  fields: Record<string, ResolvedRawFinancialField>
): Record<string, FinancialReviewFieldSource> {
  const out: Record<string, FinancialReviewFieldSource> = {};
  for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
    const field = fields[key];
    if (!field) continue;
    out[key] = {
      source: field.source,
      edited_by_admin: field.editedByAdmin,
      ...(field.unavailableReason ? { unavailable_reason: field.unavailableReason } : {}),
    };
  }
  return out;
}

/** Detached JSON copy so the result never aliases (or exposes non-JSON values of) the inputs. */
function cloneJsonRecord(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  return record ? (JSON.parse(JSON.stringify(record)) as Record<string, unknown>) : null;
}

function buildResolvedYear(
  seed: YearSeed,
  context: ReviewContext,
  reviewedFieldsByKey: Map<string, Record<string, ResolvedRawFinancialField>>
): FinancialReviewResolvedYear {
  const { year, kind } = seed;
  const fyKey = String(year);
  const ctosRow = kind === "ctos" ? context.ctosByYear.get(year) ?? null : null;
  const storedBlock =
    kind === "unaudited"
      ? asRecord(context.unauditedByYear[fyKey])
      : kind === "admin_input"
        ? asRecord(context.adminInputByYear[fyKey])
        : null;
  const reviewedRaw = resolveReviewedRaw(kind, year, context);
  const adminOverrides = cloneJsonRecord(context.storedOverridesByYear[fyKey]);

  const priorReviewedValue = (key: string, priorKind: FinancialReviewYearKind): number | null =>
    reviewedFieldsByKey.get(yearKindKey(year - 1, priorKind))?.[key]?.value ?? null;
  const prior = (key: string): number | null =>
    resolvePreviousYearSourceValue({
      currentSource: kind === "unaudited" ? "user_input" : kind,
      previousUserInputValue: priorReviewedValue(key, "unaudited"),
      previousCtosValue: priorReviewedValue(key, "ctos"),
      previousActiveAdminInputValue: priorReviewedValue(key, "admin_input"),
    });

  return {
    year,
    kind,
    record_source: RECORD_SOURCE_BY_KIND[kind],
    statement_type:
      kind === "ctos"
        ? "AUDITED"
        : kind === "unaudited"
          ? "MANAGEMENT_ACCOUNTS"
          : statementTypeOfBlock(storedBlock),
    financial_year_end_iso:
      seed.selectedFinancialYearEndIso ?? financialYearEndIsoFor(year, reviewedRaw, context.questionnaire),
    reviewed_column: seed.reviewedColumn,
    selected: seed.selectedFinancialYearEndIso != null,
    effective_raw_values: serializeRawValues(reviewedRaw),
    source_trace: {
      fields: serializeFieldSources(seed.fields),
      inputs: {
        user_input: kind === "unaudited" ? cloneJsonRecord(storedBlock) : null,
        admin_input: kind === "admin_input" ? cloneJsonRecord(storedBlock) : null,
        ctos: ctosRow ? cloneJsonRecord(ctosFinancialRowToFsFields(ctosRow)) : null,
        admin_overrides: adminOverrides,
      },
    },
    calculated_values: calculateReviewedValues({
      year,
      fields: seed.fields,
      ctosAccount: ctosRow?.account ?? null,
      storedBlock,
      prior,
    }),
  };
}

/** Direct finished figure on the CTOS account (0 counts as present). */
function ctosFigure(
  account: Record<string, unknown> | null,
  key: string
): number | null {
  const value = account?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toPercentPoints(ratio: number | null): number | null {
  return ratio == null ? null : ratio * 100;
}

/** Contract guard: finite number or null; -0 normalised so the result round-trips through JSON. */
function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value === 0 ? 0 : value;
}

/**
 * Calculated metrics of one reviewed (year, kind). CTOS direct figure first (CTOS years only),
 * else the CTOS stylesheet / CashSouk formula on reviewed values. Missing input → null.
 */
function calculateReviewedValues(params: {
  year: number;
  fields: Record<string, ResolvedRawFinancialField>;
  /** CTOS row account for a CTOS year; null otherwise (no direct figures). */
  ctosAccount: Record<string, unknown> | null;
  /** Stored User Input / Admin Input block; null on a CTOS year. */
  storedBlock: Record<string, unknown> | null;
  prior: (key: string) => number | null;
}): FinancialReviewCalculatedValues {
  const { year, fields, ctosAccount, storedBlock, prior } = params;
  const r = (key: string): number | null => fields[key]?.value ?? null;
  const fig = (key: string): number | null => ctosFigure(ctosAccount, key);

  const totass =
    fig("totass") ??
    computeTotalAssets({
      total_assets: storedBlock ? readFiniteFinancialNumber(storedBlock.totass) : null,
      fixed_assets: r("bsfatot"),
      other_assets: r("othass"),
      current_assets: r("bscatot"),
      non_current_assets: r("bsclbank"),
    });
  const totlib =
    fig("totlib") ??
    computeTotalLiabilities({
      total_liabilities: storedBlock ? readFiniteFinancialNumber(storedBlock.totlib) : null,
      current_liabilities: r("curlib"),
      long_term_liabilities: r("bsslltd"),
      non_current_liabilities: r("bsclstd"),
    });
  const networth =
    fig("networth") ?? (totass != null && totlib != null ? computeNetWorth(totass, totlib) : null);
  const ebit = computeEbit(r("plnpbt"), r("interest_cost"));

  const values: FinancialReviewCalculatedValues = {
    totass,
    totlib,
    networth,
    ebit,
    turnover_growth:
      fig("turnover_growth") ??
      toPercentPoints(
        computeTurnoverGrowth({
          targetYear: year,
          targetTurnover: r("turnover"),
          priorYear: year - 1,
          priorTurnover: prior("turnover"),
        })
      ),
    profit_margin: resolveCtosPatMarginPercent({ plnpat: r("plnpat"), turnover: r("turnover") }),
    return_on_equity:
      fig("return_on_equity") ?? toPercentPoints(computeReturnOnEquity(r("plnpat"), networth)),
    currat: fig("currat") ?? computeCurrentRatio(r("bscatot"), r("curlib")),
    quickRatio: computeQuickRatio(r("cashAndBank"), r("tradeReceivables"), r("curlib")),
    workcap: fig("workcap") ?? computeWorkingCapital(r("bscatot"), r("curlib")),
    roa: resolveCtosReturnOnAssetsPercent({ plnpat: r("plnpat"), totass }),
    assetTurnover: resolveCtosTotalAssetTurnover({ turnover: r("turnover"), totass }),
    gear: resolveCtosGearingRatio({ gear: fig("gear"), totlib, networth }),
    netDebtEquity: computeNetDebtEquity({
      curlib_borrowing: r("curlib_borrowing"),
      ncl_loan: r("ncl_loan"),
      cashAndBank: r("cashAndBank"),
      networth,
    }),
    interestCoverage: computeInterestCoverage(ebit, r("interest_cost")),
    receivablesDays: computeReceivablesDays(
      prior("tradeReceivables"),
      r("tradeReceivables"),
      r("turnover")
    ),
    payablesDays: computePayablesDays(r("tradePayables"), r("costOfSales")),
    dscr: computeDscr(r("netOperatingIncome"), r("annualDebtService")),
  };

  const out = {} as FinancialReviewCalculatedValues;
  for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) out[key] = finiteOrNull(values[key]);
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

const YEAR_KINDS: ReadonlySet<string> = new Set(["ctos", "unaudited", "admin_input"]);
const RECORD_SOURCES: ReadonlySet<string> = new Set([
  "ctos_audited",
  "unaudited_management",
  "admin_input",
]);
const STATEMENT_TYPES: ReadonlySet<string> = new Set(["AUDITED", "NOT_AUDITED", "MANAGEMENT_ACCOUNTS"]);
const FIELD_SOURCES: ReadonlySet<string> = new Set(["ctos", "user_input", "admin_input"]);
const UNAVAILABLE_REASONS: ReadonlySet<string> = new Set(["not_provided_by_ctos", "not_provided"]);

function parseCalculatedValues(value: unknown): FinancialReviewCalculatedValues | null {
  const record = asRecord(value);
  if (!record) return null;
  const out = {} as FinancialReviewCalculatedValues;
  for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) {
    const item = record[key];
    if (item === null) out[key] = null;
    else if (typeof item === "number" && Number.isFinite(item)) out[key] = item;
    else return null;
  }
  return out;
}

function parseEffectiveRawValues(value: unknown): Record<string, string | number | null> | null {
  const record = asRecord(value);
  if (!record) return null;
  const out: Record<string, string | number | null> = {};
  for (const [key, item] of Object.entries(record)) {
    if (item === null || typeof item === "string") out[key] = item;
    else if (typeof item === "number" && Number.isFinite(item)) out[key] = item;
    else return null;
  }
  return out;
}

function parseFieldSources(value: unknown): Record<string, FinancialReviewFieldSource> | null {
  const record = asRecord(value);
  if (!record) return null;
  const out: Record<string, FinancialReviewFieldSource> = {};
  for (const [key, item] of Object.entries(record)) {
    const field = asRecord(item);
    if (!field) return null;
    if (typeof field.source !== "string" || !FIELD_SOURCES.has(field.source)) return null;
    if (typeof field.edited_by_admin !== "boolean") return null;
    const reason = field.unavailable_reason;
    if (reason !== undefined && (typeof reason !== "string" || !UNAVAILABLE_REASONS.has(reason))) {
      return null;
    }
    out[key] = {
      source: field.source as FinancialFieldProvenance,
      edited_by_admin: field.edited_by_admin,
      ...(reason !== undefined
        ? { unavailable_reason: reason as FinancialReviewFieldSource["unavailable_reason"] }
        : {}),
    };
  }
  return out;
}

function parseTraceInput(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null) return null;
  return asRecord(value) ?? undefined;
}

function parseResolvedYear(value: unknown): FinancialReviewResolvedYear | null {
  const row = asRecord(value);
  if (!row) return null;
  if (typeof row.year !== "number" || !Number.isInteger(row.year)) return null;
  if (typeof row.kind !== "string" || !YEAR_KINDS.has(row.kind)) return null;
  if (typeof row.record_source !== "string" || !RECORD_SOURCES.has(row.record_source)) return null;
  const statementType = nullableString(row.statement_type);
  if (statementType === undefined) return null;
  if (statementType !== null && !STATEMENT_TYPES.has(statementType)) return null;
  const financialYearEndIso = nullableString(row.financial_year_end_iso);
  if (financialYearEndIso === undefined) return null;
  if (typeof row.reviewed_column !== "boolean" || typeof row.selected !== "boolean") return null;

  const effectiveRawValues = parseEffectiveRawValues(row.effective_raw_values);
  const calculatedValues = parseCalculatedValues(row.calculated_values);
  const trace = asRecord(row.source_trace);
  const fields = parseFieldSources(trace?.fields);
  const inputs = asRecord(trace?.inputs);
  if (!effectiveRawValues || !calculatedValues || !fields || !inputs) return null;

  const userInput = parseTraceInput(inputs.user_input);
  const adminInput = parseTraceInput(inputs.admin_input);
  const ctos = parseTraceInput(inputs.ctos);
  const adminOverrides = parseTraceInput(inputs.admin_overrides);
  if (
    userInput === undefined ||
    adminInput === undefined ||
    ctos === undefined ||
    adminOverrides === undefined
  ) {
    return null;
  }

  return {
    year: row.year,
    kind: row.kind as FinancialReviewYearKind,
    record_source: row.record_source as FinancialStatementRecordSource,
    statement_type: statementType as FinancialStatementStatementType | null,
    financial_year_end_iso: financialYearEndIso,
    reviewed_column: row.reviewed_column,
    selected: row.selected,
    effective_raw_values: effectiveRawValues,
    source_trace: {
      fields,
      inputs: {
        user_input: userInput,
        admin_input: adminInput,
        ctos,
        admin_overrides: adminOverrides,
      },
    },
    calculated_values: calculatedValues,
  };
}

/** Returns null for a missing or malformed value; never throws. */
export function parseApprovedFinancialResult(value: unknown): ApprovedFinancialResult | null {
  const root = asRecord(value);
  if (!root) return null;
  if (root.version !== APPROVED_FINANCIAL_RESULT_VERSION) return null;
  if (typeof root.application_id !== "string" || root.application_id.length === 0) return null;
  if (!isIsoDateTime(root.approved_at) || !isIsoDateTime(root.reference_date)) return null;
  if (root.review_cycle !== null && typeof root.review_cycle !== "number") return null;
  const reviewerUserId = nullableString(root.reviewer_user_id);
  if (reviewerUserId === undefined) return null;
  if (typeof root.source_footer !== "string") return null;
  const opsWarning = nullableString(root.ops_warning);
  if (opsWarning === undefined) return null;

  const missing = root.missing_ssm_unaudited_years;
  if (!Array.isArray(missing) || !missing.every((year) => Number.isInteger(year))) return null;

  let ctosReport: ApprovedFinancialResult["ctos_report"] = null;
  if (root.ctos_report !== null) {
    const report = asRecord(root.ctos_report);
    if (!report || typeof report.report_id !== "string" || !isIsoDateTime(report.fetched_at)) {
      return null;
    }
    ctosReport = { report_id: report.report_id, fetched_at: report.fetched_at };
  }

  if (!Array.isArray(root.years)) return null;
  const years: FinancialReviewResolvedYear[] = [];
  for (const item of root.years) {
    const year = parseResolvedYear(item);
    if (!year) return null;
    years.push(year);
  }

  return {
    version: APPROVED_FINANCIAL_RESULT_VERSION,
    application_id: root.application_id,
    review_cycle: root.review_cycle,
    approved_at: root.approved_at,
    reviewer_user_id: reviewerUserId,
    ctos_report: ctosReport,
    reference_date: root.reference_date,
    years,
    source_footer: root.source_footer,
    missing_ssm_unaudited_years: missing as number[],
    ops_warning: opsWarning,
  };
}
