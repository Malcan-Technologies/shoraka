/**
 * Converts API `dateOfBirth` values into the string format required by
 * `<input type="date" />`, which expects `YYYY-MM-DD`.
 */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";

  // Already in the format <input type="date"> expects.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // ISO strings include time; keep the date portion (UTC prefix).
  const prefix = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix?.[1]) return prefix[1];

  // Fallback: attempt to parse and serialize back to ISO date.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

