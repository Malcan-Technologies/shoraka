/**
 * SECTION: Prospectus Page 1 — Issuer Track-Record Summary (DATA STAGE 7)
 * WHY: Canva four metrics unresolved; identity/exclusion rules audit-only; no aggregate query yet
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section heading — template wording, not data-driven. */
export const PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING =
  "ISSUER'S TRACK RECORD ON CASH SOUK";

/** Canonical issuer grouping for future historical Note queries. */
export const PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE =
  "notes.issuer_organization_id";

/** Future aggregation must exclude the prospectus Note by id, not by note reference. */
export const PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY = "notes.id";

/**
 * Observational historical Note rows — prove Stage 7 does not aggregate them yet.
 * Candidate statuses listed for documentation only; no prospectus filter is approved.
 */
export interface ProspectusIssuerTrackRecordSampleNote {
  id?: string | null;
  status?: string | null;
  fundedAmount?: number | null;
  targetAmount?: number | null;
  fundingStatus?: string | null;
  activatedAt?: Date | string | null;
}

export interface ProspectusIssuerTrackRecordAudit {
  issuer: {
    groupingKey: typeof PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE;
    currentNoteExclusionKey: typeof PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY;
    currentNoteExcluded: "required";
  };
  totalNotesFunded: {
    status: "unresolved";
    filterDecision: "pending";
    dashboardMetricAvailable: true;
    dashboardMetricReused: false;
  };
  totalAmountFunded: {
    status: "unresolved";
    candidateSource: "notes.funded_amount";
    filterDecision: "pending";
    currentNoteExclusionRequired: true;
  };
  successfulRepayment: {
    status: "unresolved";
    numeratorDecision: "pending";
    denominatorDecision: "pending";
    repaidDoesNotEqualOnTime: true;
  };
  onTimePaymentRate: {
    status: "unresolved";
    dashboardWindow: "six_months";
    dashboardMetricReused: false;
    prospectusWindowDecision: "pending";
  };
  snapshot: {
    isFrozen: false;
    snapshotDecision: "pending";
  };
  claims: {
    approvalRequired: true;
    generatedNarrativeAllowed: false;
  };
}

export const PROSPECTUS_ISSUER_TRACK_RECORD_AUDIT: ProspectusIssuerTrackRecordAudit = {
  issuer: {
    groupingKey: PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
    currentNoteExclusionKey: PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY,
    currentNoteExcluded: "required",
  },
  totalNotesFunded: {
    status: "unresolved",
    filterDecision: "pending",
    dashboardMetricAvailable: true,
    dashboardMetricReused: false,
  },
  totalAmountFunded: {
    status: "unresolved",
    candidateSource: "notes.funded_amount",
    filterDecision: "pending",
    currentNoteExclusionRequired: true,
  },
  successfulRepayment: {
    status: "unresolved",
    numeratorDecision: "pending",
    denominatorDecision: "pending",
    repaidDoesNotEqualOnTime: true,
  },
  onTimePaymentRate: {
    status: "unresolved",
    dashboardWindow: "six_months",
    dashboardMetricReused: false,
    prospectusWindowDecision: "pending",
  },
  snapshot: {
    isFrozen: false,
    snapshotDecision: "pending",
  },
  claims: {
    approvalRequired: true,
    generatedNarrativeAllowed: false,
  },
};

/** Canva-facing track-record fields only. */
export interface ProspectusIssuerTrackRecord {
  sectionHeading: string;
  totalNotesFunded: string;
  totalAmountFunded: string;
  successfulRepayment: string;
  onTimePaymentRate: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusIssuerTrackRecordAudit;
}

/**
 * Optional observational inputs prove dashboard/history values never become Canva metrics.
 * Builder must not query Prisma or implement approved status filters.
 */
export interface ProspectusIssuerTrackRecordInput {
  currentNoteId?: string | null;
  issuerOrganizationId?: string | null;
  historicalNotes?: ProspectusIssuerTrackRecordSampleNote[] | null;
  /** Issuer-dashboard repaymentPerformance.onTimePercent — not prospectus. */
  dashboardOnTimePercent?: number | null;
  dashboardActiveNotesCount?: number | null;
  dashboardCompletedNotesCount?: number | null;
  dashboardPastFinancingAmount?: number | null;
}

export interface ProspectusIssuerTrackRecordFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "unresolved";
  surface: "canva" | "audit";
  notes: string;
}

export const PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "totalNotesFunded"
  | "totalAmountFunded"
  | "successfulRepayment"
  | "onTimePaymentRate",
  ProspectusIssuerTrackRecordFieldSource
> = {
  sectionHeading: {
    label: "Section Heading",
    canonicalSource: "static template wording",
    availability: "static",
    surface: "canva",
    notes: "Exact Canva heading. Not generated from data or marketing claims.",
  },
  totalNotesFunded: {
    label: "Total Notes Funded",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    surface: "canva",
    notes:
      "FilterDecision pending. Do not reuse activeNotesCount + completedNotesCount. Failed/cancelled Notes must not count unless approved. Group by issuer_organization_id; exclude current notes.id.",
  },
  totalAmountFunded: {
    label: "Total Amount Funded",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    surface: "canva",
    notes:
      "Candidate monetary source notes.funded_amount if business rule approved. Not target_amount. No compact \"mil\" formatter yet. Current Note exclusion required.",
  },
  successfulRepayment: {
    label: "Successful Repayment",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    surface: "canva",
    notes:
      "Numerator/denominator pending. REPAID ≠ successful repayment %. REPAID ≠ on-time. Do not treat ACTIVE as failure silently.",
  },
  onTimePaymentRate: {
    label: "On-time Payment Rate",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    surface: "canva",
    notes:
      "Issuer dashboard has six-month schedule onTimePercent — dashboardMetricReused = false. Prospectus window/schedule rules pending.",
  },
};
