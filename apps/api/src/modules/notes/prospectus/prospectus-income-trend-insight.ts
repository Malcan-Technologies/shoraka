/**
 * SECTION: Build Page 3 Income Statement trend insight card
 * WHY: Always-visible summary from same Stage 4A Revenue (turnover) + PAT (plnpat) years
 */

import { parseProspectusFinancialNumber } from "./prospectus-financial-comparison-metrics";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import {
  PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES,
  type ProspectusIncomeTrendInsight,
  type ProspectusIncomeTrendState,
} from "./prospectus-income-trend-insight.types";
import { computeProspectusTrendDirection } from "./prospectus-trend-direction";

function fieldFromRaw(raw: Record<string, unknown>, key: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) return null;
  return parseProspectusFinancialNumber(raw[key]);
}

/**
 * Map shared trend direction + consistency into the income-insight state catalogue.
 * Reuses Coverage trend math (1% threshold, monotonic checks) without changing arrow rendering.
 */
export function classifyProspectusIncomeTrendState(
  values: ReadonlyArray<number | null | undefined>
): ProspectusIncomeTrendState {
  const result = computeProspectusTrendDirection({
    values,
    meaning: "higher_is_favourable",
  });
  if (!result.approved || result.direction === "unavailable") {
    return "unavailable";
  }
  if (result.direction === "up" && result.consistency === "consistent") {
    return "consistent_up";
  }
  if (result.direction === "down" && result.consistency === "consistent") {
    return "consistent_down";
  }
  return "neutral_or_mixed";
}

function messageForStates(
  revenueState: ProspectusIncomeTrendState,
  profitState: ProspectusIncomeTrendState
): ProspectusIncomeTrendInsight["message"] {
  if (revenueState === "unavailable" || profitState === "unavailable") {
    return PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.unavailable;
  }
  if (revenueState === "consistent_up" && profitState === "consistent_up") {
    return PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_up;
  }
  if (revenueState === "consistent_down" && profitState === "consistent_down") {
    return PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.both_down;
  }
  // One side clearly up, the other only mixed/neutral — not opposite directional trends.
  if (revenueState === "consistent_up" && profitState === "neutral_or_mixed") {
    return PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.revenue_up_profit_mixed;
  }
  if (profitState === "consistent_up" && revenueState === "neutral_or_mixed") {
    return PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.profit_up_revenue_mixed;
  }
  // Includes opposite trends (up vs down), down+mixed, both mixed/neutral.
  return PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.mixed;
}

/**
 * Builds the always-visible Income Statement insight from the same selected years
 * as Page 3 Income Statement (turnover + plnpat only).
 */
export function buildProspectusIncomeTrendInsight(
  financialSource: ProspectusFinancialComparisonSource
): ProspectusIncomeTrendInsight {
  const years = financialSource.years;
  if (years.length !== 3 || years.some((year) => year.isPlaceholder === true)) {
    return {
      message: PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES.unavailable,
      revenueState: "unavailable",
      profitState: "unavailable",
    };
  }

  const revenueValues = years.map((year) => fieldFromRaw(year.rawFinancials, "turnover"));
  const profitValues = years.map((year) => fieldFromRaw(year.rawFinancials, "plnpat"));

  const revenueState = classifyProspectusIncomeTrendState(revenueValues);
  const profitState = classifyProspectusIncomeTrendState(profitValues);

  return {
    message: messageForStates(revenueState, profitState),
    revenueState,
    profitState,
  };
}
