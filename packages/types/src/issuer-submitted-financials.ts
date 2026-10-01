/**
 * Issuer-submitted financial history per FY.
 *
 * Source: immutable `ApplicationRevision` snapshots only (one per submit / resubmit).
 * A FY becomes newer only when its issuer User Input actually changed in that revision.
 * Never reads CTOS, Admin Input, CTOS gap fills, `edit_user_input`, live application JSON, or `updated_at`.
 */

import {
  financialStatementsFromRevisionSnapshot,
  pickSubmittedApplicationFinancialYearFields,
} from "./application-financial-prefill";
import {
  ADMIN_EDITABLE_RAW_FINANCIAL_KEYS,
  readFiniteFinancialNumber,
} from "./financial-field-resolution";
import { financialYearBlockHasActualData } from "./financial-statement-year-resolution";

export type IssuerSubmittedRevisionRow = {
  revisionId: string;
  applicationId: string;
  reviewCycle: number;
  submittedAt: Date | string;
  /** `ApplicationRevision.snapshot`. */
  snapshot: unknown;
};

export type IssuerSubmittedFinancialYear = {
  year: string;
  /** Issuer User Input for this FY as submitted. Never Admin overrides, Admin Input or CTOS. */
  block: Record<string, unknown>;
  /** ISO `submitted_at` of the revision in which this FY's values last changed within its application. */
  effectiveAt: string;
  applicationId: string;
  /** Latest revision carrying this unchanged block. */
  revisionId: string;
};

const YEAR_KEY_RE = /^\d{4}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/** Same values on every canonical raw key. Missing equals missing; 0 is not missing. */
export function issuerFinancialYearBlocksEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): boolean {
  for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
    const left = readFiniteFinancialNumber(a?.[key]);
    const right = readFiniteFinancialNumber(b?.[key]);
    if (left !== right) return false;
  }
  return true;
}

function submittedYearBlocks(snapshot: unknown): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const byYear = asRecord(asRecord(financialStatementsFromRevisionSnapshot(snapshot))?.unaudited_by_year);
  if (!byYear) return out;
  for (const [yearKey, blockUnknown] of Object.entries(byYear)) {
    if (!YEAR_KEY_RE.test(yearKey)) continue;
    const block = pickSubmittedApplicationFinancialYearFields(asRecord(blockUnknown));
    if (!financialYearBlockHasActualData(block)) continue;
    out[yearKey] = block;
  }
  return out;
}

type Candidate = IssuerSubmittedFinancialYear & { carrierSubmittedAt: string };

function isNewer(next: Candidate, current: Candidate): boolean {
  if (next.effectiveAt !== current.effectiveAt) return next.effectiveAt > current.effectiveAt;
  if (next.carrierSubmittedAt !== current.carrierSubmittedAt) {
    return next.carrierSubmittedAt > current.carrierSubmittedAt;
  }
  return next.revisionId > current.revisionId;
}

/**
 * Per application, revisions run oldest → newest by review cycle. A FY that is new, re-added, or
 * changed since the same application's previous revision takes that revision's `submitted_at`.
 * An unchanged FY keeps its earlier time. Across applications, the newest effective time wins per FY.
 */
export function indexIssuerSubmittedFinancialYears(
  rows: IssuerSubmittedRevisionRow[]
): Record<string, IssuerSubmittedFinancialYear> {
  const byApplication = new Map<string, IssuerSubmittedRevisionRow[]>();
  for (const row of rows) {
    const list = byApplication.get(row.applicationId) ?? [];
    list.push(row);
    byApplication.set(row.applicationId, list);
  }

  const best: Record<string, Candidate> = {};
  for (const [applicationId, revisions] of byApplication) {
    revisions.sort((a, b) => a.reviewCycle - b.reviewCycle);
    let previous: Record<string, { block: Record<string, unknown>; effectiveAt: string }> = {};
    for (const revision of revisions) {
      const submittedAt = toIso(revision.submittedAt);
      const blocks = submittedYearBlocks(revision.snapshot);
      const current: typeof previous = {};
      for (const [yearKey, block] of Object.entries(blocks)) {
        const prior = previous[yearKey];
        const effectiveAt =
          prior && issuerFinancialYearBlocksEqual(prior.block, block) ? prior.effectiveAt : submittedAt;
        current[yearKey] = { block, effectiveAt };
        const candidate: Candidate = {
          year: yearKey,
          block,
          effectiveAt,
          applicationId,
          revisionId: revision.revisionId,
          carrierSubmittedAt: submittedAt,
        };
        const existing = best[yearKey];
        if (!existing || isNewer(candidate, existing)) best[yearKey] = candidate;
      }
      previous = current;
    }
  }

  const out: Record<string, IssuerSubmittedFinancialYear> = {};
  for (const [yearKey, candidate] of Object.entries(best)) {
    const { carrierSubmittedAt: _carrier, ...entry } = candidate;
    void _carrier;
    out[yearKey] = entry;
  }
  return out;
}

export function latestIssuerSubmittedFinancialYear(
  index: Record<string, IssuerSubmittedFinancialYear> | null | undefined,
  year: number | string
): IssuerSubmittedFinancialYear | null {
  return index?.[String(year)] ?? null;
}

/** Issuer Profile rows, newest FY first. */
export function issuerFinancialProfileEntries(
  index: Record<string, IssuerSubmittedFinancialYear> | null | undefined
): Array<{ year: string; block: Record<string, unknown> }> {
  if (!index) return [];
  return Object.values(index)
    .filter((entry) => YEAR_KEY_RE.test(entry.year))
    .map((entry) => ({ year: entry.year, block: { ...entry.block } }))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

/** Plain FY → block map for new-application prefill. */
export function issuerSubmittedBlocksByYear(
  index: Record<string, IssuerSubmittedFinancialYear> | null | undefined
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (!index) return out;
  for (const [yearKey, entry] of Object.entries(index)) out[yearKey] = { ...entry.block };
  return out;
}
