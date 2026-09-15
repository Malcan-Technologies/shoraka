import { toDateInputValue } from "./date-input";

describe("toDateInputValue", () => {
  it("keeps YYYY-MM-DD as-is", () => {
    expect(toDateInputValue("2026-09-16")).toBe("2026-09-16");
  });

  it("extracts YYYY-MM-DD prefix from ISO strings", () => {
    expect(toDateInputValue("2026-09-16T00:00:00.000Z")).toBe("2026-09-16");
  });

  it("returns empty string for nullish/invalid inputs", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue("not-a-date")).toBe("");
  });
});

