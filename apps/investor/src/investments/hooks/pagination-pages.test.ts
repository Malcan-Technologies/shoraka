import { remainingPaginationPages } from "./pagination-pages";

describe("remainingPaginationPages", () => {
  it("returns extra page numbers after the first", () => {
    expect(remainingPaginationPages(1)).toEqual([]);
    expect(remainingPaginationPages(0)).toEqual([]);
    expect(remainingPaginationPages(3)).toEqual([2, 3]);
  });
});
