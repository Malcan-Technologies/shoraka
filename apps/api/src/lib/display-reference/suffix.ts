import crypto from "crypto";
import {
  DISPLAY_REFERENCE_ALPHABET,
  DISPLAY_REFERENCE_RANDOM_LENGTH,
} from "./constants";

const ALPHABET_LENGTH = DISPLAY_REFERENCE_ALPHABET.length;
const UNBIASED_MAX = Math.floor(256 / ALPHABET_LENGTH) * ALPHABET_LENGTH;

export function generateSecureSuffix(length: number = DISPLAY_REFERENCE_RANDOM_LENGTH): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("Suffix length must be a positive integer");
  }

  const chars: string[] = [];
  while (chars.length < length) {
    const bytes = crypto.randomBytes(length);
    for (const value of bytes) {
      if (value >= UNBIASED_MAX) continue;
      chars.push(DISPLAY_REFERENCE_ALPHABET[value % ALPHABET_LENGTH]);
      if (chars.length === length) break;
    }
  }
  return chars.join("");
}
