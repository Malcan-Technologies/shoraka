/** API list endpoints cap pageSize at 100. Extra page numbers after the first. */
export function remainingPaginationPages(totalPages: number): number[] {
  if (!Number.isFinite(totalPages) || totalPages <= 1) return [];
  return Array.from({ length: Math.floor(totalPages) - 1 }, (_, index) => index + 2);
}
