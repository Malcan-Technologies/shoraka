import { isNoteOpenForFacilityFeeCollectionWaiver, type NoteDetail } from "@cashsouk/types";

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
  const reason = waiver.waivedReason?.trim();
  return reason
    ? `Facility fee collection waived for this note. Reason: ${reason}`
    : "Facility fee collection waived for this note.";
}
