"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircleIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isInvoiceOnlyFinancingStructure,
  parseItemScopeKey,
  paymasterIdentityOfferBlockReason,
  workflowHasAcceptanceDocuments,
  workflowHasSigningPackage,
  type ReviewItemType,
} from "@cashsouk/types";
import { useAdminSigningEnvelopes } from "@/hooks/use-signing-envelopes";
import { ContractFacilitySummary } from "../contract-facility-summary";
import { resolveAdminReviewTabCapacity } from "../admin-review-capacity";
import { isSignedContractOfferLetterAvailable } from "../offer-signing-availability";
import type { ReviewTabDescriptor } from "../review-registry";
import type { ReviewSectionId } from "../section-types";
import { InvoiceSection, OTHER_FACILITY_INVOICE_HELPER } from "../sections/invoice-section";
import {
  InvoiceStackedFields,
  invoiceFinancingAmountDisplay,
  invoiceTabLabel,
} from "../sections/invoice-stacked-fields";
import type { SectionContentProps, SectionCommentRecord } from "../section-content";
import {
  advanceOpenOfferAcceptanceStages,
  buildOfferAcceptanceStageModel,
  isReferenceOfferAcceptanceStage,
  type OfferAcceptanceStageId,
} from "./offer-acceptance-stages";
import {
  isOtherInvoiceTabId,
  otherInvoiceApplicationHref,
  otherInvoiceTabId,
  parseOtherInvoiceTabId,
  resolveThisAppInvoiceIdForStages,
  thisInvoiceTabId,
} from "./offer-acceptance-invoice-selection";
import { OfferAcceptanceStageCard } from "./stage-card";
import {
  StageCustomerReview,
  StageFacilityReference,
  StageFacilityReview,
  StageInvoiceReview,
} from "./stage-review";
import { StageFacilitySendOffer, StageInvoiceSendOffer } from "./stage-send-offer";
import { StageIssuerResponse } from "./stage-issuer-response";
import {
  StageAcceptanceDocuments,
  StageInheritedAcceptance,
} from "./stage-acceptance-documents";
import { StageSigningPackage } from "./stage-signing-package";
import { MergedSectionComments } from "./merged-section-comments";

function acceptanceHubItemType(itemId: string, itemType?: ReviewItemType): ReviewItemType {
  if (itemType === "authorized_representatives" || itemType === "document" || itemType === "invoice") {
    return itemType;
  }
  const parsed = parseItemScopeKey(itemId).itemType;
  return parsed === "authorized_representatives" ? "authorized_representatives" : "document";
}

export function OfferAcceptanceSection(
  props: SectionContentProps & { descriptor: ReviewTabDescriptor }
) {
  const {
    descriptor,
    app,
    liveApplicationId,
    isReviewable,
    approveSectionPending,
    approveItemPending,
    viewDocumentPending,
    sectionActionLocks,
    offerAcceptanceFocusStageId,
    onResetSectionToPending,
    onApproveSection,
    onRejectSection,
    onRequestAmendmentSection,
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
    invoiceProductRules,
    contractProductRules,
    platformFeeRateCapPercent,
    productDefaultFacilityFeeRatePercent,
    minMonthsReviewToMaturityForOffer,
    sectionStatusMap,
    onViewSignedInvoiceOffer,
    onViewSignedContractOffer,
    viewSignedOfferLetterPending,
    hideSectionComments = false,
    productWorkflow,
    canManageSigning = true,
  } = props;

  const structureType =
    (app.financing_structure as { structure_type?: string } | null | undefined)?.structure_type ??
    "new_contract";
  const isInvoiceOnly = isInvoiceOnlyFinancingStructure(app.financing_structure);
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
  const adminReviewTabCapacity = resolveAdminReviewTabCapacity({
    app,
    contractSectionStatus: sectionStatusMap?.get("contract_details") ?? "",
  });
  const offerIdentityBlockReason = paymasterIdentityOfferBlockReason({
    submitted: (app.contract?.customer_details as Record<string, unknown> | null | undefined) ?? null,
    paymaster: app.contract?.paymaster ?? null,
  });

  const appInvoices = app.invoices ?? [];
  const contract = app.contract as {
    invoices?: {
      id: string;
      application_id: string;
      product_id?: string | null;
      details?: unknown;
      status?: string;
      offer_details?: unknown;
      displayReference?: string | null;
    }[];
  } | null;
  const contractInvoices = contract?.invoices ?? [];
  const applicationId = typeof app.id === "string" ? app.id : "";
  const otherContractInvoices =
    !isInvoiceOnly && applicationId && app.contract && contractInvoices.length > 0
      ? contractInvoices.filter((inv) => inv.application_id !== applicationId)
      : [];
  const otherTabs = otherContractInvoices.filter(
    (inv) => (inv.status ?? "").toUpperCase() !== "WITHDRAWN"
  );
  const thisTabs = appInvoices;
  const switcherTabs = [
    ...otherTabs.map((inv) => ({
      id: otherInvoiceTabId(inv.id),
      kind: "other" as const,
      invoice: inv,
      label: invoiceTabLabel(inv),
    })),
    ...thisTabs.map((inv) => ({
      id: thisInvoiceTabId(inv.id),
      kind: "this" as const,
      invoice: inv,
      label: invoiceTabLabel(inv),
    })),
  ];
  const showInvoiceSwitcher = structureType !== "new_contract" && switcherTabs.length > 1;
  const defaultTabId =
    thisTabs.length > 0
      ? thisInvoiceTabId(thisTabs[thisTabs.length - 1]!.id)
      : otherTabs.length > 0
        ? otherInvoiceTabId(otherTabs[0]!.id)
        : null;
  const [invoiceTabId, setInvoiceTabId] = React.useState<string | null>(null);
  const selectedTabId = switcherTabs.some((tab) => tab.id === invoiceTabId)
    ? invoiceTabId
    : defaultTabId;
  const selectedIsOther = isOtherInvoiceTabId(selectedTabId);
  const selectedThisAppInvoiceId = resolveThisAppInvoiceIdForStages({
    selectedTabId,
    thisAppInvoiceIds: thisTabs.map((inv) => inv.id),
  });
  const selectedOtherInvoiceId = parseOtherInvoiceTabId(selectedTabId);
  const selectedOtherInvoice =
    selectedOtherInvoiceId != null
      ? (otherTabs.find((inv) => inv.id === selectedOtherInvoiceId) ?? null)
      : null;
  const selectedInvoice =
    thisTabs.find((inv) => inv.id === selectedThisAppInvoiceId) ?? thisTabs[thisTabs.length - 1] ?? null;
  const otherInvoiceHref = otherInvoiceApplicationHref({
    applicationId: selectedOtherInvoice?.application_id,
    productId: selectedOtherInvoice?.product_id,
  });

  const contractLock = sectionActionLocks?.contract_details;
  const invoiceLock = sectionActionLocks?.invoice_details;
  const acceptanceLock = sectionActionLocks?.acceptance_documents;
  const inherited = app.inherited_acceptance ?? null;
  const isInheritedAcceptance = structureType === "existing_contract" && inherited != null;
  const sourceRef =
    app.inherited_guarantors?.source_display_reference ??
    (inherited as { source_display_reference?: string | null } | null)?.source_display_reference ??
    null;
  const inheritedSourceApplication =
    isInheritedAcceptance && inherited
      ? { id: inherited.source_application_id, productId: inherited.source_product_id }
      : undefined;

  const stageModel = buildOfferAcceptanceStageModel({
    structureType,
    contractStatus: app.contract?.status,
    contractOfferDetails: app.contract?.offer_details,
    invoices: appInvoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      offer_details: inv.offer_details,
      contract_id: inv.contract_id,
      details: inv.details,
    })),
    selectedInvoiceId: selectedThisAppInvoiceId,
    sectionStatuses: sectionStatusMap,
    reviewItems,
    signingEnvelopes,
    sectionLocks: sectionActionLocks,
    applicationWithdrawn: app.status === "WITHDRAWN",
    hasAcceptanceDocumentsSection:
      productWorkflow != null
        ? workflowHasAcceptanceDocuments(productWorkflow)
        : Boolean(descriptor.mergedSections?.includes("acceptance_documents")),
    hasSigningPackage:
      productWorkflow != null
        ? workflowHasSigningPackage(productWorkflow)
        : Boolean(descriptor.mergedSections?.includes("acceptance_documents")),
    sourceApplicationDisplayReference: sourceRef,
    canManageSigning,
  });

  const [openStageIds, setOpenStageIds] = React.useState<Set<OfferAcceptanceStageId>>(
    () => new Set([stageModel.currentStageId])
  );
  const previousCurrentStageIdRef = React.useRef(stageModel.currentStageId);

  const scrollStageIntoView = React.useCallback((stageId: OfferAcceptanceStageId) => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`offer-acceptance-stage-${stageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.focus();
    });
  }, []);

  React.useEffect(() => {
    const previousCurrentId = previousCurrentStageIdRef.current;
    const nextCurrentId = stageModel.currentStageId;
    if (previousCurrentId === nextCurrentId) return;
    previousCurrentStageIdRef.current = nextCurrentId;
    setOpenStageIds((prev) =>
      advanceOpenOfferAcceptanceStages(prev, previousCurrentId, nextCurrentId)
    );
    scrollStageIntoView(nextCurrentId);
  }, [scrollStageIntoView, stageModel.currentStageId]);

  const expandStage = React.useCallback((stageId: OfferAcceptanceStageId) => {
    setOpenStageIds((prev) => {
      if (prev.has(stageId)) return prev;
      const next = new Set(prev);
      next.add(stageId);
      return next;
    });
    scrollStageIntoView(stageId);
  }, [scrollStageIntoView]);

  const appliedFocusStageIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!offerAcceptanceFocusStageId) {
      appliedFocusStageIdRef.current = null;
      return;
    }
    if (appliedFocusStageIdRef.current === offerAcceptanceFocusStageId) return;
    appliedFocusStageIdRef.current = offerAcceptanceFocusStageId;
    expandStage(offerAcceptanceFocusStageId as OfferAcceptanceStageId);
  }, [expandStage, offerAcceptanceFocusStageId]);

  const facilityContractId = isInvoiceOnly ? null : (app.contract?.id ?? null);
  const contractFacility =
    !isInvoiceOnly && app.contract && adminReviewTabCapacity ? adminReviewTabCapacity.invoice : undefined;
  const showCapacityStrip = !isInvoiceOnly && !!contractFacility;
  const contractComments = reviewComments.filter(
    (entry) => entry.scope === "comment" && entry.scope_key?.startsWith("contract_details:")
  );
  const invoiceComments = reviewComments.filter(
    (entry) => entry.scope === "comment" && entry.scope_key?.startsWith("invoice_details:")
  );

  const contractSectionProps = {
    applicationId: applicationId,
    contractDetails: app.contract?.contract_details,
    offerDetails: app.contract?.offer_details,
    contractStatus: app.contract?.status,
    customerDetails: app.contract?.customer_details,
    paymaster: app.contract?.paymaster,
    paymasterId: app.contract?.paymaster_id ?? app.contract?.paymaster?.id,
    productDefaultFacilityFeeRatePercent,
    contractProductRules,
    productWorkflow,
    section: "contract_details" as ReviewSectionId,
    isReviewable,
    approvePending: approveSectionPending,
    isActionLocked: !!contractLock?.locked,
    actionLockTooltip: contractLock?.tooltip,
    sectionStatus: sectionStatusMap?.get("contract_details"),
    onResetSectionToPending,
    onApprove: onApproveSection,
    onReject: onRejectSection,
    onRequestAmendment: onRequestAmendmentSection,
    onSendOffer: onSendContractOffer,
    isSendOfferPending: sendContractOfferPending,
    onViewDocument,
    onDownloadDocument,
    viewDocumentPending,
    comments: contractComments.map((entry) => ({ ...entry, comment: entry.remark })),
    onViewSignedContractOffer,
    signedContractOfferLetterAvailable,
    viewSignedOfferLetterPending,
    reviewOccupancy: adminReviewTabCapacity?.contract,
  };

  const customerSectionProps = {
    customerDetails: app.contract?.customer_details,
    paymaster: app.contract?.paymaster,
    paymasterId: app.contract?.paymaster_id ?? app.contract?.paymaster?.id,
    applicationId,
    section: "contract_details" as ReviewSectionId,
    isReviewable,
    approvePending: approveSectionPending,
    isActionLocked: !!contractLock?.locked,
    actionLockTooltip: contractLock?.tooltip,
    sectionStatus: sectionStatusMap?.get("contract_details"),
    onResetSectionToPending,
    onApprove: onApproveSection,
    onReject: onRejectSection,
    onRequestAmendment: onRequestAmendmentSection,
    onViewDocument,
    onDownloadDocument,
    viewDocumentPending,
    comments: contractComments.map((entry) => ({ ...entry, comment: entry.remark })),
  };

  const customerSectionStatus = (sectionStatusMap?.get("contract_details") ?? "").toUpperCase();
  const customerReviewComplete =
    customerSectionStatus === "APPROVED" || customerSectionStatus === "COMPLETED";
  const invoiceActionLocked =
    !!invoiceLock?.locked || (isInvoiceOnly && !customerReviewComplete);
  const invoiceSectionProps = {
    applicationId: signingApplicationId,
    invoices: appInvoices,
    otherFacilityInvoices: otherContractInvoices,
    contractFacility,
    contractId: facilityContractId,
    contractHref: facilityContractId ? `/contracts/${encodeURIComponent(facilityContractId)}` : null,
    contractLabel:
      isInvoiceOnly
        ? null
        : typeof (app.contract as { displayReference?: string | null } | null)?.displayReference ===
            "string"
          ? (app.contract as { displayReference?: string | null }).displayReference
          : null,
    reviewItems,
    isReviewable,
    approvePending: approveItemPending,
    isActionLocked: invoiceActionLocked,
    actionLockTooltip: invoiceActionLocked
      ? invoiceLock?.tooltip ||
        (isInvoiceOnly && !customerReviewComplete
          ? "Approve Customer details first."
          : undefined)
      : undefined,
    onViewDocument,
    onDownloadDocument,
    viewDocumentPending,
    invoiceProductRules,
    platformFeeRateCapPercent,
    onApproveItem: (id: string) => onApproveItem(id, "invoice"),
    onRejectItem: (id: string) => onRejectItem(id, "invoice"),
    onRequestAmendmentItem: (id: string) => onRequestAmendmentItem(id, "invoice"),
    onResetItemToPending: onResetItemToPending
      ? (id: string) => onResetItemToPending(id, "invoice")
      : undefined,
    onSendInvoiceOffer,
    isSendInvoiceOfferPending: sendInvoiceOfferPending,
    comments: invoiceComments.map((entry) => ({ ...entry, comment: entry.remark })),
    minMonthsReviewToMaturityForOffer,
    productWorkflow,
    onViewSignedInvoiceOffer,
    suggestedMarcGrade: app.issuer_organization?.marcAssessment?.creditGrade ?? null,
    offerIdentityBlockReason,
    selectedInvoiceTabId: selectedTabId,
    onSelectedInvoiceTabIdChange: setInvoiceTabId,
  };

  const acceptanceDocuments = isInheritedAcceptance
    ? inherited.acceptance_documents
    : app.acceptance_documents;
  const acceptanceReviewItems = isInheritedAcceptance
    ? inherited.review_items
    : reviewItems;
  const signingHubApplicationId = isInheritedAcceptance
    ? inherited.source_application_id
    : liveApplicationId;
  const acceptanceWorkflow = isInheritedAcceptance
    ? inherited.product_workflow ?? productWorkflow
    : productWorkflow;
  const acceptanceSectionStatus = sectionStatusMap?.get("acceptance_documents");

  const acceptanceSectionProps = {
    supportingDocuments: acceptanceDocuments,
    reviewItems: acceptanceReviewItems,
    isReviewable: isReviewable && !isInheritedAcceptance,
    approvePending: approveItemPending,
    isActionLocked: !!acceptanceLock?.locked || isInheritedAcceptance,
    actionLockTooltip: isInheritedAcceptance
      ? "Acceptance was completed when the linked facility was approved"
      : acceptanceLock?.tooltip,
    viewDocumentPending,
    onViewDocument,
    onDownloadDocument,
    onDownloadAllDocuments,
    isDownloadAllPending: downloadAllDocumentsPending,
    onApproveItem: (id: string, itemType?: ReviewItemType) =>
      onApproveItem(id, acceptanceHubItemType(id, itemType)),
    onRejectItem: (id: string, itemType?: ReviewItemType) =>
      onRejectItem(id, acceptanceHubItemType(id, itemType)),
    onRequestAmendmentItem: (id: string, itemType?: ReviewItemType) =>
      onRequestAmendmentItem(id, acceptanceHubItemType(id, itemType)),
    onResetItemToPending:
      onResetItemToPending && !isInheritedAcceptance
        ? (id: string, itemType?: ReviewItemType) =>
            onResetItemToPending(id, acceptanceHubItemType(id, itemType))
        : undefined,
    comments: [],
    applicationId: signingHubApplicationId,
    workflow: acceptanceWorkflow,
    guarantors: app.application_guarantors,
    canManageSigning: canManageSigning && !isInheritedAcceptance,
    contractOfferDetails: app.contract?.offer_details,
    invoices: app.invoices ?? [],
    selectedInvoiceId: stageModel.offerType === "invoice" ? selectedThisAppInvoiceId : null,
    structureType,
    acceptanceReviewMode: isInheritedAcceptance ? ("inherited" as const) : ("live" as const),
    inheritedSourceApplication,
    sectionStatus: acceptanceSectionStatus,
    remainingCredit: adminReviewTabCapacity?.acceptance.remainingCredit,
    remainingAllocation: adminReviewTabCapacity?.acceptance.remainingAllocation,
  };

  const commercialOfferDetails =
    stageModel.offerType === "facility" ? app.contract?.offer_details : selectedInvoice?.offer_details;
  const commercialEntityStatus =
    stageModel.offerType === "facility" ? app.contract?.status : selectedInvoice?.status;
  const showInvoiceStages = structureType !== "new_contract";
  const workflowStages = stageModel.stages.filter((stage) => !isReferenceOfferAcceptanceStage(stage));
  const lastWorkflowStageId = workflowStages[workflowStages.length - 1]?.id ?? null;
  const nextAction = selectedIsOther ? null : stageModel.nextAction;

  return (
    <div className="space-y-4">
      {nextAction ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-[1.125rem]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-[13.75rem] flex-1">
            <p className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
              Next action — {nextAction.stageName}
            </p>
            <p className="mt-1 text-base font-semibold text-pretty">{nextAction.headline}</p>
            <p className="mt-1 text-ui text-muted-foreground text-pretty">{nextAction.detail}</p>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11"
            onClick={() => expandStage(nextAction.targetStageId)}
          >
            {nextAction.primaryLabel}
          </Button>
        </div>
      ) : null}

      {showCapacityStrip && contractFacility ? (
        <ContractFacilitySummary
          variant="kpi-strip"
          contractFacility={contractFacility.contractFacility}
          availableFacility={contractFacility.availableFacility}
          utilizedFacility={contractFacility.utilizedFacility}
          pendingFacility={contractFacility.pendingFacility}
          lifetimeCap={contractFacility.lifetimeCap}
          lifetimeUsed={contractFacility.lifetimeUsed}
          lifetimeRemaining={contractFacility.lifetimeRemaining}
        />
      ) : null}

      {showInvoiceSwitcher && selectedTabId ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            Invoice
          </span>
          <div className="flex flex-wrap gap-1.5">
            {switcherTabs.map((tab) => {
              const active = tab.id === selectedTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInvoiceTabId(tab.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-card font-semibold text-primary"
                      : "border-border bg-card font-medium text-foreground hover:border-primary/30"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className="text-meta text-muted-foreground tabular-nums">
                    {invoiceFinancingAmountDisplay(tab.invoice)}
                  </span>
                  {tab.kind === "other" ? (
                    <span className="inline-flex h-5 items-center rounded-full bg-muted px-1.5 text-meta font-semibold uppercase tracking-wide text-muted-foreground">
                      Other app
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedIsOther ? (
        <div className="flex gap-2.5 rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-ui text-muted-foreground">
          <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {OTHER_FACILITY_INVOICE_HELPER}
            {otherInvoiceHref ? (
              <>
                {" "}
                <Link
                  href={otherInvoiceHref}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open that application
                </Link>
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {selectedIsOther ? (
        selectedOtherInvoice ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="px-4 py-4 sm:px-[1.125rem]">
            <InvoiceStackedFields
              invoice={selectedOtherInvoice}
              onViewDocument={onViewDocument}
              onDownloadDocument={onDownloadDocument}
              viewDocumentPending={viewDocumentPending}
            />
          </div>
        </div>
        ) : null
      ) : (
      <div className="flex flex-col">
        {stageModel.stages.map((stage) => {
          const workflowNumber = workflowStages.findIndex((item) => item.id === stage.id) + 1;
          return (
          <OfferAcceptanceStageCard
            key={stage.id}
            stage={stage}
            workflowNumber={workflowNumber > 0 ? workflowNumber : null}
            isCurrent={!isReferenceOfferAcceptanceStage(stage) && stage.id === stageModel.currentStageId}
            isLastWorkflow={stage.id === lastWorkflowStageId}
            open={openStageIds.has(stage.id)}
            onOpenChange={(open) => {
              setOpenStageIds((prev) => {
                const next = new Set(prev);
                if (open) next.add(stage.id);
                else next.delete(stage.id);
                return next;
              });
            }}
          >
            {stage.id === "facility_review" ? (
              <StageFacilityReview {...contractSectionProps} />
            ) : null}
            {stage.id === "facility_reference" ? (
              <StageFacilityReference {...contractSectionProps} />
            ) : null}
            {stage.id === "customer_review" ? (
              <StageCustomerReview {...customerSectionProps} />
            ) : null}
            {stage.id === "invoice_review" && showInvoiceStages ? (
              <StageInvoiceReview {...invoiceSectionProps} />
            ) : null}
            {stage.id === "send_offer" && stageModel.offerType === "facility" ? (
              <StageFacilitySendOffer {...contractSectionProps} />
            ) : null}
            {stage.id === "send_offer" && stageModel.offerType === "invoice" ? (
              <StageInvoiceSendOffer {...invoiceSectionProps} />
            ) : null}
            {stage.id === "issuer_response" ? (
              <StageIssuerResponse
                offerDetails={commercialOfferDetails}
                entityStatus={commercialEntityStatus}
                offerType={stageModel.offerType}
                showParties={structureType !== "existing_contract"}
                reviewItems={reviewItems}
                reviewRemarks={reviewComments}
                acceptanceProps={
                  structureType === "existing_contract" ? undefined : acceptanceSectionProps
                }
              />
            ) : null}
            {stage.id === "acceptance_documents" ? (
              <StageAcceptanceDocuments {...acceptanceSectionProps} />
            ) : null}
            {stage.id === "signing_package" ? (
              <StageSigningPackage {...acceptanceSectionProps} />
            ) : null}
            {stage.id === "inherited_acceptance" ? (
              <StageInheritedAcceptance {...acceptanceSectionProps} />
            ) : null}
          </OfferAcceptanceStageCard>
          );
        })}
      </div>
      )}

      {structureType === "new_contract" && appInvoices.length > 0 ? (
        <InvoiceSection
          {...invoiceSectionProps}
          hideCapacity
          hideSectionComments
        />
      ) : null}

      {hideSectionComments ? null : (
        <MergedSectionComments
          comments={reviewComments}
          structureType={structureType}
          mergedSections={descriptor.mergedSections}
          onAddComment={onAddSectionComment}
        />
      )}
    </div>
  );
}
