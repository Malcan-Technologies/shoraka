import { MERGE_EMPTY_DISPLAY, mergeNullGetter, visibleMergeScalar } from "./merge-visibility";

describe("visibleMergeScalar", () => {
  it("keeps trimmed source values", () => {
    expect(visibleMergeScalar("issuer_name", "Acme Sdn Bhd")).toBe("Acme Sdn Bhd");
  });

  it("prints N/A for empty or whitespace-only values", () => {
    expect(visibleMergeScalar("grace_period_days", "")).toBe(MERGE_EMPTY_DISPLAY);
    expect(visibleMergeScalar("attention_name", "  ")).toBe(MERGE_EMPTY_DISPLAY);
  });
});

describe("mergeNullGetter", () => {
  it("returns N/A for missing value tags", () => {
    expect(mergeNullGetter({ value: "issuer_name" })).toBe(MERGE_EMPTY_DISPLAY);
  });

  it("leaves loops and raw XML empty", () => {
    expect(mergeNullGetter({ module: "loop" })).toEqual([]);
    expect(mergeNullGetter({ module: "rawxml" })).toBe("");
  });
});
