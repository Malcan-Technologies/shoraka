/**
 * SECTION: Prospectus Page 1 — Timing and Purpose (DATA STAGE 4B)
 * WHY: Tenure/maturity via Stage 2; purpose = live Application financing_for only
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Audit metadata for live purpose — not Canva-facing. */
export interface ProspectusPurposeAudit {
  sourceType: "live_application";
  isFrozen: false;
  snapshotDecision: "pending";
  canonicalPath: "applications.business_details.why_raising_funds.financing_for";
}

export const PROSPECTUS_PURPOSE_AUDIT: ProspectusPurposeAudit = {
  sourceType: "live_application",
  isFrozen: false,
  snapshotDecision: "pending",
  canonicalPath: "applications.business_details.why_raising_funds.financing_for",
};

/**
 * Flat Canva-facing fields. Listing Closing Date is Stage 2 only — not included here.
 */
export interface ProspectusTimingPurpose {
  tenure: string;
  maturityDate: string;
  purposeOfFinancing: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: {
    purpose: ProspectusPurposeAudit;
  };
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusTimingPurposeInput {
  /** note_listings.opens_at — required for tenure with Stage 2 helper */
  listingOpensAt: Date | string | null | undefined;
  /** notes.maturity_date */
  maturityDate: Date | string | null | undefined;
  /**
   * Live Application join (not frozen on Note):
   * applications.business_details.why_raising_funds.financing_for
   * Free text only — not an enum. Do not pass how_funds_used / business_plan.
   */
  purposeOfFinancing: string | null | undefined;
}

export interface ProspectusTimingPurposeFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "live_application";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES: Record<
  "tenure" | "maturityDate" | "purposeOfFinancing",
  ProspectusTimingPurposeFieldSource
> = {
  tenure: {
    label: "Tenure",
    canonicalSource:
      "buildProspectusTenureAndMaturity → calculateCalendarDayCount(note_listings.opens_at, notes.maturity_date)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives:
      "days remaining; listing countdown; published_at; closes_at; funding_closed_at; activated_at; settlement profitDays — not used",
    notes: "Reuse Stage 2 only. Display as \"{n} days\". closes_at belongs in Stage 2 date/meta only.",
  },
  maturityDate: {
    label: "Maturity Date",
    canonicalSource: "notes.maturity_date (via Stage 2 formatProspectusDateUtc)",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "invoice maturity; payment schedule due_date; contract end; repaid_at — not used",
    notes: "Reuse Stage 2 builder/formatter. No Stage 4B date helper.",
  },
  purposeOfFinancing: {
    label: "Purpose of Financing",
    canonicalSource: "applications.business_details.why_raising_funds.financing_for",
    availability: "live_application",
    surface: "canva",
    possibleAlternatives:
      "how_funds_used; business_plan; what_does_company_do; invoice/contract/product description; financing type; product name — not used",
    notes:
      "Free text (issuer form / zod string max 400). Not frozen on Note. audit.purpose.snapshotDecision = pending. Canva \"Working Capital\" is sample only.",
  },
};
