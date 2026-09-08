import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

const DEFAULT_COUNTRY = "MY" as const;

/**
 * Same phone rule as CashSouk PhoneInput: store E.164.
 * Local Malaysian numbers such as 0182316817 are accepted and normalized
 * with default country MY, matching `defaultCountry="MY"` on existing screens.
 */
export function normalizeProfilePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isValidPhoneNumber(trimmed)) {
    return parsePhoneNumberFromString(trimmed)?.number ?? trimmed;
  }
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
  if (parsed?.isValid()) return parsed.number;
  return null;
}

export function isValidProfilePhone(value: string | null | undefined): boolean {
  return normalizeProfilePhone(value) != null;
}

export function storedProfilePhone(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return value;
  return normalizeProfilePhone(trimmed) ?? trimmed;
}
