import {
  parseMalaysiaDateTimeLocal,
  parseNoteDisplayDate,
} from "@cashsouk/types";

export type ExtendCampaignValidationInput = {
  closesAtLocal: string;
  reason: string;
  currentClosesAt?: string | null;
  maturityDate?: string | Date | null;
  now?: Date;
};

/** Client-side guards matching POST /listing/extend. */
export function validateExtendCampaignInput(input: ExtendCampaignValidationInput): string | null {
  if (input.reason.trim().length === 0) {
    return "Enter a reason for extending the campaign.";
  }
  const parsed = parseMalaysiaDateTimeLocal(input.closesAtLocal);
  if (!parsed) {
    return "Enter a valid Malaysia date and time.";
  }
  const now = input.now ?? new Date();
  if (parsed.getTime() <= now.getTime()) {
    return "New closing date must be after the current time.";
  }
  const currentClose = input.currentClosesAt ? new Date(input.currentClosesAt) : null;
  if (
    currentClose &&
    !Number.isNaN(currentClose.getTime()) &&
    parsed.getTime() <= currentClose.getTime()
  ) {
    return "New closing date must be after the current closing date.";
  }
  const maturity = parseNoteDisplayDate(input.maturityDate ?? null);
  if (maturity && parsed.getTime() >= maturity.getTime()) {
    return "New closing date must be before the note's maturity date.";
  }
  return null;
}
