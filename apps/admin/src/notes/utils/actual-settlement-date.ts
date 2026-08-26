import {
  isTenureBackedNote,
  malaysiaTodayYmd,
  resolveDefaultActualSettlementYmd,
  validateActualSettlementDate,
} from "@cashsouk/types";

export const ACTUAL_SETTLEMENT_DATE_LABEL = "Actual settlement date";
export const ACTUAL_SETTLEMENT_DATE_HELPER =
  "Profit stops on this date when settlement clears early.";
export const ACTUAL_SETTLEMENT_DATE_TOOLTIP =
  "Use the bank value date when the funds cleared, not the date you update this status.";

export function noteNeedsActualSettlementDate(note: { tenureDays?: number | null }): boolean {
  return isTenureBackedNote(note.tenureDays);
}

export function defaultActualSettlementDate(
  latestIncludedReceiptDate?: Date | string | null,
  now: Date = new Date()
): string {
  return resolveDefaultActualSettlementYmd(latestIncludedReceiptDate, now);
}

export function actualSettlementDateError(
  value: string,
  options: {
    now?: Date;
    disbursementDate?: Date | string | null;
    latestIncludedReceiptDate?: Date | string | null;
  } = {}
): string | null {
  const result = validateActualSettlementDate(value, options);
  return result.ok ? null : result.message;
}

export function malaysiaTodayForInput(now: Date = new Date()): string {
  return malaysiaTodayYmd(now);
}
