import { collectVisibleRecords } from "./visible-query";

describe("collectVisibleRecords", () => {
  it("skips hidden rows until it collects a full visible page", async () => {
    const rows = Array.from({ length: 80 }, (_, index) => ({
      id: `row-${index}`,
      visible: index >= 55,
    }));

    const fetched: Array<{ skip: number; take: number }> = [];
    const visible = await collectVisibleRecords(
      async (skip, take) => {
        fetched.push({ skip, take });
        return rows.slice(skip, skip + take);
      },
      (record) => record.visible,
      { offset: 0, limit: 5 }
    );

    expect(visible.map((row) => row.id)).toEqual([
      "row-55",
      "row-56",
      "row-57",
      "row-58",
      "row-59",
    ]);
    expect(fetched.length).toBeGreaterThan(1);
  });

  it("returns a deep visible page after many hidden rows", async () => {
    const rows = Array.from({ length: 80 }, (_, index) => ({
      id: `row-${index}`,
      visible: index % 4 === 0,
    }));

    const visible = await collectVisibleRecords(
      async (skip, take) => rows.slice(skip, skip + take),
      (record) => record.visible,
      { offset: 10, limit: 5 }
    );

    expect(visible.map((row) => row.id)).toEqual([
      "row-40",
      "row-44",
      "row-48",
      "row-52",
      "row-56",
    ]);
  });
});
