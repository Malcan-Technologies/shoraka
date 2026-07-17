/**
 * SECTION: Prospectus Page 1 — Historical Note Table (DATA STAGE 8)
 * WHY: Factual prior-Note rows; no invented eligibility filter or on-time claims
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Formatted row for plain HTML preview. */
export interface ProspectusHistoricalNoteTableRow {
  noteReference: string;
  financingType: string;
  /** Canva single Amount (RM) — target vs funded unresolved → Data not available */
  canvaAmountRm: string;
  financingTarget: string;
  fundedAmount: string;
  grossProfitRate: string;
  tenure: string;
  listingDate: string;
  activationDate: string;
  maturityDate: string;
  actualRepaymentDate: string;
  noteStatus: string;
  repaymentPerformanceLabel: string;
}

/** Raw Note fields for one historical row — not Prisma. */
export interface ProspectusHistoricalNoteRowInput {
  /** notes.id — used only to exclude the current prospectus Note */
  id: string;
  /** notes.issuer_organization_id — must match current Note issuer */
  issuerOrganizationId: string;
  /** notes.note_reference */
  noteReference: string | null | undefined;
  /** notes.status (raw NoteStatus) */
  noteStatus: string | null | undefined;
  /** notes.product_snapshot.product_name */
  productName: string | null | undefined;
  /** notes.target_amount */
  targetAmount: number | null | undefined;
  /** notes.funded_amount */
  fundedAmount: number | null | undefined;
  /** notes.profit_rate_percent — annual gross before service fee */
  profitRatePercent: number | null | undefined;
  /** note_listings.opens_at */
  listingOpensAt: Date | string | null | undefined;
  /** notes.maturity_date */
  maturityDate: Date | string | null | undefined;
  /** notes.activated_at */
  activatedAt: Date | string | null | undefined;
  /** notes.repaid_at — set when settlement posts REPAID */
  repaidAt: Date | string | null | undefined;
}

export interface ProspectusHistoricalNoteTableOptions {
  /** notes.issuer_organization_id of the prospectus Note */
  issuerOrganizationId?: string | null;
  /** notes.id of the prospectus Note — excluded from history */
  currentNoteId?: string | null;
}

export interface ProspectusHistoricalNoteTableColumnSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "unresolved";
  notes: string;
}

export const PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES: Record<
  keyof ProspectusHistoricalNoteTableRow,
  ProspectusHistoricalNoteTableColumnSource
> = {
  noteReference: {
    label: "Note reference (Canva: Note ID)",
    canonicalSource: "notes.note_reference",
    availability: "stored",
    notes: "Do not use notes.id as the display id. note_reference alone cannot exclude current Note.",
  },
  financingType: {
    label: "Financing type",
    canonicalSource: "notes.product_snapshot.product_name",
    availability: "stored",
    notes: "Same Stage 1 source. No mapper aliases.",
  },
  canvaAmountRm: {
    label: "Amount (RM) [Canva]",
    canonicalSource: "none confirmed — target vs funded ambiguous",
    availability: "unresolved",
    notes: "Canva label does not say target or funded. Shown as Data not available; use columns below.",
  },
  financingTarget: {
    label: "Financing target",
    canonicalSource: "notes.target_amount",
    availability: "stored",
    notes: "Raise goal. Not amount raised.",
  },
  fundedAmount: {
    label: "Funded amount",
    canonicalSource: "notes.funded_amount",
    availability: "stored",
    notes: "Committed principal. Not disbursed / net issuer payout.",
  },
  grossProfitRate: {
    label: "Gross profit rate (p.a.)",
    canonicalSource: "notes.profit_rate_percent",
    availability: "stored",
    notes: "Annual GROSS before service fee. Not realised or net return.",
  },
  tenure: {
    label: "Tenure",
    canonicalSource: "buildProspectusTenureAndMaturity(opens_at, maturity_date)",
    availability: "calculated",
    notes: "Same Stage 2 contractual span. Not days remaining.",
  },
  listingDate: {
    label: "Listing date",
    canonicalSource: "note_listings.opens_at",
    availability: "stored",
    notes: "Same Stage 2 listing date helper. Not published_at.",
  },
  activationDate: {
    label: "Activation date",
    canonicalSource: "notes.activated_at",
    availability: "stored",
    notes: "Activation / servicing start. Not a funded-date synonym unless product says so.",
  },
  maturityDate: {
    label: "Maturity date",
    canonicalSource: "notes.maturity_date",
    availability: "stored",
    notes: "Not repayment date.",
  },
  actualRepaymentDate: {
    label: "Actual repayment date",
    canonicalSource: "notes.repaid_at",
    availability: "stored",
    notes: "Set when settlement posts and status becomes REPAID. Not maturity_date.",
  },
  noteStatus: {
    label: "Note status",
    canonicalSource: "notes.status",
    availability: "stored",
    notes: "Raw NoteStatus. Not investor Settled label. Not Paid on time.",
  },
  repaymentPerformanceLabel: {
    label: "Repayment-performance label",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    notes: "REPAID ≠ on-time. Do not invent Paid on time / excellent wording.",
  },
};
