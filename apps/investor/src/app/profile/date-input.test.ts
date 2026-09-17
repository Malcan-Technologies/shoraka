import { toDateInputValue } from "./date-input";

describe("toDateInputValue", () => {
  it("keeps YYYY-MM-DD as-is", () => {
    expect(toDateInputValue("2026-09-16")).toBe("2026-09-16");
  });

  it("maps Malaysia midnight stored as the previous UTC evening to the civil day", () => {
    expect(toDateInputValue("2026-09-16T00:00:00.000Z")).toBe("2026-09-16");
    expect(toDateInputValue("1989-11-13T16:00:00.000Z")).toBe("1989-11-14");
  });

  it("returns empty string for nullish/invalid inputs", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue("not-a-date")).toBe("");
  });
});

