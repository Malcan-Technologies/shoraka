const PRODUCT_CODE_REGEX = /^[A-Z0-9]{2,8}$/;

export function normalizeProductCode(input: string): string {
  return input.trim().toUpperCase();
}

export function assertValidProductCode(code: string): void {
  if (!PRODUCT_CODE_REGEX.test(code)) {
    throw new Error(
      "Invalid product code. Use 2-8 uppercase letters/digits (A-Z, 0-9) with no separators."
    );
  }
}

export function normalizeAndValidateProductCode(input: string): string {
  const normalized = normalizeProductCode(input);
  assertValidProductCode(normalized);
  return normalized;
}

export function isValidProductCode(code: string): boolean {
  return PRODUCT_CODE_REGEX.test(code);
}

export { PRODUCT_CODE_REGEX };
