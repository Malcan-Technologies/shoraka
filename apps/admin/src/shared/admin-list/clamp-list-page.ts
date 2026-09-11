/**
 * Keep the requested page while a list query has not resolved.
 * Unresolved results look like 0 rows / 1 page and would snap pagination back to 1.
 */
export function clampListPage(
  page: number,
  totalPages: number,
  hasLoadedResult: boolean
): number {
  if (!hasLoadedResult) return page;
  const safeTotalPages = Math.max(1, totalPages);
  return page > safeTotalPages ? safeTotalPages : page;
}
