/**
 * SECTION: Build / wrap Page 2 publication freeze (Stage 4 financial comparison)
 * WHY: Application financials are live; freeze the resolved years (every raw key) at approval
 */

import { decimalToSerializableString } from "../../issuer-dashboard/track-record-aggregates";
import { asJsonRecord } from "./prospectus-json-guards";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { PROSPECTUS_SOUKSCORE_SCALE_VERSION } from "./prospectus-soukscore-rating-scale.types";
import {
  PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION,
  type ProspectusPage1Snapshot,
  type ProspectusPage2FinancialComparisonSnapshot,
  type ProspectusPage2FinancialRawSnapshot,
  type ProspectusPage2Snapshot,
  type ProspectusSnapshot,
} from "./prospectus-snapshot.types";

/** Legacy freeze keys (pre version 2); always present in a freeze, null when absent. */
const RAW_KEYS = [
  "turnover",
  "plnpat",
  "bsqpuc",
  "bscatot",
  "curlib",
  "plnpbt",
  "bsfatot",
  "othass",
  "bsclbank",
  "bsslltd",
  "bsclstd",
  "totass",
  "totlib",
  "networth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "gear",
] as const;

function serializeRawField(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return decimalToSerializableString(value);
}

const LEGACY_RAW_KEY_SET: ReadonlySet<string> = new Set(RAW_KEYS);

/**
 * Freeze every key of one resolved year: the 18 legacy keys first (null when absent, so old
 * readers keep working), then every other key the resolver produced.
 * WHY: Page 2 / Page 3 read derived keys (ebit, dscr, cashAndBank, …); a hand-picked list drops
 * them and the frozen render shows "Data not available".
 */
function freezeRawFinancials(raw: Record<string, unknown>): ProspectusPage2FinancialRawSnapshot {
  const keys = [...RAW_KEYS, ...Object.keys(raw).filter((key) => !LEGACY_RAW_KEY_SET.has(key))];
  // fromEntries defines own data properties, so no key can reach the object prototype.
  return Object.fromEntries(
    keys.map((key) => [key, serializeRawField(raw[key])])
  ) as ProspectusPage2FinancialRawSnapshot;
}

/**
 * Freeze Stage 4 (version 2): the resolved years with every raw key, statement type, source
 * footer and missing-year state — everything Page 2 / Page 3 need to render without live data.
 * Missing financials → valid empty selected_years (publication still succeeds).
 * `now` stamps calculated_at; `referenceDate` drives year selection (the Note's financial
 * reference date, not the freeze time).
 */
export function buildProspectusPage2FinancialComparisonSnapshot(input: {
  financialStatements: unknown;
  ctosFinancials?: unknown;
  referenceDate: Date;
  now?: Date;
}): ProspectusPage2FinancialComparisonSnapshot {
  const now = input.now ?? new Date();
  const source = buildProspectusFinancialComparisonSource({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.referenceDate,
  });

  return {
    source: "admin_financial_statements_normalized",
    freeze_version: PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION,
    reference_date: input.referenceDate.toISOString(),
    selected_years: source.years.map((year) => ({
      year: year.year,
      year_label: year.yearLabel,
      financial_year_end_label:
        year.financialYearEndLabel === PROSPECTUS_DATA_NOT_AVAILABLE
          ? null
          : year.financialYearEndLabel,
      financial_year_end_iso: year.financialYearEndIso,
      record_source: year.recordSource,
      statement_type: year.statementType,
      raw_financials: freezeRawFinancials(year.rawFinancials),
    })),
    source_footer: source.sourceFooter,
    calculated_at: now.toISOString(),
    missing_ssm_unaudited_years: [...source.missingSsmUnauditedYears],
    ops_warning: source.opsWarning,
  };
}

export function buildProspectusPage2Snapshot(input: {
  financialStatements: unknown;
  ctosFinancials?: unknown;
  referenceDate: Date;
  now?: Date;
}): ProspectusPage2Snapshot {
  return {
    financial_comparison: buildProspectusPage2FinancialComparisonSnapshot(input),
    config_versions: {
      soukscore_scale: PROSPECTUS_SOUKSCORE_SCALE_VERSION,
      legal_copy: null,
      marketing_copy: null,
    },
  };
}

/**
 * Merge page_1 + page_2 into prospectus_snapshot, preserving unknown branches.
 * Always overwrites page_1 and page_2 with the newly frozen values.
 */
export function wrapProspectusSnapshotWithPageTwo(
  page1: ProspectusPage1Snapshot,
  page2: ProspectusPage2Snapshot,
  existingSnapshot?: unknown
): ProspectusSnapshot & Record<string, unknown> {
  const existing = asJsonRecord(existingSnapshot) ?? {};
  return {
    ...existing,
    page_1: page1,
    page_2: page2,
  };
}

/** @deprecated Prefer wrapProspectusSnapshotWithPageTwo — kept for Page 1-only call sites. */
export function wrapProspectusSnapshotPageOneOnly(
  page1: ProspectusPage1Snapshot,
  existingSnapshot?: unknown
): ProspectusSnapshot & Record<string, unknown> {
  const existing = asJsonRecord(existingSnapshot) ?? {};
  const page2 = existing.page_2;
  if (page2 && typeof page2 === "object" && !Array.isArray(page2)) {
    return {
      ...existing,
      page_1: page1,
      page_2: page2 as ProspectusPage2Snapshot,
    };
  }
  return {
    ...existing,
    page_1: page1,
  };
}

export { RAW_KEYS as PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS };
