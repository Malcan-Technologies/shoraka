/**
 * SECTION: Build / wrap Page 2 publication freeze (Stage 4 financial comparison)
 * WHY: Freeze exactly what the preview displayed from the approved Financial Review result
 * (raw and calculated values) so the approved document never changes
 */

import {
  FINANCIAL_REVIEW_CALCULATED_KEYS,
  type ApprovedFinancialResult,
  type FinancialReviewCalculatedValues,
} from "@cashsouk/types";
import { decimalToSerializableString } from "../../issuer-dashboard/track-record-aggregates";
import { asJsonRecord } from "./prospectus-json-guards";
import { buildProspectusFinancialComparisonSourceFromResult } from "./prospectus-financial-comparison-source";
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
 * Freeze every effective raw value of one selected year: the 18 legacy keys first (null when
 * absent, so old readers keep working), then every other key the Financial Review stored.
 * WHY: Page 2 / Page 3 raw rows read issuer keys (cashAndBank, grossProfit, …); a hand-picked
 * list drops them and the frozen render shows "Data not available".
 */
function freezeRawFinancials(raw: Record<string, unknown>): ProspectusPage2FinancialRawSnapshot {
  const keys = [...RAW_KEYS, ...Object.keys(raw).filter((key) => !LEGACY_RAW_KEY_SET.has(key))];
  // fromEntries defines own data properties, so no key can reach the object prototype.
  return Object.fromEntries(
    keys.map((key) => [key, serializeRawField(raw[key])])
  ) as ProspectusPage2FinancialRawSnapshot;
}

/** All 18 stored metrics, in the Financial Review key order. */
function freezeCalculatedValues(
  calculated: FinancialReviewCalculatedValues
): FinancialReviewCalculatedValues {
  const out = {} as FinancialReviewCalculatedValues;
  for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) out[key] = calculated[key];
  return out;
}

/**
 * Freeze Stage 4 (version 2) from the same source adapter the preview uses: the selected years
 * with their effective raw values, stored calculated values, statement type, source footer and
 * missing-year state. No selected years → valid empty selected_years (publication still succeeds).
 * `now` stamps calculated_at; reference_date is the Financial Review result's.
 */
export function buildProspectusPage2FinancialComparisonSnapshot(input: {
  approvedFinancialResult: ApprovedFinancialResult;
  now?: Date;
}): ProspectusPage2FinancialComparisonSnapshot {
  const now = input.now ?? new Date();
  const source = buildProspectusFinancialComparisonSourceFromResult(input.approvedFinancialResult);

  return {
    source: "admin_financial_statements_normalized",
    freeze_version: PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION,
    reference_date: input.approvedFinancialResult.reference_date,
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
      calculated_values: freezeCalculatedValues(year.calculatedValues),
    })),
    source_footer: source.sourceFooter,
    calculated_at: now.toISOString(),
    missing_ssm_unaudited_years: [...source.missingSsmUnauditedYears],
    ops_warning: source.opsWarning,
  };
}

export function buildProspectusPage2Snapshot(input: {
  approvedFinancialResult: ApprovedFinancialResult;
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
