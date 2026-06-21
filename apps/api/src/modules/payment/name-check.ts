import { NameCheckResult } from "@prisma/client";

/**
 * Normalize a person/company name for AML exact match:
 * uppercase, collapse whitespace, strip punctuation.
 */
export function normalizeNameForCheck(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export type NameCheckInput = {
  expectedName: string | null | undefined;
  payerName: string | null | undefined;
};

/** Discrete name-check step — consumed by M5 webhook handler and M7 admin verify. */
export function runNameCheck(input: NameCheckInput): NameCheckResult {
  if (!input.payerName?.trim()) {
    return NameCheckResult.NAME_UNAVAILABLE;
  }

  const normalizedPayer = normalizeNameForCheck(input.payerName);
  if (!normalizedPayer) {
    return NameCheckResult.NAME_UNAVAILABLE;
  }

  if (!input.expectedName?.trim()) {
    return NameCheckResult.NAME_UNAVAILABLE;
  }

  const normalizedExpected = normalizeNameForCheck(input.expectedName);
  if (!normalizedExpected) {
    return NameCheckResult.NAME_UNAVAILABLE;
  }

  return normalizedPayer === normalizedExpected
    ? NameCheckResult.PASS
    : NameCheckResult.FAIL;
}
