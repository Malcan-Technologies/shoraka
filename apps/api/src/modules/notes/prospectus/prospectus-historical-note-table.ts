/**
 * SECTION: Build Historical Note Table rows
 * WHY: Format confirmed Note fields; exclude current Note by id; no status eligibility filter
 */

import { buildProspectusTenureAndMaturity, formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import {
  formatProspectusMoneyMyr,
  formatProspectusProfitRatePa,
} from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusHistoricalNoteRowInput,
  type ProspectusHistoricalNoteTableOptions,
  type ProspectusHistoricalNoteTableRow,
} from "./prospectus-historical-note-table.types";

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildProspectusHistoricalNoteTableRow(
  input: ProspectusHistoricalNoteRowInput
): ProspectusHistoricalNoteTableRow {
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
  });
  const noteReference = nonEmptyString(input.noteReference);
  const financingType = nonEmptyString(input.productName);
  const noteStatus = nonEmptyString(input.noteStatus);

  return {
    noteReference: noteReference ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    financingType: financingType ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    canvaAmountRm: PROSPECTUS_DATA_NOT_AVAILABLE,
    financingTarget: formatProspectusMoneyMyr(input.targetAmount),
    fundedAmount: formatProspectusMoneyMyr(input.fundedAmount),
    grossProfitRate: formatProspectusProfitRatePa(input.profitRatePercent),
    tenure: timing.tenure,
    listingDate: timing.listingDate,
    activationDate: formatProspectusDateUtc(input.activatedAt),
    maturityDate: timing.maturityDate,
    actualRepaymentDate: formatProspectusDateUtc(input.repaidAt),
    noteStatus: noteStatus ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    repaymentPerformanceLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}

/**
 * Filters by issuer_organization_id and excludes currentNoteId when provided.
 * Does not apply a NoteStatus eligibility filter (unresolved for prospectus).
 * Preserves input order — no invented sort or row limit.
 */
export function buildProspectusHistoricalNoteTable(
  rows: ProspectusHistoricalNoteRowInput[],
  options: ProspectusHistoricalNoteTableOptions = {}
): ProspectusHistoricalNoteTableRow[] {
  const issuerId = nonEmptyString(options.issuerOrganizationId ?? null);
  const currentId = nonEmptyString(options.currentNoteId ?? null);

  return rows
    .filter((row) => {
      if (currentId && row.id === currentId) return false;
      if (issuerId && row.issuerOrganizationId !== issuerId) return false;
      return true;
    })
    .map(buildProspectusHistoricalNoteTableRow);
}
