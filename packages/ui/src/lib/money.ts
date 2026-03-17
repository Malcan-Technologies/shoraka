/**
 * Format a number or numeric string for display (comma + 2dp).
 * Display-only. Never store formatted values in DB.
 */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === "" || value === null || value === undefined) return "";
  const num =
    typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse a numeric string OR number into a clean number.
 * Use before calculations or API calls.
 */
export function parseMoney(value: string | number | null | undefined): number {
  if (value === "" || value === null || value === undefined) return 0;
  const num =
    typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Format a number for display with currency symbol (RM).
 * Use for display in modals, dashboards, etc.
 * Returns emptyLabel for null/undefined/NaN.
 */
export function formatMoneyDisplay(
  value: number | string | null | undefined | unknown,
  emptyLabel = "—"
): string {
  if (value === "" || value === null || value === undefined) return emptyLabel;
  const num =
    typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  if (Number.isNaN(num)) return emptyLabel;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
