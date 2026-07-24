/**
 * Shared Admin Financial Statements + Prospectus year resolution.
 * CTOS/audited years + unaudited SSM-window years; CTOS wins on duplicate FY.
 */

import { format } from "date-fns";
import {
  getAdminFinancialSummaryUserColumnYears,
  getFinancialYearPeriodEndIso,
  getLatestThreeCtosYears,
  normalizeFinancialStatementsQuestionnaire,
  type CtosFinancialYearRowInput,
  type FinancialStatementsQuestionnaire,
} from "./financial-unaudited-ctos-validation";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** CTOS financials_json row shape (matches apps/api CTOS parser). */
export type CtosFinancialStatementRow = CtosFinancialYearRowInput & {
  financial_year?: number | null;
  dates?: { pldd?: string | null; bsdd?: string | null };
  account?: Record<string, number | null | undefined>;
};

export type FinancialStatementRecordSource = "ctos_audited" | "unaudited_management";

export type NormalizedFinancialStatementYear = {
  year: number;
  /** Stable override / column key — FYE ISO when known. */
  financialYearEndIso: string;
  recordSource: FinancialStatementRecordSource;
  /** Flat fields matching unaudited_by_year / Admin ctosFinToFs. */
  rawFinancials: Record<string, unknown>;
};

export const FINANCIAL_STATEMENT_SOURCE_FOOTER = {
  audited: "Source: Audited Financial Statements",
  management: "Source: Management Accounts",
  mixed: "Source: Audited Financial Statements & Management Accounts",
  neutral: "Source: Financial Statements",
} as const;

const ACCOUNT_KEYS = [
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "totass",
  "curlib",
  "bsslltd",
  "bsclstd",
  "totlib",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
  "networth",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "workcap",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && ISO_DATE.test(value.trim());
}

/**
 * Flatten a CTOS financials_json row to the same field map Admin Financial Summary uses.
 * Do not change Admin UI — Prospectus reuses this mapping.
 */
export function ctosFinancialRowToFsFields(row: CtosFinancialStatementRow): Record<string, unknown> {
  const account = row.account ?? {};
  const out: Record<string, unknown> = {
    pldd: row.dates?.pldd ?? "",
  };
  for (const key of ACCOUNT_KEYS) {
    const v = account[key];
    out[key] = v != null ? v : "";
  }
  return out;
}

/** Parse organization CTOS `financials_json` array (tolerant of unknown shapes). */
export function parseCtosFinancialStatementRows(raw: unknown): CtosFinancialStatementRow[] {
  let list: unknown = raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const wrapped = (raw as Record<string, unknown>).financials;
    if (Array.isArray(wrapped)) list = wrapped;
  }
  if (!Array.isArray(list)) return [];
  const rows: CtosFinancialStatementRow[] = [];
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const dates = asRecord(rec.dates);
    const account = asRecord(rec.account);
    const fy = rec.financial_year;
    rows.push({
      financial_year:
        typeof fy === "number" && Number.isFinite(fy)
          ? fy
          : fy == null
            ? null
            : Number(fy),
      dates: {
        pldd: typeof dates?.pldd === "string" ? dates.pldd : null,
        bsdd: typeof dates?.bsdd === "string" ? dates.bsdd : null,
      },
      account: (account ?? {}) as Record<string, number | null | undefined>,
    });
  }
  return rows;
}

function extractQuestionnaireAndUnaudited(
  financialRaw: unknown,
  ref: Date = new Date()
): {
  questionnaire: FinancialStatementsQuestionnaire | null;
  /** Raw questionnaire FYE string when present (may fail normalize future-check). */
  financialYearEndIso: string | null;
  unauditedByYear: Record<string, Record<string, unknown>>;
} {
  const root = asRecord(financialRaw);
  if (!root) {
    return { questionnaire: null, financialYearEndIso: null, unauditedByYear: {} };
  }
  const qRaw = root.questionnaire;
  const byYear = asRecord(root.unaudited_by_year);
  const unauditedByYear: Record<string, Record<string, unknown>> = {};
  if (byYear) {
    for (const [key, value] of Object.entries(byYear)) {
      const yearRec = asRecord(value);
      if (yearRec) unauditedByYear[key] = yearRec;
    }
  }
  const qRec = asRecord(qRaw);
  const fyeRaw =
    typeof qRec?.financial_year_end === "string" ? qRec.financial_year_end.trim() : null;
  const financialYearEndIso = isIsoDate(fyeRaw) ? fyeRaw : null;
  const questionnaire = normalizeFinancialStatementsQuestionnaire(qRaw, ref);
  return { questionnaire, financialYearEndIso, unauditedByYear };
}

function resolveFinancialYearEndIso(input: {
  year: number;
  rawFinancials: Record<string, unknown>;
  questionnaire: FinancialStatementsQuestionnaire | null;
  financialYearEndIso: string | null;
}): string {
  const pldd = input.rawFinancials.pldd;
  if (typeof pldd === "string" && isIsoDate(pldd)) return pldd.trim();

  if (input.questionnaire) {
    const fromQ = getFinancialYearPeriodEndIso(input.questionnaire, input.year);
    if (fromQ && isIsoDate(fromQ)) return fromQ;
  }

  if (input.financialYearEndIso) {
    const q: FinancialStatementsQuestionnaire = {
      financial_year_end: input.financialYearEndIso,
    };
    const fromRaw = getFinancialYearPeriodEndIso(q, input.year);
    if (fromRaw && isIsoDate(fromRaw)) return fromRaw;
  }

  return `${input.year}-12-31`;
}

/** True when a year block has at least one finite numeric line item (0 counts). */
export function financialYearBlockHasActualData(raw: Record<string, unknown>): boolean {
  for (const key of ACCOUNT_KEYS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return true;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) continue;
      const n = Number(trimmed.replace(/,/g, ""));
      if (Number.isFinite(n)) return true;
    }
  }
  return false;
}

/**
 * SSM-expected unaudited years with no CTOS coverage and no stored unaudited block
 * (or a stored block with no actual line items). Admin-only ops signal — never blocks approval.
 */
export function findMissingSsmExpectedUnauditedYears(input: {
  financialStatements?: unknown;
  ctosFinancials?: unknown;
  ref?: Date;
}): number[] {
  const ref = input.ref ?? new Date();
  const { questionnaire, unauditedByYear } = extractQuestionnaireAndUnaudited(
    input.financialStatements,
    ref
  );
  const ctosRows = parseCtosFinancialStatementRows(input.ctosFinancials);
  const ctosYearsWithData = new Set<number>();
  for (const row of ctosRows) {
    if (row.financial_year == null || !Number.isFinite(row.financial_year)) continue;
    if (financialYearBlockHasActualData(ctosFinancialRowToFsFields(row))) {
      ctosYearsWithData.add(row.financial_year);
    }
  }

  const missing: number[] = [];
  for (const year of getAdminFinancialSummaryUserColumnYears(questionnaire, ref)) {
    if (ctosYearsWithData.has(year)) continue;
    const stored = unauditedByYear[String(year)];
    if (stored && financialYearBlockHasActualData(stored)) continue;
    missing.push(year);
  }
  return missing.sort((a, b) => a - b);
}

/** Non-blocking Admin warning copy for missing SSM-expected unaudited years. */
export function formatMissingSsmUnauditedYearsOpsWarning(missingYears: number[]): string | null {
  if (missingYears.length === 0) return null;
  const labels = missingYears.map((y) => `FY${y}`).join(", ");
  const yearWord = missingYears.length === 1 ? "year" : "years";
  return (
    `Expected unaudited financial ${yearWord} ${labels} ` +
    `missing from the application. The Prospectus table uses the latest years with available data. ` +
    `This does not block approval.`
  );
}

/**
 * Available years for Prospectus (and Admin-aligned selection):
 * 1. Latest three CTOS/audited years that have a real financial row with actual data
 * 2. Unaudited SSM filing-window years that do not overlap CTOS years and have a stored
 *    block with actual data (empty SSM-expected years are omitted — never fabricated)
 *
 * Precedence: CTOS/audited wins when the same calendar FY appears in both sources.
 */
export function buildNormalizedFinancialStatementYearSet(input: {
  financialStatements?: unknown;
  ctosFinancials?: unknown;
  ref?: Date;
}): NormalizedFinancialStatementYear[] {
  const ref = input.ref ?? new Date();
  const { questionnaire, financialYearEndIso, unauditedByYear } =
    extractQuestionnaireAndUnaudited(input.financialStatements, ref);
  const ctosRows = parseCtosFinancialStatementRows(input.ctosFinancials);
  const byCtosYear = new Map<number, CtosFinancialStatementRow>();
  for (const row of ctosRows) {
    if (row.financial_year != null && Number.isFinite(row.financial_year)) {
      byCtosYear.set(row.financial_year, row);
    }
  }

  const ctosYears = getLatestThreeCtosYears(ctosRows);
  const ctosYearSet = new Set(ctosYears);
  const available: NormalizedFinancialStatementYear[] = [];

  for (const year of ctosYears) {
    const row = byCtosYear.get(year);
    if (!row) continue;
    const rawFinancials = ctosFinancialRowToFsFields(row);
    if (!financialYearBlockHasActualData(rawFinancials)) continue;
    available.push({
      year,
      financialYearEndIso: resolveFinancialYearEndIso({
        year,
        rawFinancials,
        questionnaire,
        financialYearEndIso,
      }),
      recordSource: "ctos_audited",
      rawFinancials,
    });
  }

  const unauditedTabYears = getAdminFinancialSummaryUserColumnYears(questionnaire, ref);
  for (const year of unauditedTabYears) {
    if (ctosYearSet.has(year)) continue;
    // Do not invent SSM-expected years: require a stored block with actual line items.
    const stored = unauditedByYear[String(year)];
    if (!stored || !financialYearBlockHasActualData(stored)) continue;
    const rawFinancials = { ...stored };
    available.push({
      year,
      financialYearEndIso: resolveFinancialYearEndIso({
        year,
        rawFinancials,
        questionnaire,
        financialYearEndIso,
      }),
      recordSource: "unaudited_management",
      rawFinancials,
    });
  }

  return available.sort((a, b) => a.year - b.year);
}

/**
 * Latest `maxYears` from the normalized Admin set, displayed oldest → newest.
 */
export function selectLatestNormalizedFinancialStatementYears(
  years: NormalizedFinancialStatementYear[],
  maxYears = 3
): NormalizedFinancialStatementYear[] {
  if (years.length <= maxYears) return [...years].sort((a, b) => a.year - b.year);
  const descending = [...years].sort((a, b) => b.year - a.year);
  return descending.slice(0, maxYears).sort((a, b) => a.year - b.year);
}

/** Narrowest accurate source footer from selected-year record sources. */
export function resolveFinancialStatementSourceFooter(
  years: Array<{ recordSource: FinancialStatementRecordSource }>
): string {
  if (years.length === 0) return FINANCIAL_STATEMENT_SOURCE_FOOTER.neutral;
  const hasAudited = years.some((y) => y.recordSource === "ctos_audited");
  const hasManagement = years.some((y) => y.recordSource === "unaudited_management");
  if (hasAudited && hasManagement) return FINANCIAL_STATEMENT_SOURCE_FOOTER.mixed;
  if (hasAudited) return FINANCIAL_STATEMENT_SOURCE_FOOTER.audited;
  if (hasManagement) return FINANCIAL_STATEMENT_SOURCE_FOOTER.management;
  return FINANCIAL_STATEMENT_SOURCE_FOOTER.neutral;
}

/** Display label e.g. "31 Dec 2024" from FYE ISO; empty string when unparseable. */
export function formatFinancialYearEndDisplayLabel(financialYearEndIso: string): string {
  if (!isIsoDate(financialYearEndIso)) return "";
  const y = Number(financialYearEndIso.slice(0, 4));
  const m = Number(financialYearEndIso.slice(5, 7)) - 1;
  const d = Number(financialYearEndIso.slice(8, 10));
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return "";
  return format(dt, "d MMM yyyy");
}
