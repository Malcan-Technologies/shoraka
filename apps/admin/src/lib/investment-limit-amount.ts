import { isNoteMoneyAmount } from "@cashsouk/types";

export const INVESTMENT_LIMITS_TAB_HELP =
  "Caps each investor account's outstanding principal at any one time. Headroom frees when a note is settled, when funding fails and the commitment is released, or when the note is marked defaulted. Cash already in the wallet and deposits still being processed also reduce how much the investor can deposit. Leave a field blank for no limit.";

export type InvestmentLimitParseResult =
  | { ok: true; value: number | null }
  | { ok: false; reason: "not-a-number" | "too-many-decimals" };

export function parseInvestmentLimitAmount(amount: string): InvestmentLimitParseResult {
  const trimmed = amount.trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, reason: "not-a-number" };
  }
  if (!isNoteMoneyAmount(parsed)) {
    return { ok: false, reason: "too-many-decimals" };
  }
  return { ok: true, value: parsed };
}

export function investmentLimitParseError(
  label: string,
  reason: "not-a-number" | "too-many-decimals"
): string {
  if (reason === "too-many-decimals") {
    return `${label} can have up to 2 decimal places`;
  }
  return `${label} must be a number of 0 or more, or left blank for no limit`;
}
