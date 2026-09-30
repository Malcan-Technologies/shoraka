/**
 * SECTION: Canonical JSON numbers
 * WHY: Prisma rounds 17-significant-digit numbers to 16 when writing a Json column, so a value
 * that is hashed or compared must hold the same digits before and after storage
 */

/**
 * Fractional numbers become 15 significant digits, which round-trip through storage exactly.
 * Safe integers, non-numbers and non-finite numbers are unchanged; plain objects and arrays are
 * copied recursively (input is not mutated); other objects (Date, Decimal) pass through as-is.
 */
export function canonicalizeJsonNumbers<T>(value: T): T {
  return canonicalizeJsonValue(value) as T;
}

function canonicalizeJsonValue(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isSafeInteger(value)) return value;
    return Number(value.toPrecision(15));
  }
  if (Array.isArray(value)) return value.map(canonicalizeJsonValue);
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = canonicalizeJsonValue(item);
    return out;
  }
  return value;
}
