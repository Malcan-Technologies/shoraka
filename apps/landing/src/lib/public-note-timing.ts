import {
  resolveMarketplaceFilterDays,
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
  return {
    tenorDays: resolveMarketplaceFilterDays(note),
    timing: resolveNoteTimingDisplay(note),
    daysLeft: resolveMarketplaceListingDaysLeft(note.listingClosesAt),
  };
}
