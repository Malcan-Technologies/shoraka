import { formatCurrency } from "@cashsouk/config";
import {
  isNoteOpenForFacilityFeeCollectionWaiver,
  parseInvoiceFeeSchedule,
  type NoteDetail,
} from "@cashsouk/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveNoteFrozenFacilityFeeCollectAmount(note: NoteDetail): number | null {
  const schedule =
    note.feeSchedule ?? parseInvoiceFeeSchedule(asRecord(note.invoiceSnapshot)?.offer_details);
  if (!schedule) return null;
  return schedule.facilityFeeCollectAmount;
}

export function isNoteInCampaignForFacilityFeeWaiver(note: NoteDetail): boolean {
  return isNoteOpenForFacilityFeeCollectionWaiver({
    status: note.status,
    fundingStatus: note.fundingStatus,
  });
}

export function canWaiveNoteFacilityFeeCollection(note: NoteDetail): boolean {
  if (!isNoteInCampaignForFacilityFeeWaiver(note)) return false;
  if (!note.sourceContractId) return false;
  return note.facilityFeeCollectionWaiver?.facilityFeeCollectionWaived !== true;
}

export function noteFacilityFeeCollectionWaiverLabel(note: NoteDetail): string | null {
  const waiver = note.facilityFeeCollectionWaiver;
  if (!waiver?.facilityFeeCollectionWaived) return null;
  const amount = resolveNoteFrozenFacilityFeeCollectAmount(note);
  const amountText = amount == null ? "" : ` of ${formatCurrency(amount)}`;
  const reason = waiver.waivedReason?.trim();
  return reason
    ? `Facility fee collection${amountText} waived for this note. Reason: ${reason}`
    : `Facility fee collection${amountText} waived for this note.`;
}

export function noteFacilityFeeCollectionWaiverHelp(note: NoteDetail): string {
  const amount = resolveNoteFrozenFacilityFeeCollectAmount(note);
  const amountText = amount == null ? "" : ` of ${formatCurrency(amount)}`;
  return `Waive this note's frozen facility-fee collection${amountText} before funding closes. The issuer can see the waived state.`;
}

export function noteFacilityFeeCollectionWaiverConfirmDescription(note: NoteDetail): string {
  const amount = resolveNoteFrozenFacilityFeeCollectAmount(note);
  const collectText =
    amount == null ? "the frozen facility fee" : formatCurrency(amount);
  return `This note will not collect ${collectText} at disbursement. The remainder stays on the facility. A reason is required and is visible to the issuer.`;
}

export function noteFacilityFeeCollectionWaiverButtonLabel(note: NoteDetail): string {
  const amount = resolveNoteFrozenFacilityFeeCollectAmount(note);
  return amount == null
    ? "Waive facility fee collection"
    : `Waive ${formatCurrency(amount)} collection`;
}
