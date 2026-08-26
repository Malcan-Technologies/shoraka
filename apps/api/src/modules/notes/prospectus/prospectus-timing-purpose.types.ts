/**
 * SECTION: Prospectus Page 1 — Timing and Purpose (DATA STAGE 4B)
 * WHY: Tenure/maturity via Stage 2; purpose from frozen notes.purpose_snapshot.financing_for
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusPurposeAudit {
  sourceType: "note_purpose_snapshot";
  isFrozen: true;
  snapshotDecision: "frozen_at_note_create";
  canonicalPath: "notes.purpose_snapshot.financing_for";
  originalPath: "applications.business_details.why_raising_funds.financing_for";
}

export const PROSPECTUS_PURPOSE_AUDIT: ProspectusPurposeAudit = {
  sourceType: "note_purpose_snapshot",
  isFrozen: true,
  snapshotDecision: "frozen_at_note_create",
  canonicalPath: "notes.purpose_snapshot.financing_for",
  originalPath: "applications.business_details.why_raising_funds.financing_for",
};

export interface ProspectusTimingPurpose {
  tenure: string;
  maturityDate: string;
  purposeOfFinancing: string;
  audit: {
    purpose: ProspectusPurposeAudit;
  };
}

export interface ProspectusTimingPurposeInput {
  listingOpensAt: Date | string | null | undefined;
  maturityDate: Date | string | null | undefined;
  tenureDays?: number | null;
  /** Frozen notes.purpose_snapshot.financing_for only. */
  purposeSnapshotFinancingFor: string | null | undefined;
  /** Observational live Application text — must not be used as fallback. */
  liveApplicationFinancingFor?: string | null;
}

export interface ProspectusTimingPurposeFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated";
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
      "notes.tenure_days when set; else calculateCalendarDayCount(note_listings.opens_at, notes.maturity_date)",
    availability: "calculated",
    surface: "canva",
    possibleAlternatives: "days remaining; closes_at; funding_closed_at — not used",
    notes: "Reuse Stage 2 only.",
  },
  maturityDate: {
    label: "Maturity Date",
    canonicalSource:
      "notes.maturity_date when set; else notes.tenure_days (“{n} days from disbursement”)",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "invoice maturity; repaid_at — not used",
    notes: "Reuse Stage 2 builder/formatter.",
  },
  purposeOfFinancing: {
    label: "Purpose of Financing",
    canonicalSource: "notes.purpose_snapshot.financing_for",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "live Application financing_for; how_funds_used; business_plan — not used at render",
    notes:
      "Frozen at Note create from applications.business_details.why_raising_funds.financing_for. Old Notes without snapshot → —.",
  },
};
