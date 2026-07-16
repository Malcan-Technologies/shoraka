/**
 * SECTION: Prospectus Page 1 — Timing and Purpose (DATA STAGE 4B)
 * WHY: Investment Summary rows for tenure, maturity date, purpose of financing
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusTimingPurpose {
  tenure: string;
  maturityDate: string;
  purposeOfFinancing: string;
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
   */
  purposeOfFinancing: string | null | undefined;
}

export interface ProspectusTimingPurposeFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "live_application";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_TIMING_PURPOSE_FIELD_SOURCES: Record<
  keyof ProspectusTimingPurpose,
  ProspectusTimingPurposeFieldSource
> = {
  tenure: {
    label: "Tenure",
    canonicalSource:
      "buildProspectusTenureAndMaturity → calculateCalendarDayCount(note_listings.opens_at, notes.maturity_date)",
    availability: "calculated",
    possibleAlternatives: "days remaining; published_at; activated_at — not used",
    notes: "Same helper as Stage 2. Display as \"{n} days\".",
  },
  maturityDate: {
    label: "Maturity date",
    canonicalSource: "notes.maturity_date (via Stage 2 formatProspectusDateUtc)",
    availability: "stored",
    possibleAlternatives: "Invoice.details.maturity_date; schedule due_date — not used",
    notes: "Canva also shows maturity in the meta column; same source both places.",
  },
  purposeOfFinancing: {
    label: "Purpose of financing",
    canonicalSource: "applications.business_details.why_raising_funds.financing_for",
    availability: "live_application",
    possibleAlternatives:
      "how_funds_used; business_plan; what_does_company_do; invoice/contract description — not used",
    notes:
      "Free text from issuer business-details. Not copied into Note snapshots. Requires source_application_id join.",
  },
};
