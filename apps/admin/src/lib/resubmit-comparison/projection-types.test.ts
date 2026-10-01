import {
  blocksHaveChanges,
  comparisonFilesDiffer,
  comparisonRowDiffers,
  comparisonTextValuesDiffer,
  replacedComparisonFiles,
  stagesHaveChanges,
} from "./projection-types";

describe("comparison projection diff helpers", () => {
  it.each([
    [null, ""],
    ["", "—"],
    ["Not provided", null],
    ["  abc ", "abc"],
  ])("treats %p and %p as equal", (before, after) => {
    expect(comparisonTextValuesDiffer(before, after)).toBe(false);
  });

  it("detects a real text change", () => {
    expect(comparisonTextValuesDiffer("RM 1,000.00", "RM 2,000.00")).toBe(true);
  });

  it("ignores file order and secondary lines", () => {
    const a = { s3Key: "k1", fileName: "a.pdf", secondary: "1 KB" };
    const b = { s3Key: "k2", fileName: "b.pdf" };
    expect(comparisonFilesDiffer([a, b], [b, { ...a, secondary: "2 KB" }])).toBe(false);
  });

  it("same filename with a new s3 key differs and is reported as replaced", () => {
    const before = [{ s3Key: "old", fileName: "invoice.pdf" }];
    const after = [{ s3Key: "new", fileName: "invoice.pdf" }];
    expect(comparisonFilesDiffer(before, after)).toBe(true);
    expect(replacedComparisonFiles(before, after)).toEqual(after);
  });

  it("a brand new filename is not reported as replaced", () => {
    expect(
      replacedComparisonFiles([{ s3Key: "a", fileName: "a.pdf" }], [{ s3Key: "b", fileName: "b.pdf" }])
    ).toEqual([]);
  });

  it("rolls up rows into blocks and stages", () => {
    const same = { key: "x", label: "X", kind: "yesno" as const, before: true, after: true };
    const changed = { key: "y", label: "Y", kind: "yesno" as const, before: true, after: false };
    expect(comparisonRowDiffers(same)).toBe(false);
    expect(blocksHaveChanges([{ id: "b", title: "B", rows: [same] }])).toBe(false);
    expect(
      stagesHaveChanges([{ id: "s", title: "S", blocks: [{ id: "b", title: "B", rows: [same, changed] }] }])
    ).toBe(true);
  });
});
