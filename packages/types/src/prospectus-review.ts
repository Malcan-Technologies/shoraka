/** Admin prospectus review DTOs — option catalogues remain versioned in API code. */

export type ProspectusReviewStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SUPERSEDED";

export interface ProspectusReviewStoredContent {
  page1: {
    keyInvestorHighlights: Array<{
      key: string;
      optionKey?: string | null;
      isVisible: boolean;
    }>;
    paymentBasisOptionKey?: string | null;
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
    highlights: Record<string, ProspectusCatalogueOptionDto[]>;
    paymentBasis: ProspectusCatalogueOptionDto[];
    shariahPrinciple: ProspectusCatalogueOptionDto[];
    creditInsights: ProspectusCatalogueOptionDto[];
    invoiceWork: Record<string, ProspectusCatalogueOptionDto[]>;
    takeaways: Record<string, ProspectusCatalogueOptionDto[]>;
  };
  publishBlockedReason: string | null;
}

export interface SaveProspectusReviewDraftInput {
  draftContent: ProspectusReviewStoredContent;
  expectedUpdatedAt?: string;
}

export interface ProspectusReviewPreviewResponse {
  status: ProspectusReviewStatus;
  draftMarker: string;
  html: {
    page1: string;
    page2: string;
    page3: string;
  };
}
