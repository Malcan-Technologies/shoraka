/**
 * SECTION: Prospectus Page 1 — Return Investor Highlight (DATA STAGE 5C)
 * WHY: Third KEY INVESTOR HIGHLIGHTS item; factual rates only — no Canva marketing claims
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusReturnHighlight {
  annualGrossProfitRate: string;
  tenure: string;
  netOrAfterFeeRate: string;
  returnClassification: string;
  tenureClassification: string;
  highlightTitle: string;
  highlightExplanation: string;
  claimApprovalStatus: string;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusReturnHighlightInput {
  /** notes.profit_rate_percent — annual GROSS before service fee */
  profitRatePercent: number | null | undefined;
  /** note_listings.opens_at — for Stage 2 tenure helper */
  listingOpensAt: Date | string | null | undefined;
  /** notes.maturity_date — for Stage 2 tenure helper */
  maturityDate: Date | string | null | undefined;
  /** notes.service_fee_rate_percent — % of gross profit (for annual net helper) */
  serviceFeeRatePercent: number | null | undefined;
}

export interface ProspectusReturnHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "unresolved";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES: Record<
  keyof ProspectusReturnHighlight,
  ProspectusReturnHighlightFieldSource
> = {
  annualGrossProfitRate: {
    label: "Annual gross profit rate",
    canonicalSource: "notes.profit_rate_percent (via Stage 4A formatProspectusProfitRatePa)",
    availability: "stored",
    possibleAlternatives: "live invoice offer_details.offered_profit_rate_percent — not used",
    notes:
      "Annual GROSS contractual rate before investor service fee. Investor UI: \"Profit rate\"; tooltip says before fee.",
  },
  tenure: {
    label: "Tenure",
    canonicalSource:
      "buildProspectusTenureAndMaturity → calculateCalendarDayCount(opens_at, maturity_date)",
    availability: "calculated",
    possibleAlternatives: "days remaining; activated_at→maturity — not used",
    notes: "Same Stage 2 helper. Display \"{n} days\".",
  },
  netOrAfterFeeRate: {
    label: "Net or after-fee rate",
    canonicalSource:
      "computeNetExpectedReturnRatePercent(profit_rate_percent, service_fee_rate_percent)",
    availability: "calculated",
    possibleAlternatives:
      "Label gross 12% as after fees (Canva) — incorrect; period return % — not used",
    notes:
      "Annual net after fee on profit only. Fee is per-note % of gross profit (product default capped). Marketplace still advertises gross. Needs both rates.",
  },
  returnClassification: {
    label: "Return classification",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Invent \"attractive\" threshold — not used",
    notes: "No stored/helper rule for attractive returns. Canva sample only.",
  },
  tenureClassification: {
    label: "Tenure classification",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Landing/help \"short-term\" marketing copy; invent short/medium/long bands — not used",
    notes: "No approved tenure classifier. Help text calling notes short-term ≠ prospectus rule.",
  },
  highlightTitle: {
    label: "Highlight title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Canva \"Attractive short-term returns\"; factual \"12% p.a. profit rate\" — not approved as prospectus title",
    notes: "Do not ship Canva or invented titles without marketing/compliance approval.",
  },
  highlightExplanation: {
    label: "Highlight explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Canva earn-up-to after-fees copy; auto sentence from gross+tenure — not used",
    notes:
      "No approved explanation. Must not claim after fees, earn up to, attractive, short-term, or period return.",
  },
  claimApprovalStatus: {
    label: "Claim approval status",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Marketing/compliance/legal/risk prospectus claim workflow — missing",
    notes:
      "Needs approval: attractive, short-term, after fees, earn up to, guaranteed. Gross rate + tenure days are factual only.",
  },
};
