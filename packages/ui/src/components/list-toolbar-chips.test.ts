import { LIST_TOOLBAR_SEARCH_CHIP_ID, mergeListToolbarFilterChips } from "./list-toolbar-chips";

describe("mergeListToolbarFilterChips", () => {
  it("adds a search badge when the query is set", () => {
    const onSearchClear = jest.fn();
    const chips = mergeListToolbarFilterChips({
      searchValue: "  Acme  ",
      onSearchClear,
      appliedFilters: [{ id: "status", label: "Status: Active", onRemove: () => undefined }],
    });
    expect(chips[0]).toMatchObject({
      id: LIST_TOOLBAR_SEARCH_CHIP_ID,
      label: "Search: Acme",
    });
    chips[0]?.onRemove();
    expect(onSearchClear).toHaveBeenCalledTimes(1);
    expect(chips).toHaveLength(2);
  });

  it("does not duplicate an existing search chip", () => {
    const chips = mergeListToolbarFilterChips({
      searchValue: "Acme",
      onSearchClear: () => undefined,
      appliedFilters: [{ id: "search", label: "Search: Acme", onRemove: () => undefined }],
    });
    expect(chips).toHaveLength(1);
    expect(chips[0]?.id).toBe("search");
  });
});
