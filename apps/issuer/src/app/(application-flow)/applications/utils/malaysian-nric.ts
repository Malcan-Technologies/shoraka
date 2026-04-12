/**
 * SECTION: Malaysian MyKad (NRIC) — digits only
 * WHY: Same pattern as contract customer SSM — no symbols, fixed length.
 * INPUT: Raw string from input/paste
 * OUTPUT: Up to 12 digits only
 * WHERE USED: Business details guarantor IC field
 */

export function malaysianNricDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12);
}

export function isValidMalaysianNric(value: string): boolean {
  return malaysianNricDigits(value).length === 12;
}
