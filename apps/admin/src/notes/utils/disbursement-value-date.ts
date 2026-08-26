import { malaysiaTodayYmd, validateDisbursementValueDate } from "@cashsouk/types";

export const DISBURSEMENT_VALUE_DATE_LABEL = "Actual disbursement date";
export const DISBURSEMENT_VALUE_DATE_HELPER = "Profit starts on this date.";
export const DISBURSEMENT_VALUE_DATE_TOOLTIP =
  "Use the bank value date, not the date you update this status.";

export function noteNeedsDisbursementValueDate(note: {
  tenureDays?: number | null;
}): boolean {
  return note.tenureDays != null;
}

export function defaultDisbursementValueDate(now: Date = new Date()): string {
  return malaysiaTodayYmd(now);
}

export function disbursementValueDateError(
  value: string,
  now: Date = new Date()
): string | null {
  const result = validateDisbursementValueDate(value, now);
  return result.ok ? null : result.message;
}
