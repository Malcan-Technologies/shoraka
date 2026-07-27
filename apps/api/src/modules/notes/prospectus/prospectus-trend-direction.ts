/**
 * SECTION: Page 3 coverage Trend (3-Yr) direction rules
 * WHY: Honest oldest→newest arrows; meaning via colour/label, not reversed arrows
 */

export type ProspectusTrendDirection = "up" | "down" | "neutral" | "unavailable";

export type ProspectusTrendConsistency = "consistent" | "mixed" | "unavailable";

export type ProspectusTrendInterpretation =
  | "favourable"
  | "unfavourable"
  | "neutral"
  | "context_dependent"
  | "unavailable";

export type ProspectusTrendMeaningClass =
  | "higher_is_favourable"
  | "lower_is_favourable"
  | "context_dependent";

/** Relative change below this band is treated as no meaningful movement. */
export const PROSPECTUS_TREND_NEUTRAL_RELATIVE_THRESHOLD = 0.01;

export type ProspectusTrendResult = {
  direction: ProspectusTrendDirection;
  consistency: ProspectusTrendConsistency;
  interpretation: ProspectusTrendInterpretation;
  accessibleLabel: string;
  /** Display token: Heroicon when available; otherwise —. */
  approved: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Requires exactly three finite year values in chronological oldest→newest order.
 */
export function resolveProspectusTrendSeries(
  values: ReadonlyArray<number | null | undefined>
): [number, number, number] | null {
  if (values.length !== 3) return null;
  const [oldest, middle, newest] = values;
  if (!isFiniteNumber(oldest) || !isFiniteNumber(middle) || !isFiniteNumber(newest)) {
    return null;
  }
  return [oldest, middle, newest];
}

function relativeChange(oldest: number, newest: number): number | null {
  if (oldest === 0) return null;
  return Math.abs(newest - oldest) / Math.abs(oldest);
}

function isNeutralMovement(oldest: number, newest: number): boolean {
  if (oldest === newest) return true;
  if (oldest === 0) return false;
  const rel = relativeChange(oldest, newest);
  return rel != null && rel < PROSPECTUS_TREND_NEUTRAL_RELATIVE_THRESHOLD;
}

function physicalDirection(oldest: number, newest: number): Exclude<ProspectusTrendDirection, "unavailable"> {
  if (isNeutralMovement(oldest, newest)) return "neutral";
  if (newest > oldest) return "up";
  if (newest < oldest) return "down";
  return "neutral";
}

function consistencyFor(
  oldest: number,
  middle: number,
  newest: number,
  direction: Exclude<ProspectusTrendDirection, "unavailable">
): ProspectusTrendConsistency {
  if (direction === "neutral") return "consistent";

  const nonDecreasing = oldest <= middle && middle <= newest;
  const nonIncreasing = oldest >= middle && middle >= newest;
  const hasIncrease = oldest < middle || middle < newest;
  const hasDecrease = oldest > middle || middle > newest;

  if (direction === "up" && nonDecreasing && hasIncrease) return "consistent";
  if (direction === "down" && nonIncreasing && hasDecrease) return "consistent";
  return "mixed";
}

function interpretationFor(
  direction: Exclude<ProspectusTrendDirection, "unavailable">,
  meaning: ProspectusTrendMeaningClass
): ProspectusTrendInterpretation {
  if (direction === "neutral") return "neutral";
  if (meaning === "context_dependent") return "context_dependent";
  if (meaning === "higher_is_favourable") {
    return direction === "up" ? "favourable" : "unfavourable";
  }
  // lower_is_favourable
  return direction === "down" ? "favourable" : "unfavourable";
}

function accessibleLabelFor(
  direction: Exclude<ProspectusTrendDirection, "unavailable">,
  consistency: ProspectusTrendConsistency,
  interpretation: ProspectusTrendInterpretation
): string {
  if (direction === "neutral") return "No meaningful change";

  const movement =
    direction === "up"
      ? consistency === "consistent"
        ? "Consistent increase"
        : "Overall increase with mixed yearly movement"
      : consistency === "consistent"
        ? "Consistent decrease"
        : "Overall decrease with mixed yearly movement";

  if (interpretation === "context_dependent") {
    return `${direction === "up" ? "Increase" : "Decrease"}; business impact is context-dependent`;
  }
  if (interpretation === "favourable") {
    return `${movement}; normally favourable`;
  }
  if (interpretation === "unfavourable") {
    return `${movement}; normally unfavourable`;
  }
  return movement;
}

export function computeProspectusTrendDirection(input: {
  values: ReadonlyArray<number | null | undefined>;
  meaning: ProspectusTrendMeaningClass;
}): ProspectusTrendResult {
  const series = resolveProspectusTrendSeries(input.values);
  if (!series) {
    return {
      direction: "unavailable",
      consistency: "unavailable",
      interpretation: "unavailable",
      accessibleLabel:
        "Trend unavailable because three valid years are not available",
      approved: false,
    };
  }

  const [oldest, middle, newest] = series;
  const direction = physicalDirection(oldest, newest);
  const consistency = consistencyFor(oldest, middle, newest, direction);
  const interpretation = interpretationFor(direction, input.meaning);

  return {
    direction,
    consistency,
    interpretation,
    accessibleLabel: accessibleLabelFor(direction, consistency, interpretation),
    approved: true,
  };
}

/** Coverage metrics that receive Trend (3-Yr) calculation. */
export const PROSPECTUS_COVERAGE_TREND_MEANING: Record<
  | "operating_cash_flow"
  | "free_cash_flow"
  | "interest_coverage"
  | "dscr"
  | "debt_equity"
  | "return_on_equity"
  | "return_on_assets"
  | "receivables_days"
  | "payables_days"
  | "asset_turnover",
  ProspectusTrendMeaningClass
> = {
  operating_cash_flow: "higher_is_favourable",
  free_cash_flow: "higher_is_favourable",
  interest_coverage: "higher_is_favourable",
  dscr: "higher_is_favourable",
  debt_equity: "lower_is_favourable",
  return_on_equity: "higher_is_favourable",
  return_on_assets: "higher_is_favourable",
  receivables_days: "lower_is_favourable",
  payables_days: "context_dependent",
  asset_turnover: "higher_is_favourable",
};
