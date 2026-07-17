/**
 * SECTION: Prospectus Page 1 — Issuer Track-Record Summary (DATA STAGE 7)
 * WHY: Summary before historical table; issuer-dashboard aggregates exist but prospectus rules do not
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusIssuerTrackRecord {
  issuerIdentitySource: string;
  previousIssuedNotes: string;
  successfullyFundedNotes: string;
  activeNotes: string;
  fullyRepaidNotes: string;
  totalHistoricalAmountRaised: string;
  onTimeRepaymentRate: string;
  defaultCount: string;
  averageInvestorReturn: string;
  trackRecordSummaryTitle: string;
  trackRecordSummaryExplanation: string;
  dataFrozenOnCurrentNote: string;
}

/** No approved prospectus aggregates yet — builder does not invent filters. */
export type ProspectusIssuerTrackRecordInput = Record<string, never>;

export interface ProspectusIssuerTrackRecordFieldSource {
  label: string;
  canonicalSource: string;
  availability: "documented" | "unresolved" | "constant";
  possibleAlternatives: string;
  notes: string;
}

/** Canonical grouping for issuer history (live Note FK, not display name). */
export const PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE =
  "notes.issuer_organization_id";

export const PROSPECTUS_ISSUER_TRACK_RECORD_FIELD_SOURCES: Record<
  keyof ProspectusIssuerTrackRecord,
  ProspectusIssuerTrackRecordFieldSource
> = {
  issuerIdentitySource: {
    label: "Issuer identity source",
    canonicalSource: PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
    availability: "documented",
    possibleAlternatives:
      "notes.issuer_snapshot.id; Application.issuer_organization_id; Contract issuer — not used for grouping",
    notes:
      "Issuer dashboard and Note create use issuer_organization_id. Do not group by display name. Snapshot id should match but FK is canonical.",
  },
  previousIssuedNotes: {
    label: "Previous issued notes",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "Count notes by issuer_organization_id excluding current id; status filter undefined for \"issued\" — not used",
    notes:
      "Must exclude current Note. DRAFT/CANCELLED must not be counted without an explicit metric. No prospectus filter exists.",
  },
  successfullyFundedNotes: {
    label: "Successfully funded notes",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "Issuer dashboard: activated_at !== null; funding_status FUNDED/FAILED successRatePercent — different meanings; not reused as prospectus \"successful\"",
    notes: "Do not invent \"successful\" without an approved prospectus rule.",
  },
  activeNotes: {
    label: "Active notes",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "Issuer dashboard overview.activeNotesCount (status === ACTIVE) — issuer portal only; does not exclude current Note",
    notes: "Status ACTIVE is measurable; prospectus exclusion/filter not approved for investor PDF.",
  },
  fullyRepaidNotes: {
    label: "Fully repaid notes",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "Issuer dashboard completedNotesCount (status === REPAID) — not investor track record; REPAID ≠ on-time",
    notes: "NoteStatus.REPAID is measurable; prospectus metric + current-Note exclusion not approved.",
  },
  totalHistoricalAmountRaised: {
    label: "Total historical amount raised",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "notes.funded_amount (actual raise) vs target_amount; dashboard pastFinancingAmount = sum funded_amount where REPAID; activeFinancingAmount where ACTIVE — not a combined prospectus total",
    notes:
      "Do not use target_amount as raised. funded_amount is the raise metric in dashboard amounts. No approved prospectus sum + exclusion rule.",
  },
  onTimeRepaymentRate: {
    label: "On-time repayment rate",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "Issuer dashboard repaymentPerformance.onTimePercent (schedules due in last 6 months; RECEIVED payments vs expected_total) — rolling window, not lifetime; not frozen",
    notes: "REPAID status alone does not prove on-time. Prospectus must not reuse 6-month window without approval.",
  },
  defaultCount: {
    label: "Default count",
    canonicalSource: "none confirmed for prospectus",
    availability: "unresolved",
    possibleAlternatives:
      "Count NoteStatus.DEFAULTED / servicing DEFAULTED by issuer_organization_id — measurable in DB; no investor-facing aggregate today",
    notes: "Issuer dashboard does not publish default count. Zero-defaults marketing needs approval.",
  },
  averageInvestorReturn: {
    label: "Average investor return",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Average profit_rate_percent; average net expectedReturnRatePercent; realised settlement profits — no approved weighting",
    notes: "Do not average percentages without an approved weighted formula.",
  },
  trackRecordSummaryTitle: {
    label: "Track-record summary title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Canva heading copy; invent \"Proven track record\" — not used",
    notes: "No stored approved investor prospectus title.",
  },
  trackRecordSummaryExplanation: {
    label: "Track-record summary explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Canva successful/excellent/100% repaid wording; auto-narrative from counts — not used",
    notes: "Marketing conclusions need compliance approval.",
  },
  dataFrozenOnCurrentNote: {
    label: "Data frozen on current Note",
    canonicalSource: "no issuer history snapshot on Note",
    availability: "constant",
    possibleAlternatives: "Freeze aggregates at publish — not implemented",
    notes:
      "Any future aggregate would be live at generation time unless frozen. Live history can change after publication.",
  },
};
