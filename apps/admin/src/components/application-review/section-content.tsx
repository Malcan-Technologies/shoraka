"use client";

import { FinancialSection } from "./sections/financial-section";
import { BusinessSection } from "./sections/business-section";
import { DocumentsSection } from "./sections/documents-section";
import { CompanySection } from "./sections/company-section";
import { ContractSection } from "./sections/contract-section";
import { InvoiceSection } from "./sections/invoice-section";
import type { ReviewSectionId } from "./section-types";
import type { ReviewTabDescriptor } from "./review-registry";

export interface PendingAmendmentItem {
  id: string;
  scope: string;
  scope_key: string;
  remark: string;
  item_type: string | null;
  item_id: string | null;
}

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
      name?: string | null;
      corporate_entities?: unknown;
      corporate_onboarding_data?: Record<string, unknown> | null;
      corporateOnboardingData?: Record<string, unknown> | null;
      bank_account_details?: Record<string, unknown> | null;
      bankAccountDetails?: Record<string, unknown> | null;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
  };
  isReviewable: boolean;
  approveSectionPending: boolean;
  approveItemPending: boolean;
  viewDocumentPending: boolean;
  /** When true, section Action dropdown is disabled (e.g. prerequisites not met). */
  isActionLocked?: boolean;
  /** Tooltip when Action is locked. */
  actionLockTooltip?: string;
  /** Current status of this section for conditional "Set to Pending" option. */
  sectionStatus?: string;
  /** Callback to reset section to PENDING. */
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApproveSection: (section: ReviewSectionId) => void;
  onRejectSection: (section: ReviewSectionId) => void;
  onRequestAmendmentSection: (section: ReviewSectionId) => void;
  onViewDocument: (s3Key: string) => void;
  onApproveItem: (itemId: string, itemType: "invoice" | "document") => Promise<void>;
  onRejectItem: (itemId: string, itemType: "invoice" | "document") => void;
  onRequestAmendmentItem: (itemId: string, itemType: "invoice" | "document") => void;
  onResetItemToPending?: (itemId: string, itemType: "invoice" | "document") => void;
}

/** Renders section content by descriptor. Single place to map descriptor → component. */
export function SectionContent({
  descriptor,
  app,
  isReviewable,
  approveSectionPending,
  approveItemPending,
  viewDocumentPending,
  isActionLocked,
  actionLockTooltip,
  sectionStatus,
  onResetSectionToPending,
  onApproveSection,
  onRejectSection,
  onRequestAmendmentSection,
  onViewDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
}: SectionContentProps) {
  const reviewItems =
    (app.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? [];

  const section = descriptor.reviewSection;

  switch (descriptor.kind) {
    case "financial":
      return (
        <FinancialSection
          app={app}
          section={section}
          isReviewable={isReviewable}
          approvePending={approveSectionPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          sectionStatus={sectionStatus}
          onResetSectionToPending={onResetSectionToPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
        />
      );
    case "business_details":
      return (
        <BusinessSection
          businessDetails={app.business_details}
          section={section}
          isReviewable={isReviewable}
          approvePending={approveSectionPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          sectionStatus={sectionStatus}
          onResetSectionToPending={onResetSectionToPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
        />
      );
    case "company_details":
      return (
        <CompanySection
          app={app}
          section={section}
          isReviewable={isReviewable}
          approvePending={approveSectionPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          sectionStatus={sectionStatus}
          onResetSectionToPending={onResetSectionToPending}
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
          section={section}
          isReviewable={isReviewable}
          approvePending={approveItemPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          sectionStatus={sectionStatus}
          onResetSectionToPending={onResetSectionToPending}
          viewDocumentPending={viewDocumentPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
          onViewDocument={onViewDocument}
          onApproveItem={(id) => onApproveItem(id, "document")}
          onRejectItem={(id) => onRejectItem(id, "document")}
          onRequestAmendmentItem={(id) => onRequestAmendmentItem(id, "document")}
          onResetItemToPending={onResetItemToPending ? (id) => onResetItemToPending(id, "document") : undefined}
        />
      );
    case "contract_details":
      return (
        <ContractSection
          contractDetails={app.contract?.contract_details}
          customerDetails={app.contract?.customer_details}
          section={section}
          isReviewable={isReviewable}
          approvePending={approveSectionPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          sectionStatus={sectionStatus}
          onResetSectionToPending={onResetSectionToPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
          onViewDocument={onViewDocument}
          viewDocumentPending={viewDocumentPending}
        />
      );
    case "invoice_details":
      return (
        <InvoiceSection
          invoices={app.invoices ?? []}
          reviewItems={reviewItems}
          section={section}
          isReviewable={isReviewable}
          approvePending={approveItemPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          sectionStatus={sectionStatus}
          onResetSectionToPending={onResetSectionToPending}
          onApprove={onApproveSection}
          onReject={onRejectSection}
          onRequestAmendment={onRequestAmendmentSection}
          onViewDocument={onViewDocument}
          viewDocumentPending={viewDocumentPending}
          onApproveItem={(id) => onApproveItem(id, "invoice")}
          onRejectItem={(id) => onRejectItem(id, "invoice")}
          onRequestAmendmentItem={(id) => onRequestAmendmentItem(id, "invoice")}
          onResetItemToPending={onResetItemToPending ? (id) => onResetItemToPending(id, "invoice") : undefined}
        />
      );
    default:
      return null;
  }
}
