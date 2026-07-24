/**
 * Shared Admin helpers for aligning Page 2 / Page 3 financial year columns.
 * No formula or Application live-fetch logic.
 */

/** Calendar year from a Page 2 financial header key (FYE ISO or calendar year). */
export function calendarYearFromFinancialHeaderKey(key: string): string {
  if (/^\d{4}$/.test(key)) return key;
  if (/^\d{4}-\d{2}-\d{2}/.test(key)) return key.slice(0, 4);
  const match = key.match(/(\d{4})/);
  return match?.[1] ?? key;
}

/**
 * Single source for Admin Page 2 + Page 3 financial year columns:
 * frozen Page 2 financialComparison.table.yearHeaders from the review payload.
 */
export function selectYearsFromPageTwoFinancialTable(table: {
  yearHeaders: Array<{ key: string }>;
}): string[] {
  return table.yearHeaders.map((header) => calendarYearFromFinancialHeaderKey(header.key));
}
