/** Admin prospectus review DTOs — option catalogues remain versioned in API code. */

export type ProspectusReviewStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SUPERSEDED";

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
