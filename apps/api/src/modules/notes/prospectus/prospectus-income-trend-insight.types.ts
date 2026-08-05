/**
 * SECTION: Page 3 Income Statement trend insight card types
 * WHY: Fixed six-message catalogue from Revenue + PAT monotonic pattern only
 */

export type ProspectusIncomeTrendState =
  | "consistent_up"
  | "consistent_down"
  | "neutral_or_mixed"
  | "unavailable";

/** Visual tone for the insight card — derived from states, never from message text. */
export type ProspectusIncomeTrendInsightTone = "positive" | "negative" | "neutral";

export const PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES = {
  both_up:
    "Revenue and profit show consistent growth over the past three financial years.",
  revenue_up_profit_mixed:
    "Revenue has grown, while profit performance remains mixed over the past three financial years.",
  profit_up_revenue_mixed:
    "Profit has improved, while revenue performance remains mixed over the past three financial years.",
  both_down:
    "Revenue and profit have declined over the past three financial years.",
  mixed:
    "Revenue and profit performance has been mixed over the past three financial years.",
  unavailable:
    "Insufficient financial data is available to determine the three-year revenue and profit trend.",
} as const;

export type ProspectusIncomeTrendInsightMessage =
  (typeof PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES)[keyof typeof PROSPECTUS_INCOME_TREND_INSIGHT_MESSAGES];

export interface ProspectusIncomeTrendInsight {
  message: ProspectusIncomeTrendInsightMessage;
  tone: ProspectusIncomeTrendInsightTone;
  /** Internal classification — not shown in investor UI. */
  revenueState: ProspectusIncomeTrendState;
  /** Internal classification — not shown in investor UI. */
  profitState: ProspectusIncomeTrendState;
}
