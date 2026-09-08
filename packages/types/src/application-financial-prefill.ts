/**
 * New-application financial prefill: CTOS wins for completed years; in-progress year stays blank.
 *
 * Does not write org master or CTOS storage. Callers copy the returned fields into application form state.
 */

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
export const APPLICATION_FINANCIAL_PREFILL_KEYS = [
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "curlib",
  "bsslltd",
  "bsclstd",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
] as const;

export type ApplicationFinancialPrefillKey = (typeof APPLICATION_FINANCIAL_PREFILL_KEYS)[number];

export type ApplicationFinancialPrefillSource = "ctos" | "org_master" | "blank";

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

export function pickApplicationFinancialPrefillFields(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const key of APPLICATION_FINANCIAL_PREFILL_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

function orgUnauditedYearBlock(orgFinancialStatements: unknown, year: number): Record<string, unknown> | null {
  const root = asRecord(orgFinancialStatements);
  const byYear = asRecord(root?.unaudited_by_year);
  if (!byYear) return null;
  const block = asRecord(byYear[String(year)]);
  if (!block) return null;
  const fields = pickApplicationFinancialPrefillFields(block);
  return Object.keys(fields).length > 0 ? fields : null;
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
 * In-progress year is always blank. Completed years: CTOS if it has application fields, else org master.
 */
export function resolveApplicationFinancialYearPrefill(params: {
  year: number;
  inProgressYear: number | null;
  orgFinancialStatements: unknown;
  ctosFinancials: unknown;
}): ApplicationFinancialYearPrefill {
  const { year, inProgressYear, orgFinancialStatements, ctosFinancials } = params;
  if (inProgressYear != null && year === inProgressYear) {
    return { year, source: "blank", fields: null };
  }
  const fromCtos = ctosYearApplicationFields(ctosFinancials, year);
  if (fromCtos) {
    return { year, source: "ctos", fields: fromCtos };
  }
  const fromOrg = orgUnauditedYearBlock(orgFinancialStatements, year);
  if (fromOrg) {
    return { year, source: "org_master", fields: fromOrg };
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
  orgFinancialStatements: unknown;
  ctosFinancials: unknown;
  ref?: Date;
}): ApplicationFinancialPrefillByYear {
  const { questionnaire, orgFinancialStatements, ctosFinancials, ref } = params;
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
      orgFinancialStatements,
      ctosFinancials,
    });
  }
  return { tabYears, inProgressYear, years };
}
