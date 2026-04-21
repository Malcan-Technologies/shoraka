"use client";

/**
 * SECTION: Maps review tab descriptor to section UI
 * WHY: Single switch routes financial, documents, contract, etc.
 * INPUT: descriptor, application view, handlers, optional comparison snapshots
 * OUTPUT: The correct section component tree
 * WHERE USED: Admin application detail tabs, resubmit comparison modal
 */

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
import type { SoukscoreRiskRating } from "@cashsouk/types";

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

export type ReviewApplicationView = {
  id?: string;
  created_at?: string;
  /** When present (e.g. live admin detail), used with workflow to filter review tabs. */
  visible_review_sections?: unknown;
  business_details?: unknown;
  application_guarantors?: unknown;
  supporting_documents?: unknown;
  financing_type?: unknown;
  financing_structure?: unknown;
  company_details?: unknown;
  declarations?: unknown;
  financial_statements?: unknown;
  review_and_submit?: unknown;
  contract?: {
    contract_details?: unknown;
    customer_details?: unknown;
    status?: string;
    invoices?: { id: string; application_id: string; details?: unknown; status?: string; offer_details?: unknown }[];
  } | null;
  invoices?: {
    id: string;
    details?: unknown;
    status?: string;
    offer_details?: unknown;
    offer_signing?: unknown;
    application_id?: string;
  }[];
  application_review_items?: unknown;
  application_review_remarks?: unknown;
  issuer_organization_id?: string;
  issuer_organization?: {
    id?: string;
    name?: string | null;
    corporate_entities?: unknown;
    corporate_onboarding_data?: Record<string, unknown> | null;
    corporateOnboardingData?: Record<string, unknown> | null;
    bank_account_details?: Record<string, unknown> | null;
    bankAccountDetails?: Record<string, unknown> | null;
    director_kyc_status?: unknown;
    director_aml_status?: unknown;
    business_aml_status?: unknown;
  } | null;
};

export type SectionContentComparison = {
  beforeApp: ReviewApplicationView;
  afterApp: ReviewApplicationView;
  isPathChanged: (path: string) => boolean;
};

export interface SectionContentProps {
  descriptor: ReviewTabDescriptor;
  app: ReviewApplicationView;
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
  onTriggerGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  onDownloadAllDocuments: (files: { s3Key: string; fileName: string; category: string; field: string }[]) => Promise<void> | void;
  downloadAllDocumentsPending?: boolean;
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
    risk_rating: SoukscoreRiskRating;
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
  /** When set, sections render read-only before/after comparison grids. */
  sectionComparison?: SectionContentComparison;
  /** When true (e.g. resubmit comparison modal), section comment thread is hidden. */
  hideSectionComments?: boolean;
  /** supporting_documents workflow config — only applied when sectionComparison is set (resubmit modal). */
  supportingDocumentsStepConfig?: Record<string, unknown> | null;
  /** Stored amendment remarks for resubmit comparison (modal only). */
  resubmitAmendmentRemarks?: Array<{ scope: string; scope_key: string; remark: string }>;
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
  onTriggerGuarantorAml,
  onViewDocument,
  onDownloadDocument,
  onDownloadAllDocuments,
  downloadAllDocumentsPending = false,
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
  sectionComparison,
  hideSectionComments = false,
  supportingDocumentsStepConfig = null,
  resubmitAmendmentRemarks,
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
          applicationId={app.id ?? ""}
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
          sectionComparison={
            sectionComparison
              ? {
                  beforeApp: sectionComparison.beforeApp,
                  afterApp: sectionComparison.afterApp,
                  isPathChanged: sectionComparison.isPathChanged,
                }
              : undefined
          }
          hideSectionComments={hideSectionComments}
        />
      );
    case "business_details":
      return (
        <BusinessSection
          businessDetails={app.business_details}
          applicationGuarantors={app.application_guarantors}
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
          onTriggerGuarantorAml={onTriggerGuarantorAml}
          onViewDocument={onViewDocument}
          onDownloadDocument={onDownloadDocument}
          viewDocumentPending={viewDocumentPending}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          sectionComparison={
            sectionComparison
              ? {
                  beforeDetails: sectionComparison.beforeApp.business_details,
                  afterDetails: sectionComparison.afterApp.business_details,
                  beforeGuarantors:
                    (sectionComparison.beforeApp as { application?: { guarantors?: unknown } })
                      ?.application?.guarantors ?? sectionComparison.beforeApp.application_guarantors,
                  afterGuarantors:
                    (sectionComparison.afterApp as { application?: { guarantors?: unknown } })
                      ?.application?.guarantors ?? sectionComparison.afterApp.application_guarantors,
                  isPathChanged: sectionComparison.isPathChanged,
                }
              : undefined
          }
          hideSectionComments={hideSectionComments}
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
          sectionComparison={
            sectionComparison
              ? {
                  beforeApp: sectionComparison.beforeApp,
                  afterApp: sectionComparison.afterApp,
                  isPathChanged: sectionComparison.isPathChanged,
                }
              : undefined
          }
          hideSectionComments={hideSectionComments}
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
          onDownloadDocument={onDownloadDocument}
          onDownloadAllDocuments={onDownloadAllDocuments}
          isDownloadAllPending={downloadAllDocumentsPending}
          onApproveItem={(id) => onApproveItem(id, "document")}
          onRejectItem={(id) => onRejectItem(id, "document")}
          onRequestAmendmentItem={(id) => onRequestAmendmentItem(id, "document")}
          onResetItemToPending={onResetItemToPending ? (id) => onResetItemToPending(id, "document") : undefined}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          sectionComparison={
            sectionComparison
              ? {
                  beforeDocs: sectionComparison.beforeApp.supporting_documents,
                  afterDocs: sectionComparison.afterApp.supporting_documents,
                  isPathChanged: sectionComparison.isPathChanged,
                  amendmentRemarks: resubmitAmendmentRemarks,
                }
              : undefined
          }
          hideSectionComments={hideSectionComments}
          supportingDocumentsStepConfig={
            sectionComparison ? supportingDocumentsStepConfig ?? null : null
          }
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
            onDownloadDocument={onDownloadDocument}
            viewDocumentPending={viewDocumentPending}
            comments={sectionComments}
            onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
            sectionComparison={
              sectionComparison
                ? {
                    beforeCustomer: sectionComparison.beforeApp.contract?.customer_details,
                    afterCustomer: sectionComparison.afterApp.contract?.customer_details,
                    isPathChanged: sectionComparison.isPathChanged,
                  }
                : undefined
            }
            hideSectionComments={hideSectionComments}
          />
        );
      }
      return (
        <ContractSection
          applicationId={typeof app.id === "string" ? app.id : ""}
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
          onDownloadDocument={onDownloadDocument}
          viewDocumentPending={viewDocumentPending}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          onViewSignedContractOffer={onViewSignedContractOffer}
          signedContractOfferLetterAvailable={isSignedOfferLetterAvailable(
            (app.contract as { offer_signing?: unknown } | null | undefined)?.offer_signing
          )}
          viewSignedOfferLetterPending={viewSignedOfferLetterPending}
          sectionComparison={
            sectionComparison
              ? {
                  before: {
                    contractDetails: sectionComparison.beforeApp.contract?.contract_details,
                    customerDetails: sectionComparison.beforeApp.contract?.customer_details,
                    offerDetails: (sectionComparison.beforeApp.contract as { offer_details?: unknown } | null)
                      ?.offer_details,
                  },
                  after: {
                    contractDetails: sectionComparison.afterApp.contract?.contract_details,
                    customerDetails: sectionComparison.afterApp.contract?.customer_details,
                    offerDetails: (sectionComparison.afterApp.contract as { offer_details?: unknown } | null)
                      ?.offer_details,
                  },
                  isPathChanged: sectionComparison.isPathChanged,
                }
              : undefined
          }
          hideSectionComments={hideSectionComments}
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
          onDownloadDocument={onDownloadDocument}
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
          sectionComparison={
            sectionComparison
              ? (() => {
                  const bApp = sectionComparison.beforeApp;
                  const aApp = sectionComparison.afterApp;
                  const bContract = bApp.contract as typeof contract | null | undefined;
                  const aContract = aApp.contract as typeof contract | null | undefined;
                  const bOther =
                    applicationId && bContract?.invoices?.length
                      ? bContract.invoices.filter((inv) => inv.application_id !== applicationId)
                      : [];
                  const aOther =
                    applicationId && aContract?.invoices?.length
                      ? aContract.invoices.filter((inv) => inv.application_id !== applicationId)
                      : [];
                  return {
                    beforeInvoices: [...(bApp.invoices ?? []), ...bOther],
                    afterInvoices: [...(aApp.invoices ?? []), ...aOther],
                    isPathChanged: sectionComparison.isPathChanged,
                  };
                })()
              : undefined
          }
          hideSectionComments={hideSectionComments}
        />
      );
    }
    default:
      return null;
  }
}
