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

  return {
    page_1: {
      issuer_track_record: track,
      historical_notes: historical,
    } satisfies ProspectusPage1Snapshot,
  };
}
