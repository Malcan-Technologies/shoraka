import type { FilterChip } from "./filter-chips";

export const LIST_TOOLBAR_SEARCH_CHIP_ID = "__search";

export function mergeListToolbarFilterChips({
  searchValue,
  onSearchClear,
  appliedFilters,
}: {
  searchValue: string;
  onSearchClear?: () => void;
  appliedFilters: readonly FilterChip[];
}): FilterChip[] {
  const trimmed = searchValue.trim();
  const hasSearchChip = appliedFilters.some(
    (chip) => chip.id === "search" || chip.id === LIST_TOOLBAR_SEARCH_CHIP_ID
  );
  if (!trimmed || !onSearchClear || hasSearchChip) {
    return [...appliedFilters];
  }
  return [
    {
      id: LIST_TOOLBAR_SEARCH_CHIP_ID,
      label: `Search: ${trimmed}`,
      onRemove: onSearchClear,
    },
    ...appliedFilters,
  ];
}
