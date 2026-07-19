/**
 * SECTION: Prospectus Page 1 — Historical Note Table (DATA STAGE 8)
 * WHY: Exact Canva columns; Amount unresolved; no eligibility filter / sort / row limit
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_HISTORICAL_NOTE_TABLE_HEADERS = [
  "Note ID",
  "Financing Type",
  "Amount (RM)",
  "Tenure",
  "Profit Rate (p.a.)",
  "Status",
  "Repayment Date",
] as const;

export const PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY =
  "notes.issuer_organization_id";

export const PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY = "notes.id";

export interface ProspectusHistoricalNoteRowAudit {
  identity: {
    issuerGroupingKey: typeof PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY;
    currentNoteExclusionKey: typeof PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY;
  };
  amount: {
    targetSource: "notes.target_amount";
    fundedSource: "notes.funded_amount";
    canvaAmountSource: "unresolved";
    decision: "pending";
    /** Supporting values — not Canva-facing. */
    financingTarget: string;
    fundedAmount: string;
  };
  eligibility: {
    statusFilterDecision: "pending";
    includedByBuilder: "caller_supplied";
    currentNoteExclusionRequired: true;
  };
  status: {
    source: "notes.status";
    displayMappingDecision: "pending";
  };
  dates: {
    repaymentDateSource: "notes.repaid_at";
  };
}

export interface ProspectusHistoricalNoteTableAudit {
  identity: {
    issuerGroupingKey: typeof PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY;
    currentNoteExclusionKey: typeof PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY;
    currentNoteExclusionRequired: true;
  };
  eligibility: {
    statusFilterDecision: "pending";
  };
  table: {
    sortDecision: "pending";
    rowLimitDecision: "pending";
    sourceType: "live_historical_notes";
    isFrozen: false;
    snapshotDecision: "pending";
  };
}

export const PROSPECTUS_HISTORICAL_NOTE_TABLE_AUDIT: ProspectusHistoricalNoteTableAudit = {
  identity: {
    issuerGroupingKey: PROSPECTUS_HISTORICAL_NOTE_ISSUER_GROUPING_KEY,
    currentNoteExclusionKey: PROSPECTUS_HISTORICAL_NOTE_CURRENT_NOTE_EXCLUSION_KEY,
    currentNoteExclusionRequired: true,
  },
  eligibility: {
    statusFilterDecision: "pending",
  },
  table: {
    sortDecision: "pending",
    rowLimitDecision: "pending",
    sourceType: "live_historical_notes",
    isFrozen: false,
    snapshotDecision: "pending",
  },
};

/** Canva-facing historical row columns only. */
export interface ProspectusHistoricalNoteTableRow {
  noteId: string;
  financingType: string;
  amountRm: string;
  tenure: string;
  profitRate: string;
  status: string;
  repaymentDate: string;
  /** Row audit/supporting data — omitted from Canva HTML. */
  audit: ProspectusHistoricalNoteRowAudit;
}

export interface ProspectusHistoricalNoteTable {
  rows: ProspectusHistoricalNoteTableRow[];
  audit: ProspectusHistoricalNoteTableAudit;
}

/** Raw Note fields for one historical row — not Prisma. */
export interface ProspectusHistoricalNoteRowInput {
  /** notes.id — exclusion key for future query; builder does not filter by this. */
  id: string;
  /** notes.issuer_organization_id — grouping key for future query; builder does not filter. */
  issuerOrganizationId: string;
  /** notes.note_reference */
  noteReference: string | null | undefined;
  /** notes.status (raw NoteStatus) */
  noteStatus: string | null | undefined;
  /** notes.product_snapshot.product_name — only approved financing-type source */
  productName: string | null | undefined;
  /**
   * Observational aliases / live Product — must not become Financing Type.
   */
  productSnapshotName?: string | null;
  productSnapshotProductLabel?: string | null;
  liveProductName?: string | null;
  /** notes.target_amount — audit supporting only */
  targetAmount: number | null | undefined;
  /** notes.funded_amount — audit supporting only */
  fundedAmount: number | null | undefined;
  /** notes.profit_rate_percent — annual gross before service fee */
  profitRatePercent: number | null | undefined;
  /** note_listings.opens_at */
  listingOpensAt: Date | string | null | undefined;
  /** notes.maturity_date */
  maturityDate: Date | string | null | undefined;
  /** notes.activated_at — observational only */
  activatedAt?: Date | string | null | undefined;
  /** notes.repaid_at — set when settlement posts REPAID */
  repaidAt: Date | string | null | undefined;
}

/**
 * Options document future query boundary only.
 * Builder does not filter, sort, or truncate by these values.
 */
export interface ProspectusHistoricalNoteTableOptions {
  issuerOrganizationId?: string | null;
  currentNoteId?: string | null;
}

export interface ProspectusHistoricalNoteTableColumnSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "unresolved";
  surface: "canva" | "audit";
  notes: string;
}

export const PROSPECTUS_HISTORICAL_NOTE_TABLE_COLUMN_SOURCES: Record<
  | "noteId"
  | "financingType"
  | "amountRm"
  | "tenure"
  | "profitRate"
  | "status"
  | "repaymentDate",
  ProspectusHistoricalNoteTableColumnSource
> = {
  noteId: {
    label: "Note ID",
    canonicalSource: "notes.note_reference",
    availability: "stored",
    surface: "canva",
    notes:
      "Stored reference as-is. No ARF conversion. formatNoteReferenceDisplay is not used (display-shape helper, not prospectus source).",
  },
  financingType: {
    label: "Financing Type",
    canonicalSource: "notes.product_snapshot.product_name",
    availability: "stored",
    surface: "canva",
    notes: "Frozen snapshot only. No live Product or alias fallbacks.",
  },
  amountRm: {
    label: "Amount (RM)",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    notes:
      "Target vs funded vs disbursed vs payout unresolved. Supporting target/funded stay in row audit only.",
  },
  tenure: {
    label: "Tenure",
    canonicalSource: "buildProspectusTenureAndMaturity(opens_at, maturity_date)",
    availability: "calculated",
    surface: "canva",
    notes: "Stage 2 reuse. No duplicate day-count in Stage 8.",
  },
  profitRate: {
    label: "Profit Rate (p.a.)",
    canonicalSource: "notes.profit_rate_percent",
    availability: "stored",
    surface: "canva",
    notes:
      "Stage 4A formatProspectusProfitRatePercent. Annual GROSS. Header already has (p.a.) — value is percent only.",
  },
  status: {
    label: "Status",
    canonicalSource: "notes.status",
    availability: "stored",
    surface: "canva",
    notes:
      "Raw NoteStatus. displayMappingDecision = pending. Do not map REPAID → Fully Repaid.",
  },
  repaymentDate: {
    label: "Repayment Date",
    canonicalSource: "notes.repaid_at",
    availability: "stored",
    surface: "canva",
    notes: "formatProspectusDateUtc. Do not derive from maturity or payment received_at.",
  },
};
