import {
  compareNullableNumbers,
  compareSortValues,
  nextTableSort,
  sortRowsByColumn,
  sortRowsByNumericColumn,
  timestampOrNull,
} from "./table-sort";

describe("table sort helpers", () => {
  it("starts a new column on descending, then toggles to ascending", () => {
    const first = nextTableSort({ column: null, direction: "desc" }, "amount");
    expect(first).toEqual({ column: "amount", direction: "desc" });
    expect(nextTableSort(first, "amount")).toEqual({ column: "amount", direction: "asc" });
    expect(nextTableSort(first, "committed")).toEqual({ column: "committed", direction: "desc" });
  });

  it("keeps missing values last in both directions", () => {
    expect(compareNullableNumbers(null, 10, "desc")).toBe(1);
    expect(compareNullableNumbers(null, 10, "asc")).toBe(1);
    expect(compareNullableNumbers(10, null, "desc")).toBe(-1);
    expect(compareNullableNumbers(40, 10, "desc")).toBeLessThan(0);
    expect(compareNullableNumbers(40, 10, "asc")).toBeGreaterThan(0);
  });

  it("sorts rows by the active numeric column", () => {
    const rows = [
      { id: "a", value: 10 },
      { id: "b", value: 40 },
      { id: "c", value: null },
    ];
    const sorted = sortRowsByNumericColumn(rows, { column: "value", direction: "desc" }, (row) => row.value);
    expect(sorted.map((row) => row.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts rows alphabetically and keeps blanks last", () => {
    const rows = [
      { id: "a", name: "Zenith" },
      { id: "b", name: "Alpha" },
      { id: "c", name: "" },
    ];
    const sorted = sortRowsByColumn(
      rows,
      { column: "name", direction: "asc" },
      (row) => row.name
    );
    expect(sorted.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(compareSortValues("Zenith", "Alpha", "desc")).toBeLessThan(0);
  });

  it("parses timestamps and rejects invalid dates", () => {
    expect(timestampOrNull("2026-08-18T00:00:00.000Z")).toBe(Date.parse("2026-08-18T00:00:00.000Z"));
    expect(timestampOrNull(null)).toBeNull();
    expect(timestampOrNull("not-a-date")).toBeNull();
  });
});
