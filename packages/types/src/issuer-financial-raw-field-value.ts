import { applicationComrepFieldError } from "./application-financial-prefill";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS,
  FINANCIAL_FIELD_LABELS,
} from "./financial-field-labels";

/**
 * Issuer Financial Statements step entry rules, taken from `MoneyInput` and the
 * step's per-field `allowNegative` flags.
 * Issuer submit still uses its own API checks; this helper is the shared value
 * rule for Admin so Admin cannot store a raw value the issuer form will not accept.
 */
export const ISSUER_FINANCIAL_MONEY_MAX_INT_DIGITS = 15;
export const ISSUER_FINANCIAL_MONEY_MAX_DECIMALS = 2;

/** Fields the issuer financial step passes to MoneyInput with `allowNegative`. */
export const ISSUER_FINANCIAL_NEGATIVE_ALLOWED_KEYS = [
  "grossProfit",
  "ebitda",
  "plnpbt",
  "plnpat",
  "netOperatingIncome",
  "plyear",
  "pl_minority",
  "operatingCashFlow",
  "freeCashFlow",
  "equity_accumulated_profit",
] as const;

const NEGATIVE_ALLOWED = new Set<string>(ISSUER_FINANCIAL_NEGATIVE_ALLOWED_KEYS);
const COMREP_KEYS = new Set<string>(APPLICATION_COMREP_DETAIL_KEYS);

export function issuerFinancialFieldAllowsNegative(fieldKey: string): boolean {
  return NEGATIVE_ALLOWED.has(fieldKey);
}

/** Same keystroke filter as issuer `MoneyInput` (`allowEmpty`, 2dp, 15 integer digits). */
export function issuerFinancialMoneyInputAccepted(fieldKey: string, raw: string): boolean {
  if (raw === "") return true;
  const charPattern = issuerFinancialFieldAllowsNegative(fieldKey)
    ? /^-?[\d,]*\.?\d{0,2}$/
    : /^[\d,]*\.?\d{0,2}$/;
  if (!charPattern.test(raw)) return false;
  if ((raw.match(/\./g) ?? []).length > 1) return false;
  const numeric = raw.replace(/,/g, "");
  if (numeric === "" || numeric === "-" || numeric === "." || numeric === "-.") return true;
  const intDigits = numeric.replace(/^-/, "").split(".")[0] ?? "";
  return intDigits.length <= ISSUER_FINANCIAL_MONEY_MAX_INT_DIGITS;
}

function negativeValueMessage(fieldKey: string): string {
  if (fieldKey === "turnover") return "Turnover must be 0 or greater";
  if (COMREP_KEYS.has(fieldKey)) {
    return applicationComrepFieldError(fieldKey, -1) ?? "Enter a valid amount";
  }
  const label = FINANCIAL_FIELD_LABELS[fieldKey] ?? fieldKey;
  return `${label} must be 0 or greater`;
}

/**
 * Value check for one raw financial field.
 * Blank is not a value error (requiredness is separate). Numeric 0 is valid.
 */
export function issuerFinancialRawFieldValueError(fieldKey: string, raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/e/i.test(trimmed)) return "Enter a valid amount";
    const numeric = trimmed.replace(/,/g, "");
    if (numeric === "-" || numeric === "." || numeric === "-.") return "Enter a valid amount";
    if ((numeric.match(/\./g) ?? []).length > 1) return "Enter a valid amount";
    const n = Number(numeric);
    if (!Number.isFinite(n)) return "Enter a valid amount";
    const unsigned = numeric.replace(/^-/, "");
    const [intPart, fraction = ""] = unsigned.split(".");
    if ((intPart ?? "").length > ISSUER_FINANCIAL_MONEY_MAX_INT_DIGITS) return "Enter a valid amount";
    if (fraction.length > ISSUER_FINANCIAL_MONEY_MAX_DECIMALS) return "Maximum 2 decimal places.";
    if (n < 0 && !issuerFinancialFieldAllowsNegative(fieldKey)) return negativeValueMessage(fieldKey);
    if (!issuerFinancialMoneyInputAccepted(fieldKey, trimmed)) return "Enter a valid amount";
    return null;
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) return "Enter a valid amount";
  if (Math.abs(raw) >= 10 ** ISSUER_FINANCIAL_MONEY_MAX_INT_DIGITS) return "Enter a valid amount";
  const cents = raw * 100;
  if (Math.abs(cents - Math.round(cents)) > 1e-6) return "Maximum 2 decimal places.";
  if (raw < 0 && !issuerFinancialFieldAllowsNegative(fieldKey)) return negativeValueMessage(fieldKey);
  return null;
}

export function issuerFinancialNegativeAllowedKeysMatchComrepSubset(): boolean {
  return APPLICATION_COMREP_NEGATIVE_ALLOWED_KEYS.every((key) => NEGATIVE_ALLOWED.has(key));
}
