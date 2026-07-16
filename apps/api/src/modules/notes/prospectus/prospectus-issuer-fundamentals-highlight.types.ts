/**
 * SECTION: Prospectus Page 1 — Issuer Financial-Strength Highlight (DATA STAGE 5B)
 * WHY: Second KEY INVESTOR HIGHLIGHTS item; raw FS exist, narrative claims do not
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusIssuerFundamentalsHighlight {
  financialDataSource: string;
  financialYearsAvailable: string;
  profitabilityEvidence: string;
  leverageEvidence: string;
  highlightTitle: string;
  highlightExplanation: string;
  claimApprovalStatus: string;
  dataFrozenOnNote: string;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusIssuerFundamentalsHighlightInput {
  /**
   * Calendar year keys from applications.financial_statements.unaudited_by_year
   * (e.g. ["2025", "2026"]). Empty/missing → Data not available.
   */
  financialYearsAvailable: string[] | null | undefined;
}

export interface ProspectusIssuerFundamentalsHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "documented" | "live_application" | "unresolved" | "constant";
  possibleAlternatives: string;
  notes: string;
}

/** Confirmed live Application path — not copied into Note snapshots. */
export const PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE =
  "applications.financial_statements (v2: questionnaire + unaudited_by_year); also IssuerOrganizationFinancialStatement";

export const PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES: Record<
  keyof ProspectusIssuerFundamentalsHighlight,
  ProspectusIssuerFundamentalsHighlightFieldSource
> = {
  financialDataSource: {
    label: "Financial data source",
    canonicalSource: PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
    availability: "documented",
    possibleAlternatives:
      "CTOS financial extract columns; notes.issuer_snapshot — issuer_snapshot has no FS fields",
    notes:
      "Unaudited/management-account style inputs. Stored keys: turnover, plnpat, plnpbt, balance-sheet fields. Computed ratios not persisted.",
  },
  financialYearsAvailable: {
    label: "Financial years available",
    canonicalSource: "applications.financial_statements.unaudited_by_year keys",
    availability: "live_application",
    possibleAlternatives: "CTOS latest three financial_year slots (admin review only) — not used",
    notes: "Typically 1–2 FY end calendar years from questionnaire helpers. Live Application data.",
  },
  profitabilityEvidence: {
    label: "Profitability evidence",
    canonicalSource: "none confirmed for highlight claim",
    availability: "unresolved",
    possibleAlternatives:
      "Raw plnpat/turnover; calculateProfitMargin; invent profitable/consistent/improving rules — not used",
    notes:
      "Helpers compute profit_margin only. No rule for profitable vs loss-making, consistent, or improving profitability. turnover_growth always null.",
  },
  leverageEvidence: {
    label: "Leverage evidence",
    canonicalSource: "none confirmed for highlight claim",
    availability: "unresolved",
    possibleAlternatives:
      "calculateGearing(totlib/bsqpuc); invent conservative/high thresholds — not used",
    notes: "Gearing helper exists for analytics; no approved leverage band for investor marketing.",
  },
  highlightTitle: {
    label: "Highlight title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Hardcode Canva \"Strong issuer fundamentals\"; derive from SoukScore/CTOS — not used",
    notes: "No stored title. Do not generate \"strong\" from positive ratios.",
  },
  highlightExplanation: {
    label: "Highlight explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Canva healthy/consistent/conservative copy; admin free text; CTOS narrative — not used",
    notes: "No approved explanation generator or stored copy.",
  },
  claimApprovalStatus: {
    label: "Claim approval status",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Risk/compliance/legal prospectus claim workflow — does not exist",
    notes:
      "Positive fundamentals claims need approval. Admin FS review ≠ investor highlight approval.",
  },
  dataFrozenOnNote: {
    label: "Data frozen on Note",
    canonicalSource: "notes.issuer_snapshot (id, name, type, industry only)",
    availability: "constant",
    possibleAlternatives: "Freeze financial_statements onto Note at publish — not implemented",
    notes: "Financial statements are live Application / org-latest data, not on the Note.",
  },
};
