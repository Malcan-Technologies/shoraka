"use client";

import {
  resolveApprovedFacility,
  resolveRequestedFacility,
} from "@cashsouk/config";
import { FinancialSection } from "./sections/financial-section";
import { BusinessSection } from "./sections/business-section";
import { DocumentsSection } from "./sections/documents-section";
import { CompanySection } from "./sections/company-section";
import { ContractSection } from "./sections/contract-section";
import { CustomerSection } from "./sections/customer-section";
import { InvoiceSection } from "./sections/invoice-section";
import type { ReviewSectionId } from "./section-types";
import type { ReviewTabDescriptor } from "./review-registry";
import { isSignedOfferLetterAvailable } from "./offer-signing-availability";

export interface SectionCommentRecord {
  id: string;
  scope: string;
  scope_key: string;
  remark: string;
  created_at: string;
  author_user_id?: string;
  author?: { first_name?: string | null; last_name?: string | null } | null;
}

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
    contract?: {
      contract_details?: unknown;
      customer_details?: unknown;
      status?: string;
    } | null;
    invoices?: {
      id: string;
      details?: unknown;
      status?: string;
      offer_details?: unknown;
      offer_signing?: unknown;
    }[];
    application_review_items?: unknown;
    application_review_remarks?: unknown;
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
  onSendContractOffer?: (payload: { offeredFacility: number }) => Promise<void>;
  onSendInvoiceOffer?: (payload: {
    invoiceId: string;
    offeredAmount: number;
    offeredRatioPercent: number;
    offeredProfitRatePercent: number;
  }) => Promise<void>;
  sendContractOfferPending?: boolean;
  sendInvoiceOfferPending?: boolean;
  onAddSectionComment?: (section: ReviewSectionId, comment: string) => Promise<void> | void;
  /** Min/max financing ratio (%) from product config. Used by invoice review Offered by CashSouk. */
  invoiceRatioLimits?: { min: number; max: number };
  /** Product offer expiry in days. Used for invoice estimates and offer expiry when sending. */
  offerExpiryDays?: number | null;
  /** Minimum months from today to maturity to enable Send Offer on invoice review. */
  minMonthsReviewToMaturityForOffer?: number | null;
  /** Map of section id to status. Used for contract facility resolution in invoice section. */
  sectionStatusMap?: ReadonlyMap<string, string>;
  onViewSignedInvoiceOffer?: (signedOfferLetterS3Key: string) => void | Promise<void>;
  onViewSignedContractOffer?: () => void | Promise<void>;
  viewSignedOfferLetterPending?: boolean;
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
  onSendContractOffer,
  onSendInvoiceOffer,
  sendContractOfferPending,
  sendInvoiceOfferPending,
  onAddSectionComment,
  invoiceRatioLimits,
  offerExpiryDays,
  minMonthsReviewToMaturityForOffer,
  sectionStatusMap,
  onViewSignedInvoiceOffer,
  onViewSignedContractOffer,
  viewSignedOfferLetterPending,
}: SectionContentProps) {
  const reviewItems =
    (app.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? [];
  const reviewComments = (app.application_review_remarks as SectionCommentRecord[] | undefined) ?? [];

  const section = descriptor.reviewSection;
  const sectionComments = reviewComments
    .filter((entry) => entry.scope === "comment" && entry.scope_key?.startsWith(`${section}:`))
    .map((entry) => ({
      ...entry,
      comment: entry.remark,
    }));

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
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
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
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
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
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
        />
      );
    case "supporting_documents":
      return (
        <DocumentsSection
          supportingDocuments={app.supporting_documents}
          reviewItems={reviewItems}
          isReviewable={isReviewable}
          approvePending={approveItemPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          viewDocumentPending={viewDocumentPending}
          onViewDocument={onViewDocument}
          onApproveItem={(id) => onApproveItem(id, "document")}
          onRejectItem={(id) => onRejectItem(id, "document")}
          onRequestAmendmentItem={(id) => onRequestAmendmentItem(id, "document")}
          onResetItemToPending={onResetItemToPending ? (id) => onResetItemToPending(id, "document") : undefined}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
        />
      );
    case "contract_details": {
      const structureType = (app.financing_structure as { structure_type?: string } | null | undefined)?.structure_type;
      const isInvoiceOnly = structureType === "invoice_only";
      if (isInvoiceOnly) {
        return (
          <CustomerSection
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
            comments={sectionComments}
            onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          />
        );
      }
      return (
        <ContractSection
          contractDetails={app.contract?.contract_details}
          offerDetails={(app.contract as { offer_details?: unknown } | null | undefined)?.offer_details}
          contractStatus={app.contract?.status}
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
          onSendOffer={onSendContractOffer}
          isSendOfferPending={sendContractOfferPending}
          onViewDocument={onViewDocument}
          viewDocumentPending={viewDocumentPending}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          onViewSignedContractOffer={onViewSignedContractOffer}
          signedContractOfferLetterAvailable={isSignedOfferLetterAvailable(
            (app.contract as { offer_signing?: unknown } | null | undefined)?.offer_signing
          )}
          viewSignedOfferLetterPending={viewSignedOfferLetterPending}
        />
      );
    }
    case "invoice_details": {
      const appInvoices = app.invoices ?? [];
      const contract = app.contract as {
        contract_details?: {
          approved_facility?: number;
          utilized_facility?: number;
          available_facility?: number;
          financing?: number;
          value?: number;
        };
        invoices?: { id: string; application_id: string; details?: unknown; status?: string; offer_details?: unknown }[];
      } | null;
      const contractInvoices = contract?.invoices ?? [];
      const applicationId = (app as { id?: string }).id;
      const otherContractInvoices =
        applicationId && app.contract && contractInvoices.length > 0
          ? contractInvoices.filter((inv) => inv.application_id !== applicationId)
          : [];
      const mergedInvoices = [...appInvoices, ...otherContractInvoices];
      const readOnlyInvoiceIds = new Set(otherContractInvoices.map((inv) => inv.id));
      const cd = contract?.contract_details as Record<string, unknown> | null | undefined;
      const contractStatus = sectionStatusMap?.get("contract_details") ?? "";
      const approvedFacility =
        (resolveApprovedFacility(contractStatus, cd) || resolveRequestedFacility(cd)) as number;
      const availableFacility =
        typeof cd?.available_facility === "number" ? cd.available_facility : approvedFacility;
      const utilizedFacility =
        typeof cd?.utilized_facility === "number" ? cd.utilized_facility : 0;
      const contractFacility =
        app.contract && approvedFacility > 0
          ? { contractFacility: approvedFacility, availableFacility, utilizedFacility }
          : undefined;
      return (
        <InvoiceSection
          invoices={mergedInvoices}
          readOnlyInvoiceIds={readOnlyInvoiceIds}
          contractFacility={contractFacility}
          reviewItems={reviewItems}
          isReviewable={isReviewable}
          approvePending={approveItemPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          onViewDocument={onViewDocument}
          viewDocumentPending={viewDocumentPending}
          invoiceRatioLimits={invoiceRatioLimits}
          onApproveItem={(id) => onApproveItem(id, "invoice")}
          onRejectItem={(id) => onRejectItem(id, "invoice")}
          onRequestAmendmentItem={(id) => onRequestAmendmentItem(id, "invoice")}
          onResetItemToPending={onResetItemToPending ? (id) => onResetItemToPending(id, "invoice") : undefined}
          onSendInvoiceOffer={onSendInvoiceOffer}
          isSendInvoiceOfferPending={sendInvoiceOfferPending}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          offerExpiryDays={offerExpiryDays}
          minMonthsReviewToMaturityForOffer={minMonthsReviewToMaturityForOffer}
          onViewSignedInvoiceOffer={onViewSignedInvoiceOffer}
        />
      );
    }
    default:
      return null;
  }
}
