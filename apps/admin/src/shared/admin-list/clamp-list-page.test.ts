import { clampListPage } from "./clamp-list-page";

describe("clampListPage", () => {
  it("keeps the requested page while results have not loaded", () => {
    expect(clampListPage(2, 1, false)).toBe(2);
    expect(clampListPage(3, 0, false)).toBe(3);
  });

  it("clamps to the last loaded page once results exist", () => {
    expect(clampListPage(5, 3, true)).toBe(3);
    expect(clampListPage(2, 0, true)).toBe(1);
  });

  it("leaves an in-range page unchanged after load", () => {
    expect(clampListPage(2, 4, true)).toBe(2);
    expect(clampListPage(1, 1, true)).toBe(1);
  });
});
