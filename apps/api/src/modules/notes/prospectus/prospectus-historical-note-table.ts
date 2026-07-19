/**
 * SECTION: Build Historical Note Table rows
 * WHY: Format Canva columns from caller-supplied rows; no filter/sort/limit/amount choice
 */

import { NoteStatus } from "@cashsouk/types";
import { buildProspectusTenureAndMaturity, formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import {
  formatProspectusMoneyMyr,
  formatProspectusProfitRatePercent,
} from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY,
  PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY,
  PROSPECTUS_HISTORICAL_NOTE_TABLE_AUDIT,
  type ProspectusHistoricalNoteRowInput,
  type ProspectusHistoricalNoteTable,
  type ProspectusHistoricalNoteTableOptions,
  type ProspectusHistoricalNoteTableRow,
} from "./prospectus-historical-note-table.types";

const NOTE_STATUS_VALUES = new Set<string>(Object.values(NoteStatus));

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatRawNoteStatus(noteStatus: string | null | undefined): string {
  const value = nonEmptyString(noteStatus);
  if (!value || !NOTE_STATUS_VALUES.has(value)) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  return value;
}

export function buildProspectusHistoricalNoteTableRow(
  input: ProspectusHistoricalNoteRowInput
): ProspectusHistoricalNoteTableRow {
  // Observational aliases / live Product must not become Financing Type.
  void input.productSnapshotName;
  void input.productSnapshotProductLabel;
  void input.liveProductName;
  void input.activatedAt;

  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });
  const noteId = nonEmptyString(input.noteReference);
  const financingType = nonEmptyString(input.productName);
  const financingTarget = formatProspectusMoneyMyr(input.targetAmount);
  const fundedAmount = formatProspectusMoneyMyr(input.fundedAmount);

  return {
    noteId: noteId ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    financingType: financingType ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    amountRm: PROSPECTUS_DATA_NOT_AVAILABLE,
    tenure: timing.tenure,
    profitRate: formatProspectusProfitRatePercent(input.profitRatePercent),
    status: formatRawNoteStatus(input.noteStatus),
    repaymentDate: formatProspectusDateUtc(input.repaidAt),
    audit: {
      identity: {
        issuerGroupingKey: PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY,
        currentNoteExclusionKey: PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY,
      },
      amount: {
        targetSource: "notes.target_amount",
        fundedSource: "notes.funded_amount",
        canvaAmountSource: "unresolved",
        decision: "pending",
        financingTarget,
        fundedAmount,
      },
      eligibility: {
        statusFilterDecision: "pending",
        includedByBuilder: "caller_supplied",
        currentNoteExclusionRequired: true,
      },
      status: {
        source: "notes.status",
        displayMappingDecision: "pending",
      },
      dates: {
        repaymentDateSource: "notes.repaid_at",
      },
    },
  };
}

/**
 * Formats caller-supplied rows in input order.
 * Does not filter by issuer, current Note, or status.
 * Does not sort or truncate — future query rules stay in table audit.
 */
export function buildProspectusHistoricalNoteTable(
  rows: ProspectusHistoricalNoteRowInput[],
  options: ProspectusHistoricalNoteTableOptions = {}
): ProspectusHistoricalNoteTable {
  // Documented for future query boundary only — not applied here.
  void options.issuerOrganizationId;
  void options.currentNoteId;

  return {
    rows: rows.map(buildProspectusHistoricalNoteTableRow),
    audit: PROSPECTUS_HISTORICAL_NOTE_TABLE_AUDIT,
  };
}
