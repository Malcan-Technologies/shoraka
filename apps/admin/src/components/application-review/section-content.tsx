"use client";

/**
 * SECTION: Maps review tab descriptor to section UI
 * WHY: Single switch routes financial, documents, contract, etc.
 * INPUT: descriptor, application view, handlers, optional comparison snapshots
 * OUTPUT: The correct section component tree
 * WHERE USED: Admin application detail tabs, resubmit comparison modal
 */

import { resolveAdminReviewTabCapacity } from "./admin-review-capacity";
import { FinancialSection } from "./sections/financial-section";
import { BusinessSection } from "./sections/business-section";
import { DocumentsSection } from "./sections/documents-section";
import { AcceptanceSection } from "./sections/acceptance-section";
import { CompanySection } from "./sections/company-section";
import { ContractSection } from "./sections/contract-section";
import { CustomerSection } from "./sections/customer-section";
import { InvoiceSection } from "./sections/invoice-section";
import type { ReviewSectionId } from "./section-types";
import type { ReviewTabDescriptor } from "./review-registry";
import { isSignedContractOfferLetterAvailable } from "./offer-signing-availability";
import { useAdminSigningEnvelopes } from "@/hooks/use-signing-envelopes";
import type { SendInvoiceOfferUiPayload } from "@/components/utilisation-fee-lines";
import { parseItemScopeKey, type ReviewItemType } from "@cashsouk/types";

function acceptanceHubItemType(itemId: string, itemType?: ReviewItemType): ReviewItemType {
  if (itemType === "authorized_representatives" || itemType === "document" || itemType === "invoice") {
    return itemType;
  }
  const parsed = parseItemScopeKey(itemId).itemType;
  return parsed === "authorized_representatives" ? "authorized_representatives" : "document";
}

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
  people?: import("@cashsouk/types").ApplicationPersonRow[];
  directorShareholderListSource?: import("@cashsouk/types").DirectorShareholderListSource;
  ctosDirectorShareholderWarning?: string | null;
  created_at?: string;
  /** When present (e.g. live admin detail), used with workflow to filter review tabs. */
  visible_review_sections?: unknown;
  business_details?: unknown;
  application_guarantors?: unknown;
  supporting_documents?: unknown;
  acceptance_documents?: unknown;
  financing_type?: unknown;
  financing_structure?: unknown;
  company_details?: unknown;
  declarations?: unknown;
  financial_statements?: unknown;
  review_and_submit?: unknown;
  contract?: {
    id?: string;
    contract_details?: unknown;
    customer_details?: unknown;
    offer_details?: unknown;
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
    contract_id?: string | null;
    facilityFeeAvailableToReserve?: number | null;
  }[];
  application_review_items?: unknown;
  application_review_remarks?: unknown;
  inherited_acceptance?: {
    source_application_id: string;
    source_product_id: string | null;
    acceptance_documents: unknown;
    review_items: { item_type: string; item_id: string; status: string }[];
    product_workflow: unknown[] | null;
    product_version: number | null;
  } | null;
  issuer_organization_id?: string;
  issuer_organization?: {
    id?: string;
    name?: string | null;
    corporate_entities?: unknown;
    corporate_onboarding_data?: Record<string, unknown> | null;
    corporateOnboardingData?: Record<string, unknown> | null;
    bank_account_details?: Record<string, unknown> | null;
    bankAccountDetails?: Record<string, unknown> | null;
    business_aml_status?: unknown;
    latest_organization_ctos_company_json?: unknown | null;
    latest_organization_ctos_financials_json?: unknown | null;
    latest_organization_ctos_report_id?: string | null;
    latest_organization_ctos_fetched_at?: string | null;
    latest_organization_ctos_has_report_html?: boolean | null;
    latest_organization_ctos_subject_reports?: Array<{
      id: string;
      subject_ref: string | null;
      fetched_at: string;
      has_report_html: boolean;
    }> | null;
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
  /**
   * Same id as the application detail route / `useApplicationDetail` query key.
   * When set (live review page), Financial tab CTOS hooks refetch the correct cache entry.
   */
  liveApplicationId?: string;
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
  onApproveItem: (itemId: string, itemType: ReviewItemType) => Promise<void>;
  onRejectItem: (itemId: string, itemType: ReviewItemType) => void;
  onRequestAmendmentItem: (itemId: string, itemType: ReviewItemType) => void;
  onResetItemToPending?: (itemId: string, itemType: ReviewItemType) => void;
  onSendContractOffer?: (payload: {
    offeredFacility: number;
    facilityFeeRatePercent: number | null;
  }) => Promise<void>;
  onSendInvoiceOffer?: (payload: SendInvoiceOfferUiPayload) => Promise<void>;
  sendContractOfferPending?: boolean;
  sendInvoiceOfferPending?: boolean;
  onAddSectionComment?: (section: ReviewSectionId, comment: string) => Promise<void> | void;
  /** Min/max financing ratio (%) from product config. Used by invoice review Offered by CashSouk. */
  invoiceRatioLimits?: { min: number; max: number };
  /** Platform finance setting for the maximum platform fee rate (%) allowed on invoice offers. */
  platformFeeRateCapPercent?: number | null;
  /** Product-level default Facility Fee rate (%). Used only to prefill Facility Offer UI. */
  productDefaultFacilityFeeRatePercent?: number | null;
  /** Minimum months from today to maturity to enable Send Offer on invoice review. */
  minMonthsReviewToMaturityForOffer?: number | null;
  /** Map of section id to status. Used for contract facility resolution in invoice section. */
  sectionStatusMap?: ReadonlyMap<string, string>;
  onViewSignedInvoiceOffer?: (invoiceId: string) => void | Promise<void>;
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
  /**
   * Frozen product workflow (application.product_version) for Acceptance acknowledgements
   * and signing hub. Omit in resubmit comparison (docs-only).
   */
  productWorkflow?: unknown;
  /** When false, Acceptance signing actions (void/remind) are disabled. */
  canManageSigning?: boolean;
  productVersion?: number | null;
}

/** Renders section content by descriptor. Single place to map descriptor → component. */
export function SectionContent({
  descriptor,
  app,
  liveApplicationId,
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
  platformFeeRateCapPercent,
  productDefaultFacilityFeeRatePercent,
  minMonthsReviewToMaturityForOffer,
  sectionStatusMap,
  onViewSignedInvoiceOffer,
  onViewSignedContractOffer,
  viewSignedOfferLetterPending,
  sectionComparison,
  hideSectionComments = false,
  supportingDocumentsStepConfig = null,
  resubmitAmendmentRemarks,
  productWorkflow,
  canManageSigning = true,
  productVersion = null,
}: SectionContentProps) {
  const signingApplicationId =
    (typeof liveApplicationId === "string" && liveApplicationId) ||
    (typeof app.id === "string" ? app.id : "");
  const { data: signingEnvelopes = [] } = useAdminSigningEnvelopes(signingApplicationId);
  const signedContractOfferLetterAvailable = isSignedContractOfferLetterAvailable({
    contractId: app.contract?.id,
    envelopes: signingEnvelopes,
  });
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
  const adminReviewTabCapacity = resolveAdminReviewTabCapacity({
    app,
    contractSectionStatus: sectionStatusMap?.get("contract_details") ?? "",
  });

  switch (descriptor.kind) {
    case "financial":
      return (
        <FinancialSection
          applicationId={liveApplicationId ?? app.id ?? ""}
          issuerOrganizationId={app.issuer_organization_id ?? app.issuer_organization?.id ?? null}
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
          applicationId={app.id ?? ""}
          issuerOrganizationId={app.issuer_organization_id ?? app.issuer_organization?.id ?? null}
          issuerOrganization={app.issuer_organization}
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
    case "acceptance_documents": {
      const structureType = (app.financing_structure as { structure_type?: string } | null | undefined)
        ?.structure_type;
      const inherited = app.inherited_acceptance ?? null;
      const isInheritedAcceptance =
        structureType === "existing_contract" && inherited != null;
      const acceptanceDocuments = isInheritedAcceptance
        ? inherited.acceptance_documents
        : app.acceptance_documents;
      const acceptanceReviewItems = isInheritedAcceptance
        ? inherited.review_items
        : (app.application_review_items as
            | { item_type: string; item_id: string; status: string }[]
            | undefined) ?? [];
      const signingApplicationId = isInheritedAcceptance
        ? inherited.source_application_id
        : liveApplicationId;
      const acceptanceWorkflow = isInheritedAcceptance
        ? inherited.product_workflow ?? productWorkflow
        : productWorkflow;
      const acceptanceProductVersion = isInheritedAcceptance
        ? inherited.product_version ?? productVersion
        : productVersion;
      return (
        <AcceptanceSection
          supportingDocuments={acceptanceDocuments}
          reviewItems={acceptanceReviewItems}
          isReviewable={isReviewable && !isInheritedAcceptance}
          approvePending={approveItemPending}
          isActionLocked={isActionLocked || isInheritedAcceptance}
          actionLockTooltip={
            isInheritedAcceptance
              ? "Acceptance was completed when the linked facility was approved"
              : actionLockTooltip
          }
          viewDocumentPending={viewDocumentPending}
          onViewDocument={onViewDocument}
          onDownloadDocument={onDownloadDocument}
          onDownloadAllDocuments={onDownloadAllDocuments}
          isDownloadAllPending={downloadAllDocumentsPending}
          onApproveItem={(id, itemType) => onApproveItem(id, acceptanceHubItemType(id, itemType))}
          onRejectItem={(id, itemType) => onRejectItem(id, acceptanceHubItemType(id, itemType))}
          onRequestAmendmentItem={(id, itemType) =>
            onRequestAmendmentItem(id, acceptanceHubItemType(id, itemType))
          }
          onResetItemToPending={
            onResetItemToPending && !isInheritedAcceptance
              ? (id, itemType) => onResetItemToPending(id, acceptanceHubItemType(id, itemType))
              : undefined
          }
          comments={sectionComments}
          onAddComment={
            onAddSectionComment && !isInheritedAcceptance
              ? (comment) => onAddSectionComment(section, comment)
              : undefined
          }
          hideSectionComments={hideSectionComments || !!sectionComparison || isInheritedAcceptance}
          applicationId={sectionComparison ? undefined : signingApplicationId}
          workflow={acceptanceWorkflow}
          people={app.people ?? []}
          guarantors={app.application_guarantors}
          contractId={app.contract?.id ?? null}
          productVersion={acceptanceProductVersion}
          canManageSigning={canManageSigning && !isInheritedAcceptance}
          contractOfferDetails={app.contract?.offer_details}
          invoices={app.invoices ?? []}
          structureType={structureType}
          acceptanceReviewMode={isInheritedAcceptance ? "inherited" : "live"}
          inheritedSourceApplication={
            isInheritedAcceptance
              ? {
                  id: inherited.source_application_id,
                  productId: inherited.source_product_id,
                }
              : undefined
          }
          sectionStatus={sectionStatus}
          remainingCredit={adminReviewTabCapacity?.acceptance.remainingCredit}
          remainingAllocation={adminReviewTabCapacity?.acceptance.remainingAllocation}
        />
      );
    }
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
          productDefaultFacilityFeeRatePercent={productDefaultFacilityFeeRatePercent}
          productWorkflow={productWorkflow}
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
          signedContractOfferLetterAvailable={signedContractOfferLetterAvailable}
          viewSignedOfferLetterPending={viewSignedOfferLetterPending}
          reviewOccupancy={adminReviewTabCapacity?.contract}
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
        invoices?: { id: string; application_id: string; details?: unknown; status?: string; offer_details?: unknown }[];
      } | null;
      const contractInvoices = contract?.invoices ?? [];
      const applicationId = (app as { id?: string }).id;
      const otherContractInvoices =
        applicationId && app.contract && contractInvoices.length > 0
          ? contractInvoices.filter((inv) => inv.application_id !== applicationId)
          : [];
      const contractFacility =
        app.contract && adminReviewTabCapacity ? adminReviewTabCapacity.invoice : undefined;
      return (
        <InvoiceSection
          applicationId={signingApplicationId}
          invoices={appInvoices}
          otherFacilityInvoices={otherContractInvoices}
          contractFacility={contractFacility}
          contractId={app.contract?.id ?? null}
          contractHref={app.contract?.id ? `/contracts/${encodeURIComponent(app.contract.id)}` : null}
          contractLabel={
            typeof (app.contract as { displayReference?: string | null } | null)?.displayReference ===
            "string"
              ? (app.contract as { displayReference?: string | null }).displayReference
              : null
          }
          reviewItems={reviewItems}
          isReviewable={isReviewable}
          approvePending={approveItemPending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          onViewDocument={onViewDocument}
          onDownloadDocument={onDownloadDocument}
          viewDocumentPending={viewDocumentPending}
          invoiceRatioLimits={invoiceRatioLimits}
          platformFeeRateCapPercent={platformFeeRateCapPercent}
          onApproveItem={(id) => onApproveItem(id, "invoice")}
          onRejectItem={(id) => onRejectItem(id, "invoice")}
          onRequestAmendmentItem={(id) => onRequestAmendmentItem(id, "invoice")}
          onResetItemToPending={onResetItemToPending ? (id) => onResetItemToPending(id, "invoice") : undefined}
          onSendInvoiceOffer={onSendInvoiceOffer}
          isSendInvoiceOfferPending={sendInvoiceOfferPending}
          comments={sectionComments}
          onAddComment={onAddSectionComment ? (comment) => onAddSectionComment(section, comment) : undefined}
          minMonthsReviewToMaturityForOffer={minMonthsReviewToMaturityForOffer}
          productWorkflow={productWorkflow}
          onViewSignedInvoiceOffer={onViewSignedInvoiceOffer}
          sectionComparison={
            sectionComparison
              ? (() => {
                  const bApp = sectionComparison.beforeApp;
                  const aApp = sectionComparison.afterApp;
                  return {
                    beforeInvoices: bApp.invoices ?? [],
                    afterInvoices: aApp.invoices ?? [],
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
