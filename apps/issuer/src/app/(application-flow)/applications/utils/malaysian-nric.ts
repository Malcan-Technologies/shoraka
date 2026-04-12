/**
 * SECTION: Malaysian MyKad (NRIC) — digits only
 * WHY: Same pattern as contract customer SSM; strict length checked on save.
 * INPUT: Raw string from input/paste
 * OUTPUT: Digits only
 * WHERE USED: Business details guarantor IC field
 */

const INPUT_MAX_DIGITS = 12;

/** All digits from value (no length cap). Use for validation and API payload. */
export function malaysianNricDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Strips non-digits and caps at 12 (hydration from saved JSON). */
export function clampGuarantorIcInput(raw: string): string {
  return malaysianNricDigits(raw).slice(0, INPUT_MAX_DIGITS);
}

export function isValidMalaysianNric(value: string): boolean {
  return malaysianNricDigits(value).length === 12;
}
