/** Admin prospectus review DTOs — option catalogues remain versioned in API code. */

export type ProspectusReviewStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SUPERSEDED"
  | "PUBLISHED";

/**
 * Officer-selected Company Size for Page 2 Issuer Profile.
 * Required before Approve; optional while Draft.
 */
export const PROSPECTUS_COMPANY_SIZE_VALUES = ["Micro", "Small", "Medium", "Large"] as const;
export type ProspectusCompanySize = (typeof PROSPECTUS_COMPANY_SIZE_VALUES)[number];

export function normalizeProspectusCompanySize(value: unknown): ProspectusCompanySize | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (PROSPECTUS_COMPANY_SIZE_VALUES as readonly string[]).includes(trimmed)
    ? (trimmed as ProspectusCompanySize)
    : null;
}

/** Stored officer-edited highlight copy (Shariah is fixed on write/resolve). */
export interface ProspectusReviewHighlightSelection {
  key: string;
  title: string;
  description: string;
  /** @deprecated Legacy catalogue key — ignored for new reviews. */
  optionKey?: string | null;
  /** @deprecated Legacy visibility — highlights are always displayed. */
  isVisible?: boolean;
}

export interface ProspectusReviewStoredContent {
  page1: {
    keyInvestorHighlights: ProspectusReviewHighlightSelection[];
    /** @deprecated Legacy only — ignored; Payment Basis is a fixed prospectus value. */
    paymentBasisOptionKey?: string | null;
    /** @deprecated Legacy only — ignored; Shariah Principle is a fixed prospectus value. */
    shariahPrincipleOptionKey?: string | null;
  };
  page2: {
    /** Optional officer Issuer Profile inputs (not IssuerOrganization data). */
    issuerProfile?: {
      companySize?: ProspectusCompanySize | null;
    };
    paymasterTrackRecord?: {
      totalInvoicesPaid?: number | null;
      totalAmountPaid?: string | number | null;
      successfulRepaymentPercent?: string | number | null;
      onTimePaymentPercent?: string | number | null;
      averagePaymentPeriodDays?: string | number | null;
    };
    creditInsights: {
      creditScoreOptionKey?: string | null;
      paymentBehaviourOptionKey?: string | null;
      creditUtilisationOptionKey?: string | null;
      litigationCheckOptionKey?: string | null;
      ccrisStatusOptionKey?: string | null;
    };
    invoiceWorkStatements: Array<{
      key: string;
      optionKey?: string | null;
      isVisible: boolean;
    }>;
  };
  page3: {
    manualFinancialInputs?: {
      years: Record<string, Record<string, string | number | null | undefined>>;
    };
    investorTakeaways: {
      revenueProfitabilityOptionKey?: string | null;
      liquidityOptionKey?: string | null;
      leverageOptionKey?: string | null;
      debtServicingCapacityOptionKey?: string | null;
      workingCapitalEfficiencyOptionKey?: string | null;
      overallFinancialProfileOptionKey?: string | null;
    };
  };
}

export interface ProspectusReviewDetail {
  id: string;
  noteId: string;
  status: ProspectusReviewStatus;
  contentVersion: number;
  optionCatalogueVersion: string;
  draftContent: ProspectusReviewStoredContent;
  approvedContent: ProspectusReviewStoredContent | null;
  approvedPublicationId?: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectusCatalogueOptionDto {
  key: string;
  label: string;
  renderedText: string | null;
  category: string;
  isActive: boolean;
}

export interface ProspectusHighlightCopyDto {
  title: string;
  description: string;
}

/** Read-only Page 1 Issuer Track Record rows for Admin (same values as Preview). */
export interface ProspectusIssuerTrackRecordAdminRow {
  label: string;
  value: string;
}

/** Read-only Page 1 Historical Notes row for Admin (same values as Preview). */
export interface ProspectusHistoricalNoteAdminRow {
  noteId: string;
  financingType: string;
  amountRm: string;
  tenure: string;
  profitRate: string;
  status: string;
  repaymentDate: string;
}

export interface ProspectusHistoricalNotesAdminTable {
  headers: string[];
  rows: ProspectusHistoricalNoteAdminRow[];
  emptyStateMessage: string | null;
}

/** Read-only Page 2 Issuer Profile row for Admin (same values as Preview). */
export interface ProspectusIssuerProfileAdminRow {
  label: string;
  value: string;
}

/** Read-only Page 2 Invoice & Paymaster row for Admin (same values as Preview). */
export interface ProspectusInvoicePaymasterAdminRow {
  label: string;
  value: string;
}

export interface ProspectusReviewGetResponse {
  note: {
    id: string;
    noteReference: string;
    title: string;
    status: string;
  };
  review: ProspectusReviewDetail;
  catalogues: {
    version: string;
    creditInsights: ProspectusCatalogueOptionDto[];
    invoiceWork: Record<string, ProspectusCatalogueOptionDto[]>;
    takeaways: Record<string, ProspectusCatalogueOptionDto[]>;
  };
  /** System recommendations for Key Investor Highlights (pre-fill / reference). */
  highlightRecommendations: {
    paymaster: ProspectusHighlightCopyDto;
    issuer_fundamentals: ProspectusHighlightCopyDto;
    return: ProspectusHighlightCopyDto;
    shariah: ProspectusHighlightCopyDto;
  };
  /**
   * System-derived Issuer Track Record (Page 1 Stage 7) — live for unpublished,
   * frozen snapshot for published. Same path as Prospectus Preview.
   */
  issuerTrackRecord: {
    rows: ProspectusIssuerTrackRecordAdminRow[];
  };
  /**
   * System-derived Historical Notes (Page 1 Stage 8) — live for unpublished,
   * frozen snapshot for published. Same path as Prospectus Preview.
   */
  historicalNotes: ProspectusHistoricalNotesAdminTable;
  /**
   * System-derived Issuer Profile (Page 2 Stage 1) — non-identifying fields only.
   * Same path as Prospectus Preview (notes.issuer_snapshot → builder).
   */
  issuerProfile: {
    /** Industry component from issuer snapshot (for Admin display / local combine). */
    industry: string;
    rows: ProspectusIssuerProfileAdminRow[];
  };
  /**
   * System-derived Invoice & Paymaster Information (Page 2 Stage 2).
   * Same path as Prospectus Preview (invoice/paymaster snapshots → builder).
   */
  invoicePaymaster: {
    rows: ProspectusInvoicePaymasterAdminRow[];
  };
  publishBlockedReason: string | null;
  /** Temporary placeholder catalogue notice for officers. */
  catalogueNotice: string;
}

export interface SaveProspectusReviewDraftInput {
  draftContent: ProspectusReviewStoredContent;
  expectedUpdatedAt?: string;
}

export interface ProspectusReviewPreviewResponse {
  status: ProspectusReviewStatus;
  /** Which stored content the preview rendered. */
  previewSource: "draft" | "approved";
  draftMarker: string;
  html: {
    page1: string;
    page2: string;
    page3: string;
  };
}
