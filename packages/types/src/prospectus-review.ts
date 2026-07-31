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

/**
 * Officer-selected Deed of Assignment (DOA) for Page 2 Invoice & Paymaster.
 * Required before Approve; optional while Draft. Not inferred from uploads.
 */
export const PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES = ["Yes", "No"] as const;
export type ProspectusDeedOfAssignment = (typeof PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES)[number];

export function normalizeProspectusDeedOfAssignment(
  value: unknown
): ProspectusDeedOfAssignment | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES as readonly string[]).includes(trimmed)
    ? (trimmed as ProspectusDeedOfAssignment)
    : null;
}

/**
 * Officer-selected Paymaster Rating for Page 2 Invoice & Paymaster.
 * Required before Approve; optional while Draft.
 */
export const PROSPECTUS_PAYMASTER_RATING_VALUES = ["PM1", "PM2", "PM3", "PM4"] as const;
export type ProspectusPaymasterRating = (typeof PROSPECTUS_PAYMASTER_RATING_VALUES)[number];

export function normalizeProspectusPaymasterRating(
  value: unknown
): ProspectusPaymasterRating | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (PROSPECTUS_PAYMASTER_RATING_VALUES as readonly string[]).includes(trimmed)
    ? (trimmed as ProspectusPaymasterRating)
    : null;
}

/**
 * Officer-selected Confidence Grading for Page 2 Invoice & Paymaster.
 * Required before Approve; optional while Draft.
 */
export const PROSPECTUS_CONFIDENCE_GRADING_VALUES = ["High", "Medium", "Low"] as const;
export type ProspectusConfidenceGrading =
  (typeof PROSPECTUS_CONFIDENCE_GRADING_VALUES)[number];

export function normalizeProspectusConfidenceGrading(
  value: unknown
): ProspectusConfidenceGrading | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (PROSPECTUS_CONFIDENCE_GRADING_VALUES as readonly string[]).includes(trimmed)
    ? (trimmed as ProspectusConfidenceGrading)
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
    /**
     * Officer-selected Invoice & Paymaster fields (not inferred from uploads/CTOS).
     * Required before Approve; optional while Draft.
     */
    invoicePaymaster?: {
      deedOfAssignment?: ProspectusDeedOfAssignment | null;
      paymasterRating?: ProspectusPaymasterRating | null;
      confidenceGrading?: ProspectusConfidenceGrading | null;
    };
    paymasterTrackRecord?: {
      totalInvoicesPaid?: number | null;
      totalAmountPaid?: string | number | null;
      successfulRepaymentPercent?: string | number | null;
      onTimePaymentPercent?: string | number | null;
      averagePaymentPeriodDays?: string | number | null;
    };
    /**
     * Officer overrides for unsupported Page 2 financial comparison metrics.
     * Keys: normalized financial-year-end ISO ("2024-12-31"). Legacy calendar year
     * keys ("2024") are accepted for backward compatibility on read.
     * System-derived metrics (Revenue, PAT, NPM, ROE, Current Ratio) must not be overridden.
     */
    financialComparison?: {
      overrides?: Record<
        string,
        {
          netDebtEquity?: string | number | null;
          interestCoverage?: string | number | null;
          dscr?: string | number | null;
          receivablesDays?: string | number | null;
        }
      >;
    };
    creditInsights: {
      creditScoreOptionKey?: string | null;
      paymentBehaviourOptionKey?: string | null;
      creditUtilisationOptionKey?: string | null;
      litigationCheckOptionKey?: string | null;
      ccrisStatusOptionKey?: string | null;
    };
    /**
     * About the Invoice / Work Performed — same Ops-edit + freeze pattern as
     * Key Investor Highlights (free text; optional system suggestion templates).
     */
    aboutInvoice?: {
      items: Array<{
        id: string;
        text: string;
        sourceType: "SYSTEM_SUGGESTION" | "OFFICER_ENTERED";
      }>;
    };
    /**
     * @deprecated Prefer page2.aboutInvoice.items. Legacy catalogue optionKey rows
     * are migrated on normalize/read.
     */
    invoiceWorkStatements?: Array<{
      key: string;
      optionKey?: string | null;
      isVisible?: boolean;
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
      receivablesCollectionOptionKey?: string | null;
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

/** Read-only Page 2 Paymaster Track Record row for Admin (same values as Preview). */
export interface ProspectusPaymasterTrackRecordAdminRow {
  label: string;
  value: string;
}

/** Read-only Page 2 3-Year Financial Comparison table for Admin (same values as Preview). */
export interface ProspectusFinancialComparisonAdminTable {
  yearHeaders: Array<{
    /** Stable FYE ISO — officer overrides are keyed by this, not column position. */
    key: string;
    yearLabel: string;
    fyeLabel: string;
    /** Display-only column with no real financial record — not officer-editable. */
    isPlaceholder?: boolean;
  }>;
  rows: Array<{
    metric: string;
    values: string[];
  }>;
  sourceFooter: string;
}

/**
 * Single frozen financial-year record for Admin Page 2 + Page 3 working tables.
 * Same Stage 4A year selection and raw fields used at approve/publish freeze.
 */
export type ProspectusFrozenFinancialSourceType = "CTOS" | "UNAUDITED";

export interface ProspectusFrozenFinancialRaw {
  turnover: number | null;
  plnpbt: number | null;
  plnpat: number | null;
  bscatot: number | null;
  curlib: number | null;
  bsfatot: number | null;
  othass: number | null;
  bsclbank: number | null;
  bsslltd: number | null;
  bsclstd: number | null;
  bsqpuc: number | null;
  totass: number | null;
  totlib: number | null;
  profit_margin: number | null;
  return_on_equity: number | null;
  currat: number | null;
}

export interface ProspectusFrozenFinancialYear {
  financialYearEndIso: string;
  calendarYear: number;
  /** Display year label (e.g. FY2024). */
  label: string;
  /** Financial year-end display (e.g. 31 Dec 2024). */
  fyeLabel: string;
  sourceType: ProspectusFrozenFinancialSourceType;
  raw: ProspectusFrozenFinancialRaw;
  /** Display-only column with no real financial record — not officer-editable. */
  isPlaceholder?: boolean;
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
    creditInsights: Record<string, ProspectusCatalogueOptionDto[]>;
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
  /**
   * Officer-entered Paymaster Track Record (Page 2 Stage 3) — formatted like Preview.
   * No system paymaster-history aggregate; values from prospectus review content.
   */
  paymasterTrackRecord: {
    rows: ProspectusPaymasterTrackRecordAdminRow[];
  };
  /**
   * Page 2 3-Year Financial Comparison — same Stage 4A/4B path as Preview.
   * Unsupported metrics may include officer overrides from draft/approved content.
   * `years` carries the same frozen raw records for Page 2 + Page 3 Admin tables.
   */
  financialComparison: {
    table: ProspectusFinancialComparisonAdminTable;
    /** Same Stage 4A years + raw fields as Preview / publish freeze (oldest → newest). */
    years: ProspectusFrozenFinancialYear[];
    /**
     * Non-blocking Ops warning when an SSM-expected unaudited year has no stored data.
     * Never blocks Prospectus approval; omitted from investor HTML.
     */
    opsWarning: string | null;
    missingSsmUnauditedYears: number[];
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
  /** Which content the preview rendered. */
  previewSource: "draft" | "approved" | "unsaved";
  draftMarker: string;
  html: {
    page1: string;
    page2: string;
    page3: string;
    /** Combined three-page document for Admin “All Pages” preview (same builders as PDF). */
    allPages: string;
  };
}
