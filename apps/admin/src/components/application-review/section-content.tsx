"use client";

import { FinancialSection } from "./sections/financial-section";
import { JustificationSection } from "./sections/justification-section";
import { DocumentsSection } from "./sections/documents-section";
import { StepSummarySection } from "./sections/step-summary-section";
import type { ReviewSectionId } from "./section-types";
import type { ReviewTabDescriptor } from "@/app/settings/products/product-utils";

export interface SectionContentProps {
  descriptor: ReviewTabDescriptor;
  app: {
    business_details?: unknown;
    supporting_documents?: unknown;
    financing_type?: unknown;
    financing_structure?: unknown;
    company_details?: unknown;
    declarations?: unknown;
    contract?: { contract_details?: unknown; customer_details?: unknown } | null;
    invoices?: { id: string; details?: unknown }[];
    application_review_items?: unknown;
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
  };
  isReviewable: boolean;
  approveSectionPending: boolean;
  approveItemPending: boolean;
  viewDocumentPending: boolean;
  onApproveSection: (section: ReviewSectionId) => void;
  onRejectSection: (section: ReviewSectionId) => void;
  onRequestAmendmentSection: (section: ReviewSectionId) => void;
  onViewDocument: (s3Key: string) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
}

/** Renders section content by descriptor. Single place to map descriptor → component. */
export function SectionContent({
  descriptor,
  app,
  isReviewable,
  approveSectionPending,
  approveItemPending,
  viewDocumentPending,
  onApproveSection,
  onRejectSection,
  onRequestAmendmentSection,
  onViewDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
}: SectionContentProps) {
  const reviewItems =
    (app.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? [];

  switch (descriptor.kind) {
    case "financial":
      return (
        <FinancialSection
          app={app}
          section="FINANCIAL"
          isReviewable={isReviewable}
          approvePending={approveSectionPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
        />
      );
    case "business_details":
      return (
        <JustificationSection
          businessDetails={app.business_details}
          section="JUSTIFICATION"
          isReviewable={isReviewable}
          approvePending={approveSectionPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
        />
      );
    case "supporting_documents":
      return (
        <DocumentsSection
          supportingDocuments={app.supporting_documents}
          reviewItems={reviewItems}
          section="DOCUMENTS"
          isReviewable={isReviewable}
          approvePending={approveItemPending}
          viewDocumentPending={viewDocumentPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
          onViewDocument={onViewDocument}
          onApproveItem={onApproveItem}
          onRejectItem={onRejectItem}
          onRequestAmendmentItem={onRequestAmendmentItem}
        />
      );
    case "step":
      return (
        <StepSummarySection
          stepKey={descriptor.stepKey ?? "unknown"}
          stepLabel={descriptor.label}
          app={app}
        />
      );
    default:
      return null;
  }
}
