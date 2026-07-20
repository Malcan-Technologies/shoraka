/**
 * SECTION: Build / wrap Page 2 publication freeze (Stage 4 financial comparison)
 * WHY: Application financials are live; freeze selected years + raw fields at publish
 */

import { decimalToSerializableString } from "../../issuer-dashboard/track-record-aggregates";
import { asJsonRecord } from "./prospectus-json-guards";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type {
  ProspectusPage1Snapshot,
  ProspectusPage2FinancialComparisonSnapshot,
  ProspectusPage2FinancialRawSnapshot,
  ProspectusPage2Snapshot,
  ProspectusSnapshot,
} from "./prospectus-snapshot.types";

/** Shared freeze keys for Page 2 Stage 4B + Page 3 Stages 2–4. */
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

function pickRawFinancials(raw: Record<string, unknown>): ProspectusPage2FinancialRawSnapshot {
  return {
    turnover: serializeRawField(raw.turnover),
    plnpat: serializeRawField(raw.plnpat),
    bsqpuc: serializeRawField(raw.bsqpuc),
    bscatot: serializeRawField(raw.bscatot),
    curlib: serializeRawField(raw.curlib),
    plnpbt: serializeRawField(raw.plnpbt),
    bsfatot: serializeRawField(raw.bsfatot),
    othass: serializeRawField(raw.othass),
    bsclbank: serializeRawField(raw.bsclbank),
    bsslltd: serializeRawField(raw.bsslltd),
    bsclstd: serializeRawField(raw.bsclstd),
  };
}

/**
 * Freeze Stage 4 year selection + raw canonical fields from normalized financials.
 * Missing financials → valid empty selected_years (publication still succeeds).
 */
export function buildProspectusPage2FinancialComparisonSnapshot(input: {
  financialStatements: unknown;
  ctosFinancials?: unknown;
  now?: Date;
}): ProspectusPage2FinancialComparisonSnapshot {
  const now = input.now ?? new Date();
  const source = buildProspectusFinancialComparisonSource({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: now,
  });

  return {
    source: "admin_financial_statements_normalized",
    selected_years: source.years.map((year) => ({
      year: year.year,
      year_label: year.yearLabel,
      financial_year_end_label:
        year.financialYearEndLabel === PROSPECTUS_DATA_NOT_AVAILABLE
          ? null
          : year.financialYearEndLabel,
      financial_year_end_iso: year.financialYearEndIso,
      record_source: year.recordSource,
      raw_financials: pickRawFinancials(year.rawFinancials),
    })),
    source_footer: source.sourceFooter,
    calculated_at: now.toISOString(),
  };
}

export function buildProspectusPage2Snapshot(input: {
  financialStatements: unknown;
  ctosFinancials?: unknown;
  now?: Date;
}): ProspectusPage2Snapshot {
  return {
    financial_comparison: buildProspectusPage2FinancialComparisonSnapshot(input),
    config_versions: {
      soukscore_scale: null,
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
