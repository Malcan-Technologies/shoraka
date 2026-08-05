/**
 * SECTION: Safe parsers for Note JSON snapshots used by Page 1 mapper
 * WHY: Avoid unchecked casts; malformed published snapshots must not crash or live-fallback
 */

import { isSoukscoreRiskRating, type SoukscoreRiskRating } from "@cashsouk/types";
import type {
  NotePurposeSnapshot,
  ProspectusHistoricalNoteStatus,
  ProspectusPage1HistoricalNoteSnapshot,
  ProspectusPage1IssuerTrackRecordSnapshot,
  ProspectusPage1Snapshot,
  ProspectusPage2FinancialComparisonSnapshot,
  ProspectusPage2FinancialRawSnapshot,
  ProspectusPage2FinancialYearSnapshot,
  ProspectusPage2Snapshot,
  ProspectusSnapshot,
} from "./prospectus-snapshot.types";

export function asJsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseProductSnapshot(value: unknown): {
  productName: string | null;
  description: string | null;
} {
  const record = asJsonRecord(value);
  return {
    productName: nonEmptyString(record?.product_name),
    description: nonEmptyString(record?.description),
  };
}

export function parsePaymasterSnapshot(value: unknown): {
  name: string | null;
  entityType: string | null;
} {
  const record = asJsonRecord(value);
  return {
    name: nonEmptyString(record?.name),
    entityType: nonEmptyString(record?.entity_type),
  };
}

/** Page 2 About the Issuer — notes.issuer_snapshot canonical keys only. */
export function parseIssuerSnapshot(value: unknown): {
  name: string | null;
  registrationNumber: string | null;
  industry: string | null;
  entityType: string | null;
  country: string | null;
  businessDescription: string | null;
} {
  const record = asJsonRecord(value);
  return {
    name: nonEmptyString(record?.name),
    registrationNumber: nonEmptyString(record?.registration_number),
    industry: nonEmptyString(record?.industry),
    entityType: nonEmptyString(record?.entity_type),
    country: nonEmptyString(record?.country),
    businessDescription: nonEmptyString(record?.business_description),
  };
}

export function parsePurposeSnapshot(value: unknown): NotePurposeSnapshot | null {
  const record = asJsonRecord(value);
  const financingFor = nonEmptyString(record?.financing_for);
  if (!financingFor) return null;
  return { financing_for: financingFor };
}

export function parseInvoiceSnapshotRiskRating(value: unknown): SoukscoreRiskRating | null {
  const invoice = asJsonRecord(value);
  const offer = asJsonRecord(invoice?.offer_details);
  const rating = offer?.risk_rating;
  return isSoukscoreRiskRating(rating) ? rating : null;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Application financial_statements for Page 2 Stage 4A.
 * Does not require financial_year_end to be in the future (render-time, not save-time).
 * Does not parse CTOS.
 */
export function parseApplicationFinancialStatements(value: unknown): {
  financialYearEndIso: string | null;
  unauditedByYear: Record<string, Record<string, unknown>>;
} {
  const root = asJsonRecord(value);
  const questionnaire = asJsonRecord(root?.questionnaire);
  const fyeRaw = nonEmptyString(questionnaire?.financial_year_end);
  const financialYearEndIso =
    fyeRaw && ISO_DATE_ONLY.test(fyeRaw) ? fyeRaw : null;

  const byYear = asJsonRecord(root?.unaudited_by_year);
  const unauditedByYear: Record<string, Record<string, unknown>> = {};
  if (byYear) {
    for (const [key, yearValue] of Object.entries(byYear)) {
      const yearRecord = asJsonRecord(yearValue);
      if (yearRecord) {
        unauditedByYear[key] = yearRecord;
      }
    }
  }

  return { financialYearEndIso, unauditedByYear };
}

/**
 * Prospectus invoice face value — notes.invoice_snapshot.details.value only.
 * Does not use invoice_value / invoiceAmount aliases or requested_amount.
 */
export function parseInvoiceSnapshotFaceValue(value: unknown): number | null {
  const invoice = asJsonRecord(value);
  const details = asJsonRecord(invoice?.details);
  const raw = details?.value;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const HISTORICAL_STATUSES = new Set<string>(["ACTIVE", "REPAID", "ARREARS", "DEFAULTED"]);

function parseHistoricalNoteRow(value: unknown): ProspectusPage1HistoricalNoteSnapshot | null {
  const row = asJsonRecord(value);
  if (!row) return null;
  const noteId = nonEmptyString(row.note_id);
  const statusRaw = nonEmptyString(row.status);
  const updatedAt = nonEmptyString(row.updated_at);
  if (!noteId || !statusRaw || !updatedAt) return null;
  if (!HISTORICAL_STATUSES.has(statusRaw)) return null;

  const profit = row.profit_rate_percent;
  const profitRate =
    typeof profit === "number" && Number.isFinite(profit)
      ? profit
      : typeof profit === "string"
        ? profit
        : null;

  return {
    note_id: noteId,
    note_reference: nonEmptyString(row.note_reference),
    financing_type: nonEmptyString(row.financing_type),
    funded_amount: nonEmptyString(row.funded_amount),
    listing_opens_at: nonEmptyString(row.listing_opens_at),
    maturity_date: nonEmptyString(row.maturity_date),
    profit_rate_percent: profitRate,
    status: statusRaw as ProspectusHistoricalNoteStatus,
    repaid_at: nonEmptyString(row.repaid_at),
    updated_at: updatedAt,
  };
}

function parseTrackRecord(
  value: unknown
): ProspectusPage1IssuerTrackRecordSnapshot | null {
  const track = asJsonRecord(value);
  if (!track) return null;
  const calculatedAt = nonEmptyString(track.calculated_at);
  if (!calculatedAt) return null;

  const totalNotes = track.total_notes_funded;
  const totalAmount = track.total_amount_funded;
  const success = track.successful_repayment_percent;
  const onTime = track.on_time_payment_rate_six_months_percent;

  return {
    total_notes_funded:
      typeof totalNotes === "number" && Number.isFinite(totalNotes) ? totalNotes : null,
    total_amount_funded:
      typeof totalAmount === "string"
        ? totalAmount
        : typeof totalAmount === "number" && Number.isFinite(totalAmount)
          ? String(totalAmount)
          : null,
    successful_repayment_percent:
      typeof success === "number" && Number.isFinite(success) ? success : null,
    on_time_payment_rate_six_months_percent:
      typeof onTime === "number" && Number.isFinite(onTime) ? onTime : null,
    calculated_at: calculatedAt,
  };
}

function parseRawFinancialScalar(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function parsePage2RawFinancials(value: unknown): ProspectusPage2FinancialRawSnapshot | null {
  const raw = asJsonRecord(value);
  if (!raw) return null;
  // Extended keys may be absent on old published Notes — fill null (no live fallback).
  return {
    turnover: parseRawFinancialScalar(raw.turnover),
    plnpat: parseRawFinancialScalar(raw.plnpat),
    bsqpuc: parseRawFinancialScalar(raw.bsqpuc),
    bscatot: parseRawFinancialScalar(raw.bscatot),
    curlib: parseRawFinancialScalar(raw.curlib),
    plnpbt: parseRawFinancialScalar(raw.plnpbt),
    bsfatot: parseRawFinancialScalar(raw.bsfatot),
    othass: parseRawFinancialScalar(raw.othass),
    bsclbank: parseRawFinancialScalar(raw.bsclbank),
    bsslltd: parseRawFinancialScalar(raw.bsslltd),
    bsclstd: parseRawFinancialScalar(raw.bsclstd),
    totass: parseRawFinancialScalar(raw.totass),
    totlib: parseRawFinancialScalar(raw.totlib),
    networth: parseRawFinancialScalar(raw.networth),
    profit_margin: parseRawFinancialScalar(raw.profit_margin),
    return_on_equity: parseRawFinancialScalar(raw.return_on_equity),
    currat: parseRawFinancialScalar(raw.currat),
  };
}

function parsePage2FinancialYear(value: unknown): ProspectusPage2FinancialYearSnapshot | null {
  const row = asJsonRecord(value);
  if (!row) return null;
  const year = row.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 1000 || year > 9999) {
    return null;
  }
  const yearLabel = nonEmptyString(row.year_label);
  if (!yearLabel) return null;
  const rawFinancials = parsePage2RawFinancials(row.raw_financials);
  if (!rawFinancials) return null;
  const fye = row.financial_year_end_label;
  const financialYearEndLabel =
    fye == null ? null : typeof fye === "string" ? nonEmptyString(fye) : null;
  const fyeIsoRaw = row.financial_year_end_iso;
  const financialYearEndIso =
    typeof fyeIsoRaw === "string" && ISO_DATE_ONLY.test(fyeIsoRaw.trim())
      ? fyeIsoRaw.trim()
      : null;
  const recordSourceRaw = row.record_source;
  const recordSource =
    recordSourceRaw === "ctos_audited" || recordSourceRaw === "unaudited_management"
      ? recordSourceRaw
      : null;

  return {
    year,
    year_label: yearLabel,
    financial_year_end_label: financialYearEndLabel,
    financial_year_end_iso: financialYearEndIso,
    record_source: recordSource,
    raw_financials: rawFinancials,
  };
}

/**
 * Strict Page 2 financial_comparison parser.
 * Independent of page_1 validity — malformed page_2 must not live-fallback.
 */
export function parseProspectusPageTwoFinancialComparison(
  value: unknown
): ProspectusPage2FinancialComparisonSnapshot | null {
  const comparison = asJsonRecord(value);
  if (!comparison) return null;
  const source =
    comparison.source === "admin_financial_statements_normalized" ||
    comparison.source === "application_financial_statements"
      ? comparison.source
      : null;
  if (!source) return null;
  const calculatedAt = nonEmptyString(comparison.calculated_at);
  if (!calculatedAt) return null;
  if (!Array.isArray(comparison.selected_years)) return null;

  const selectedYears: ProspectusPage2FinancialYearSnapshot[] = [];
  for (const year of comparison.selected_years) {
    const parsed = parsePage2FinancialYear(year);
    if (!parsed) return null;
    selectedYears.push(parsed);
  }

  const footerRaw = comparison.source_footer;
  const sourceFooter =
    typeof footerRaw === "string" && footerRaw.trim() ? footerRaw.trim() : null;

  return {
    source,
    selected_years: selectedYears,
    source_footer: sourceFooter,
    calculated_at: calculatedAt,
  };
}

/**
 * Strict Page 2 snapshot parser (page_2 branch only).
 * Returns null when missing or malformed — callers must not use live Application data.
 */
export function parseProspectusPageTwoSnapshot(value: unknown): ProspectusPage2Snapshot | null {
  const root = asJsonRecord(value);
  const page2 = asJsonRecord(root?.page_2);
  if (!page2) return null;
  const financialComparison = parseProspectusPageTwoFinancialComparison(
    page2.financial_comparison
  );
  if (!financialComparison) return null;
  return { financial_comparison: financialComparison };
}

/**
 * Strict Page 1 snapshot parser.
 * Returns null when structure is missing or any historical row is malformed
 * (published Notes must not silently fall back to live data).
 */
export function parseProspectusPageOneSnapshot(value: unknown): ProspectusSnapshot | null {
  const root = asJsonRecord(value);
  const page1 = asJsonRecord(root?.page_1);
  if (!page1) return null;

  const track = parseTrackRecord(page1.issuer_track_record);
  if (!track) return null;

  if (!Array.isArray(page1.historical_notes)) return null;
  const historical: ProspectusPage1HistoricalNoteSnapshot[] = [];
  for (const row of page1.historical_notes) {
    const parsed = parseHistoricalNoteRow(row);
    if (!parsed) return null;
    historical.push(parsed);
  }

  const result: ProspectusSnapshot = {
    page_1: {
      issuer_track_record: track,
      historical_notes: historical,
    } satisfies ProspectusPage1Snapshot,
  };

  const page2 = parseProspectusPageTwoSnapshot(value);
  if (page2) {
    result.page_2 = page2;
  }

  return result;
}
