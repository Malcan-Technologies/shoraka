/**
 * Issuer financial diff between two consecutive `ApplicationRevision` snapshots (admin resubmit comparison).
 *
 * Source: raw issuer `financial_statements.unaudited_by_year` only.
 * Never reads Admin Input, `admin_field_overrides` (incl. `edit_user_input`), CTOS, CTOS gap fills,
 * the questionnaire, live application JSON or `updated_at`.
 */

import {
  financialStatementsFromRevisionSnapshot,
  pickSubmittedApplicationFinancialYearFields,
} from "./application-financial-prefill";
import {
  ADMIN_EDITABLE_RAW_FINANCIAL_KEYS,
  readFiniteFinancialNumber,
} from "./financial-field-resolution";

export type IssuerFinancialResubmitFieldDiff = {
  issuerBefore: number | null;
  issuerAfter: number | null;
  changed: boolean;
};

export type IssuerFinancialResubmitYearDiff = {
  year: number;
  /** Raw keys whose issuer value changed, in `ADMIN_EDITABLE_RAW_FINANCIAL_KEYS` order. Never empty. */
  changedKeys: string[];
  /** Every raw key for this FY, changed or not. */
  fields: Record<string, IssuerFinancialResubmitFieldDiff>;
};

/** One issuer FY in the comparison; `changedKeys` may be empty (unchanged FY still displayed). */
export type IssuerFinancialResubmitYearComparison = {
  year: number;
  /** Raw keys whose issuer value changed, in `ADMIN_EDITABLE_RAW_FINANCIAL_KEYS` order. Empty when unchanged. */
  changedKeys: string[];
  /** Every raw key for this FY, changed or not. */
  fields: Record<string, IssuerFinancialResubmitFieldDiff>;
};

const YEAR_KEY_RE = /^\d{4}$/;
const RAW_KEY_SET = new Set<string>(ADMIN_EDITABLE_RAW_FINANCIAL_KEYS);
const UNAUDITED_ROOT = "financial_statements.unaudited_by_year";
const UNAUDITED_PREFIX = `${UNAUDITED_ROOT}.`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function issuerYearBlocks(snapshot: unknown): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const byYear = asRecord(asRecord(financialStatementsFromRevisionSnapshot(snapshot))?.unaudited_by_year);
  if (!byYear) return out;
  for (const [yearKey, block] of Object.entries(byYear)) {
    if (!YEAR_KEY_RE.test(yearKey)) continue;
    out[yearKey] = pickSubmittedApplicationFinancialYearFields(asRecord(block));
  }
  return out;
}

/**
 * Every issuer User Input FY present in either revision (union of both `unaudited_by_year`
 * year keys), ascending, with per-key Before/After and `changed` flags. `changedKeys` is empty
 * for an unchanged FY. Admin Input, overrides and CTOS never add a year.
 * Missing equals missing; 0 is not missing.
 */
export function compareIssuerFinancialRevisionSnapshots(
  previousSnapshot: unknown,
  nextSnapshot: unknown
): IssuerFinancialResubmitYearComparison[] {
  const before = issuerYearBlocks(previousSnapshot);
  const after = issuerYearBlocks(nextSnapshot);
  const years = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  return years.map((yearKey) => {
    const fields: Record<string, IssuerFinancialResubmitFieldDiff> = {};
    const changedKeys: string[] = [];
    for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
      const issuerBefore = readFiniteFinancialNumber(before[yearKey]?.[key]);
      const issuerAfter = readFiniteFinancialNumber(after[yearKey]?.[key]);
      const changed = issuerBefore !== issuerAfter;
      fields[key] = { issuerBefore, issuerAfter, changed };
      if (changed) changedKeys.push(key);
    }
    return { year: Number(yearKey), changedKeys, fields };
  });
}

/** True when at least one issuer User Input value changed (drives the Financial Diff badge). */
export function issuerFinancialComparisonHasChanges(
  years: readonly IssuerFinancialResubmitYearComparison[]
): boolean {
  return years.some((y) => y.changedKeys.length > 0);
}

/**
 * FYs where at least one issuer User Input value differs between the previous and next revision.
 * Missing equals missing; 0 is not missing. Ascending by year.
 */
export function diffIssuerFinancialRevisionSnapshots(
  previousSnapshot: unknown,
  nextSnapshot: unknown
): IssuerFinancialResubmitYearDiff[] {
  return compareIssuerFinancialRevisionSnapshots(previousSnapshot, nextSnapshot).filter(
    (y) => y.changedKeys.length > 0
  );
}

/**
 * True only for snapshot diff paths that carry issuer User Input:
 * `financial_statements.unaudited_by_year`, `….<FY>` or `….<FY>.<raw key>`.
 */
export function isIssuerFinancialUserInputResubmitPath(path: string): boolean {
  if (path === UNAUDITED_ROOT) return true;
  if (typeof path !== "string" || !path.startsWith(UNAUDITED_PREFIX)) return false;
  const [year, key, ...rest] = path.slice(UNAUDITED_PREFIX.length).split(".");
  if (!year || !YEAR_KEY_RE.test(year)) return false;
  if (key === undefined) return true;
  return rest.length === 0 && RAW_KEY_SET.has(key);
}
