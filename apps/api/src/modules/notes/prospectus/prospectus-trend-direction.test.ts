import {
  PROSPECTUS_TREND_NEUTRAL_RELATIVE_THRESHOLD,
  computeProspectusTrendDirection,
} from "./prospectus-trend-direction";

describe("computeProspectusTrendDirection", () => {
  it("uses 1% relative neutral threshold", () => {
    expect(PROSPECTUS_TREND_NEUTRAL_RELATIVE_THRESHOLD).toBe(0.01);
  });

  it("marks higher-is-favourable Interest Coverage consistent increase as favourable up", () => {
    const result = computeProspectusTrendDirection({
      values: [2.0, 3.0, 4.0],
      meaning: "higher_is_favourable",
    });
    expect(result).toMatchObject({
      direction: "up",
      consistency: "consistent",
      interpretation: "favourable",
      approved: true,
    });
    expect(result.accessibleLabel).toContain("Consistent increase");
    expect(result.accessibleLabel).toContain("favourable");
  });

  it("marks higher-is-favourable Interest Coverage consistent decrease as unfavourable down", () => {
    const result = computeProspectusTrendDirection({
      values: [4.0, 3.0, 2.0],
      meaning: "higher_is_favourable",
    });
    expect(result).toMatchObject({
      direction: "down",
      consistency: "consistent",
      interpretation: "unfavourable",
      approved: true,
    });
  });

  it("marks lower-is-favourable Receivables Days decrease as favourable down", () => {
    const result = computeProspectusTrendDirection({
      values: [90, 70, 50],
      meaning: "lower_is_favourable",
    });
    expect(result).toMatchObject({
      direction: "down",
      consistency: "consistent",
      interpretation: "favourable",
      approved: true,
    });
  });

  it("marks lower-is-favourable Debt / Equity increase as unfavourable up", () => {
    const result = computeProspectusTrendDirection({
      values: [0.5, 0.8, 1.2],
      meaning: "lower_is_favourable",
    });
    expect(result).toMatchObject({
      direction: "up",
      consistency: "consistent",
      interpretation: "unfavourable",
      approved: true,
    });
  });

  it("keeps Payables Days context-dependent with muted meaning", () => {
    const result = computeProspectusTrendDirection({
      values: [90, 60, 30],
      meaning: "context_dependent",
    });
    expect(result).toMatchObject({
      direction: "down",
      consistency: "consistent",
      interpretation: "context_dependent",
      approved: true,
    });
    expect(result.accessibleLabel).toContain("context-dependent");
  });

  it("labels mixed overall increase without calling it consistent", () => {
    const result = computeProspectusTrendDirection({
      values: [10, 15, 12],
      meaning: "higher_is_favourable",
    });
    expect(result).toMatchObject({
      direction: "up",
      consistency: "mixed",
      interpretation: "favourable",
      approved: true,
    });
    expect(result.accessibleLabel).toContain("mixed");
    expect(result.accessibleLabel).not.toContain("Consistent increase");
  });

  it("treats equal values and sub-1% moves as neutral", () => {
    expect(
      computeProspectusTrendDirection({
        values: [1.5, 1.5, 1.5],
        meaning: "higher_is_favourable",
      })
    ).toMatchObject({
      direction: "neutral",
      consistency: "consistent",
      interpretation: "neutral",
      approved: true,
    });

    expect(
      computeProspectusTrendDirection({
        values: [100, 100.4, 100.5],
        meaning: "higher_is_favourable",
      })
    ).toMatchObject({
      direction: "neutral",
      interpretation: "neutral",
      approved: true,
    });
  });

  it("returns unavailable when any year is missing", () => {
    const result = computeProspectusTrendDirection({
      values: [1.0, null, 1.3],
      meaning: "higher_is_favourable",
    });
    expect(result).toMatchObject({
      direction: "unavailable",
      consistency: "unavailable",
      interpretation: "unavailable",
      approved: false,
    });
  });

  it("handles zero and negative cash-flow series without division errors", () => {
    expect(
      computeProspectusTrendDirection({
        values: [0, 0, 0],
        meaning: "higher_is_favourable",
      })
    ).toMatchObject({ direction: "neutral", approved: true });

    expect(
      computeProspectusTrendDirection({
        values: [0, 1, 2],
        meaning: "higher_is_favourable",
      })
    ).toMatchObject({
      direction: "up",
      consistency: "consistent",
      interpretation: "favourable",
      approved: true,
    });

    expect(
      computeProspectusTrendDirection({
        values: [-5, -2, 1],
        meaning: "higher_is_favourable",
      })
    ).toMatchObject({
      direction: "up",
      consistency: "consistent",
      interpretation: "favourable",
      approved: true,
    });

    expect(
      computeProspectusTrendDirection({
        values: [2, -1, -3],
        meaning: "higher_is_favourable",
      })
    ).toMatchObject({
      direction: "down",
      consistency: "consistent",
      interpretation: "unfavourable",
      approved: true,
    });
  });
});
