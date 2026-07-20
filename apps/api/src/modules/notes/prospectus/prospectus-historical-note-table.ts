/**
 * SECTION: Build Historical Note Table
 * WHY: Canva columns from funded history; Stage 2/4A reuse; confirmed status labels
 */

import {
  PROSPECTUS_FUNDED_HISTORY_STATUS_SET,
} from "../../issuer-dashboard/track-record-aggregates";
import { buildProspectusTenureAndMaturity, formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import { formatProspectusHistoricalNoteStatus } from "./prospectus-historical-note-status";
import {
  formatProspectusMoneyMyr,
  formatProspectusProfitRatePercent,
} from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE,
  PROSPECTUS_HISTORICAL_NOTE_ROW_LIMIT,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS,
  type ProspectusHistoricalNoteRowInput,
  type ProspectusHistoricalNoteTable,
  type ProspectusHistoricalNoteTableRow,
} from "./prospectus-historical-note-table.types";
import type { ProspectusPage1HistoricalNoteSnapshot } from "./prospectus-snapshot.types";

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTime(value: Date | string): number {
  return new Date(value).getTime();
}

export function buildProspectusHistoricalNoteTableRowFromInput(
  input: ProspectusHistoricalNoteRowInput
): ProspectusHistoricalNoteTableRow {
  void input.targetAmount;

  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });

  return {
    noteId: nonEmptyString(input.noteReference) ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    financingType: nonEmptyString(input.productName) ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    amountRm: formatProspectusMoneyMyr(input.fundedAmount),
    tenure: timing.tenure,
    profitRate: formatProspectusProfitRatePercent(input.profitRatePercent),
    status: formatProspectusHistoricalNoteStatus(input.noteStatus),
    repaymentDate: formatProspectusDateUtc(input.repaidAt),
  };
}

export function buildProspectusHistoricalNoteTableRowFromSnapshot(
  row: ProspectusPage1HistoricalNoteSnapshot
): ProspectusHistoricalNoteTableRow {
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: row.listing_opens_at,
    maturityDate: row.maturity_date,
  });
  const profit =
    row.profit_rate_percent == null || row.profit_rate_percent === ""
      ? null
      : Number(row.profit_rate_percent);
  const funded =
    row.funded_amount == null || row.funded_amount === ""
      ? null
      : Number(row.funded_amount);

  return {
    noteId: nonEmptyString(row.note_reference) ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    financingType: nonEmptyString(row.financing_type) ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    amountRm: formatProspectusMoneyMyr(funded),
    tenure: timing.tenure,
    profitRate: formatProspectusProfitRatePercent(
      profit != null && Number.isFinite(profit) ? profit : null
    ),
    status: formatProspectusHistoricalNoteStatus(row.status),
    repaymentDate: formatProspectusDateUtc(row.repaid_at),
  };
}

function withTableMeta(
  rows: ProspectusHistoricalNoteTableRow[],
  snapshotDecision: ProspectusHistoricalNoteTable["audit"]["snapshot"]["snapshotDecision"],
  isFrozen: boolean
): ProspectusHistoricalNoteTable {
  return {
    rows,
    emptyStateMessage: rows.length === 0 ? PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE : null,
    audit: {
      identity: {
        issuerGroupingKey: "notes.issuer_organization_id",
        currentNoteExclusionKey: "notes.id",
        currentNoteExclusionRequired: true,
      },
      eligibility: {
        statuses: ["ACTIVE", "REPAID", "ARREARS", "DEFAULTED"],
        sort: "updated_at DESC",
        rowLimit: 4,
      },
      snapshot: {
        isFrozen,
        snapshotDecision,
      },
    },
  };
}

/**
 * Formats caller-supplied rows with prospectus eligibility, sort, and limit.
 * Prefer snapshot path for published Notes.
 */
export function buildProspectusHistoricalNoteTable(
  rows: ProspectusHistoricalNoteRowInput[],
  options: {
    issuerOrganizationId?: string | null;
    currentNoteId?: string | null;
  } = {}
): ProspectusHistoricalNoteTable {
  const issuerId = nonEmptyString(options.issuerOrganizationId ?? null);
  const currentId = nonEmptyString(options.currentNoteId ?? null);

  const filtered = rows
    .filter((row) => {
      if (currentId && row.id === currentId) return false;
      if (issuerId && row.issuerOrganizationId !== issuerId) return false;
      return PROSPECTUS_FUNDED_HISTORY_STATUS_SET.has(String(row.noteStatus));
    })
    .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))
    .slice(0, PROSPECTUS_HISTORICAL_NOTE_ROW_LIMIT)
    .map(buildProspectusHistoricalNoteTableRowFromInput);

  return withTableMeta(filtered, "caller_supplied", false);
}

export function buildProspectusHistoricalNoteTableFromSnapshot(
  historicalNotes: ProspectusPage1HistoricalNoteSnapshot[] | null | undefined
): ProspectusHistoricalNoteTable {
  const rows = (historicalNotes ?? []).map(buildProspectusHistoricalNoteTableRowFromSnapshot);
  return withTableMeta(rows, "frozen_at_publish", true);
}

/**
 * Admin Prospectus Review table — same headers/values as Page 1 Canva HTML.
 * Does not recalculate eligibility; maps an already-built Stage 8 view-model.
 */
export function toAdminHistoricalNoteTable(table: ProspectusHistoricalNoteTable): {
  headers: string[];
  rows: Array<{
    noteId: string;
    financingType: string;
    amountRm: string;
    tenure: string;
    profitRate: string;
    status: string;
    repaymentDate: string;
  }>;
  emptyStateMessage: string | null;
} {
  return {
    headers: [...PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS],
    rows: table.rows.map((row) => ({
      noteId: row.noteId,
      financingType: row.financingType,
      amountRm: row.amountRm,
      tenure: row.tenure,
      profitRate: row.profitRate,
      status: row.status,
      repaymentDate: row.repaymentDate,
    })),
    emptyStateMessage: table.emptyStateMessage,
  };
}
