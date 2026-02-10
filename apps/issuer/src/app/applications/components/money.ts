/**
 * Format a number or numeric string for display (comma + 2dp).
 * Display-only. Never store formatted values in DB.
 */
export function formatMoney(value: number | string) {
  if (value === "" || value === null || value === undefined) return "";

  const num =
    typeof value === "string"
      ? Number(value.replace(/,/g, ""))
      : value;

  if (Number.isNaN(num)) return "";

  return num.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse a formatted money string back into a number.
 * Use before calculations or API calls if needed.
 */
export function parseMoney(value: string) {
  const num = Number(value.replace(/,/g, ""));
  return Number.isNaN(num) ? 0 : num;
}