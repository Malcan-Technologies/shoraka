import {
  resolveMarketplaceListingDaysLeft,
  resolveNoteTimingDisplay,
  type NoteListItem,
  type NoteTimingDisplay,
} from "@cashsouk/types";

export type PublicNoteTimingFields = {
  tenorDays: number | null;
  timing: NoteTimingDisplay;
  daysLeft: number | null;
};

export function mapPublicNoteTiming(note: NoteListItem): PublicNoteTimingFields {
  const timing = resolveNoteTimingDisplay(note);
  return {
    tenorDays: timing.tenureDays,
    timing,
    daysLeft: resolveMarketplaceListingDaysLeft(note.listingClosesAt),
  };
}
