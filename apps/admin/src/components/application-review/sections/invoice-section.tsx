"use client";

import * as React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { REVIEW_EMPTY_LABEL, reviewEmptyStateClass } from "../review-section-styles";
import { ReviewSectionCard } from "../review-section-card";
import { ContractFacilitySummary } from "../contract-facility-summary";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ReviewFieldBlock } from "../review-field-block";
import { ComparisonFieldRow } from "../comparison-field-row";
import { ComparisonDocumentTitleRow } from "../comparison-document-pair";
import { formatCurrency, resolveOfferedAmount, resolveRequestedInvoiceAmount } from "@cashsouk/config";
import { readInvoiceProductRules, SC_MONTHLY_CAMPAIGN, type InvoiceProductRules } from "@cashsouk/types";
import { parseFacilityAmount } from "@/contracts/utils/contract-facility-metrics";
import type { SendInvoiceOfferUiPayload } from "@/components/utilisation-fee-lines";
import { ReviewStepStatusBadge } from "@/components/application-review/review-step-status-badge";
import { ItemActionDropdown } from "@/components/application-review/item-action-dropdown";
import { InvoiceOfferPanel } from "@/components/invoice-offer-panel";
import { FacilityImpact } from "@/components/financing/facility-impact";
import { isSignedInvoiceOfferLetterAvailable } from "@/components/application-review/offer-signing-availability";
import { useAdminSigningEnvelopes } from "@/hooks/use-signing-envelopes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import {
  InvoiceStackedFields,
  invoiceDetailString,
  invoiceDetailsDocumentChips,
  invoiceFinancingRatioDisplay,
  invoiceFinancingTenureDisplay,
  invoiceMaturityString,
  invoiceSubmittedCampaignSectorLabel,
  invoiceSubmittedCompanyCategoryLabel,
  invoiceSubmittedSustainabilityCategoryLabel,
  invoiceTabLabel,
} from "./invoice-stacked-fields";
import { invoiceReviewScopeKey } from "./invoice-review-scope";

export interface InvoiceSectionProps {
  /** Live application id — used to resolve signed offer-letter availability from envelopes. */
  applicationId?: string;
  invoices: {
    id: string;
    displayReference?: string | null;
    details?: unknown;
    status?: string;
    offer_details?: unknown;
    offer_signing?: unknown;
    contract_id?: string | null;
    facilityFeeAvailableToReserve?: number | null;
  }[];
  /** Invoices on the same facility but owned by other applications (read-only context). */
  otherFacilityInvoices?: {
    id: string;
    application_id: string;
    displayReference?: string | null;
    details?: unknown;
    status?: string;
    offer_details?: unknown;
  }[];
  /** @deprecated Other-contract rows are shown in otherFacilityInvoices instead. */
  readOnlyInvoiceIds?: Set<string>;
  /** When set, shows Approved Facility, Available Facility and Utilized Facility above the invoice list (facility applications only) */
  contractFacility?: {
    contractFacility: number;
    availableFacility: number;
    utilizedFacility: number;
    pendingFacility?: number;
    lifetimeCap?: number;
    lifetimeUsed?: number;
    lifetimeRemaining?: number;
    isOverLimit?: boolean;
  };
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending: boolean;
  invoiceProductRules?: InvoiceProductRules;
  platformFeeRateCapPercent?: number | null;
  minMonthsReviewToMaturityForOffer?: number | null;
  /** Frozen product workflow — Send Offer acceptance-deadline preview. */
  productWorkflow?: unknown;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  onSendInvoiceOffer?: (payload: SendInvoiceOfferUiPayload) => Promise<void>;
  isSendInvoiceOfferPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  onViewSignedInvoiceOffer?: (invoiceId: string) => void | Promise<void>;
  suggestedMarcGrade?: string | null;
  offerIdentityBlockReason?: string | null;
  sectionComparison?: {
    beforeInvoices: InvoiceSectionProps["invoices"];
    afterInvoices: InvoiceSectionProps["invoices"];
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
  /**
   * Unified Offer & acceptance stages:
   * - full (default): current Invoice tab
   * - review: stacked fields, item actions, FacilityImpact
   * - offer: InvoiceOfferPanel (and other-app lock copy)
   */
  contentMode?: "full" | "review" | "offer";
  /** Skip Invoice card chrome when nested in a stage card. */
  embedded?: boolean;
  /** Hide ContractFacilitySummary when the parent already shows the KPI strip. */
  hideCapacity?: boolean;
  /** Hide the invoice chip strip when the parent owns the switcher. */
  hideSwitcher?: boolean;
  /** Controlled switcher tab id (`this:{id}` / `other:{id}`). */
  selectedInvoiceTabId?: string | null;
  onSelectedInvoiceTabIdChange?: (tabId: string) => void;
  contractId?: string | null;
  contractHref?: string | null;
  contractLabel?: string | null;
}

export const OTHER_FACILITY_INVOICE_HELPER =
  "This invoice belongs to another application and cannot be edited here.";

export { buildInvoiceScopeKey, invoiceReviewScopeKey } from "./invoice-review-scope";

export function InvoiceSection({
  applicationId,
  invoices,
  otherFacilityInvoices,
  readOnlyInvoiceIds,
  contractFacility,
  reviewItems,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
  invoiceProductRules,
  platformFeeRateCapPercent,
  minMonthsReviewToMaturityForOffer,
  productWorkflow,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  onSendInvoiceOffer,
  isSendInvoiceOfferPending,
  comments,
  onAddComment,
  onViewSignedInvoiceOffer,
  suggestedMarcGrade = null,
  offerIdentityBlockReason = null,
  sectionComparison,
  hideSectionComments = false,
  contentMode = "full",
  embedded = false,
  hideCapacity = false,
  hideSwitcher = false,
  selectedInvoiceTabId,
  onSelectedInvoiceTabIdChange,
  contractId,
  contractHref,
  contractLabel,
}: InvoiceSectionProps) {
  const { data: signingEnvelopes = [] } = useAdminSigningEnvelopes(applicationId ?? "");
  const [activeInvoiceTab, setActiveInvoiceTab] = React.useState<string | null>(null);

  if (sectionComparison) {
    const { beforeInvoices, afterInvoices, isPathChanged } = sectionComparison;
    const byId = (arr: typeof beforeInvoices) =>
      new Map(arr.map((inv) => [inv.id, inv] as const));
    const bMap = byId(beforeInvoices);
    const aMap = byId(afterInvoices);
    const ids = Array.from(new Set([...bMap.keys(), ...aMap.keys()])).sort();

    return (
      <ReviewSectionCard title="Invoice" icon={DocumentTextIcon} hideSectionActions>
        {ids.length === 0 ? (
          <p className={reviewEmptyStateClass}>No invoices in these snapshots.</p>
        ) : (
          <div className="space-y-8">
            {ids.map((id) => {
              const bInv = bMap.get(id);
              const aInv = aMap.get(id);
              const pathHit = `invoices[${id}]`;
              const changed = isPathChanged("invoices") || isPathChanged(pathHit);
              const bOffer = bInv?.offer_details as Record<string, unknown> | undefined;
              const aOffer = aInv?.offer_details as Record<string, unknown> | undefined;
              const bOffAmt = resolveOfferedAmount(bOffer);
              const aOffAmt = resolveOfferedAmount(aOffer);
              return (
                <ReviewFieldBlock
                  key={id}
                  title={invoiceTabLabel(bInv ?? aInv!)}
                >
                  <div className="space-y-2">
                    <ComparisonFieldRow
                      label="Invoice Value"
                      before={
                        bInv
                          ? (() => {
                              const raw = invoiceDetailString(bInv, "value");
                              const n = Number(String(raw).replace(/,/g, ""));
                              return Number.isFinite(n) && n > 0 ? formatCurrency(n) : raw;
                            })()
                          : "—"
                      }
                      after={
                        aInv
                          ? (() => {
                              const raw = invoiceDetailString(aInv, "value");
                              const n = Number(String(raw).replace(/,/g, ""));
                              return Number.isFinite(n) && n > 0 ? formatCurrency(n) : raw;
                            })()
                          : "—"
                      }
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Maturity Date"
                      before={bInv ? invoiceMaturityString(bInv) : "—"}
                      after={aInv ? invoiceMaturityString(aInv) : "—"}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Financing Tenure"
                      before={bInv ? invoiceFinancingTenureDisplay(bInv) : "—"}
                      after={aInv ? invoiceFinancingTenureDisplay(aInv) : "—"}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Financing Ratio"
                      before={bInv ? invoiceFinancingRatioDisplay(bInv) : "—"}
                      after={aInv ? invoiceFinancingRatioDisplay(aInv) : "—"}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Financing Amount"
                      before={bOffAmt > 0 ? formatCurrency(bOffAmt) : REVIEW_EMPTY_LABEL}
                      after={aOffAmt > 0 ? formatCurrency(aOffAmt) : REVIEW_EMPTY_LABEL}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label={SC_MONTHLY_CAMPAIGN.companyCategory.label}
                      before={invoiceSubmittedCompanyCategoryLabel(bInv)}
                      after={invoiceSubmittedCompanyCategoryLabel(aInv)}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label={SC_MONTHLY_CAMPAIGN.campaignSector.label}
                      before={invoiceSubmittedCampaignSectorLabel(bInv)}
                      after={invoiceSubmittedCampaignSectorLabel(aInv)}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label={SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label}
                      before={invoiceSubmittedSustainabilityCategoryLabel(bInv)}
                      after={invoiceSubmittedSustainabilityCategoryLabel(aInv)}
                      changed={changed}
                    />
                    <ComparisonDocumentTitleRow
                      title="Document"
                      beforeFiles={bInv ? invoiceDetailsDocumentChips(bInv.details) : []}
                      afterFiles={aInv ? invoiceDetailsDocumentChips(aInv.details) : []}
                      markChanged={changed}
                      onViewDocument={onViewDocument}
                      onDownloadDocument={onDownloadDocument}
                      viewDocumentPending={viewDocumentPending}
                    />
                  </div>
                </ReviewFieldBlock>
              );
            })}
          </div>
        )}
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

  const otherTabs = (otherFacilityInvoices ?? []).filter(
    (inv) => (inv.status ?? "").toUpperCase() !== "WITHDRAWN"
  );
  const thisTabs = invoices;
  const switcherTabs = [
    ...otherTabs.map((inv) => ({
      id: `other:${inv.id}`,
      kind: "other" as const,
      invoice: inv,
      label: invoiceTabLabel(inv),
    })),
    ...thisTabs.map((inv) => ({
      id: `this:${inv.id}`,
      kind: "this" as const,
      invoice: inv,
      label: invoiceTabLabel(inv),
    })),
  ];
  const showTabStrip = switcherTabs.length > 1;
  const defaultTabId =
    thisTabs.length > 0
      ? `this:${thisTabs[thisTabs.length - 1].id}`
      : otherTabs.length > 0
        ? `other:${otherTabs[0].id}`
        : null;
  const selectedTabId = switcherTabs.some(
    (tab) => tab.id === (selectedInvoiceTabId ?? activeInvoiceTab)
  )
    ? (selectedInvoiceTabId ?? activeInvoiceTab)
    : defaultTabId;
  const handleInvoiceTabChange = onSelectedInvoiceTabIdChange ?? setActiveInvoiceTab;
  const showCapacity = !!contractFacility && !hideCapacity;
  const showOfferPanel = contentMode === "full" || contentMode === "offer";
  const showReviewDetails = contentMode === "full" || contentMode === "review";
  const showComments = !hideSectionComments && contentMode === "full";

  const resolvedInvoiceProductRules = invoiceProductRules ?? readInvoiceProductRules([]);

  return (
    <ReviewSectionCard title="Invoice" icon={DocumentTextIcon} hideSectionActions embedded={embedded}>
      {showCapacity && contractFacility ? (
        <ContractFacilitySummary
          contractFacility={contractFacility.contractFacility}
          availableFacility={contractFacility.availableFacility}
          utilizedFacility={contractFacility.utilizedFacility}
          pendingFacility={contractFacility.pendingFacility}
          lifetimeCap={contractFacility.lifetimeCap}
          lifetimeUsed={contractFacility.lifetimeUsed}
          lifetimeRemaining={contractFacility.lifetimeRemaining}
        />
      ) : null}

      {thisTabs.length === 0 && showReviewDetails ? (
        <p className={reviewEmptyStateClass}>No invoices submitted.</p>
      ) : null}

      {switcherTabs.length > 0 && selectedTabId ? (
        <Tabs value={selectedTabId} onValueChange={handleInvoiceTabChange} className="w-full">
          {showTabStrip && !hideSwitcher ? (
            <div className="mb-4 w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-xl bg-muted p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
              <TabsList className="flex h-auto min-h-11 w-max min-w-full flex-nowrap justify-start gap-2 bg-transparent p-0 text-muted-foreground">
                {switcherTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex shrink-0 items-center gap-2 rounded-lg px-3 text-ui data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-4"
                  >
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          ) : null}

          {otherTabs.map((inv) => (
            <TabsContent key={inv.id} value={`other:${inv.id}`} className="mt-0 focus-visible:outline-none">
              <ReviewFieldBlock title="Invoice details">
                <p className="mb-2 text-sm text-muted-foreground">{OTHER_FACILITY_INVOICE_HELPER}</p>
                {showReviewDetails ? (
                  <InvoiceStackedFields
                    invoice={inv}
                    onViewDocument={onViewDocument}
                    onDownloadDocument={onDownloadDocument}
                    viewDocumentPending={viewDocumentPending}
                  />
                ) : null}
              </ReviewFieldBlock>
            </TabsContent>
          ))}

          {thisTabs.map((inv, idx) => {
            const scopeKey = invoiceReviewScopeKey(inv, idx);
            const reviewItemStatus =
              reviewItems.find((r) => r.item_id === scopeKey)?.status ?? "PENDING";
            const entityStatus = inv.status?.toString().toUpperCase() ?? "";
            const status =
              entityStatus === "WITHDRAWN"
                ? "WITHDRAWN"
                : entityStatus === "OFFER_EXPIRED"
                  ? "OFFER_EXPIRED"
                  : reviewItemStatus;
            const isAdminRejected =
              reviewItemStatus === "REJECTED" || entityStatus === "REJECTED";
            const isRowReadOnly = readOnlyInvoiceIds?.has(inv.id) ?? false;
            const isTabLocked = !!isActionLocked || !isReviewable;
            const isInvoiceFinalizedByIssuer = entityStatus === "APPROVED";
            const signedOfferAvailable = isSignedInvoiceOfferLetterAvailable({
              invoiceId: inv.id,
              envelopes: signingEnvelopes,
            });
            const isInvoiceWithdrawn = status === "WITHDRAWN";
            const isRowGreyedOut =
              isRowReadOnly || isTabLocked || isInvoiceFinalizedByIssuer || isInvoiceWithdrawn;
            const showFullActionMenu = isReviewable && !isRowGreyedOut && showReviewDetails;
            const showSignedOfferOnlyMenu =
              !!onViewSignedInvoiceOffer && signedOfferAvailable && !showFullActionMenu;

            return (
              <TabsContent
                key={inv.id}
                value={`this:${inv.id}`}
                className="mt-0 space-y-8 focus-visible:outline-none"
              >
                {showReviewDetails ? (
                <ReviewFieldBlock
                  title="Invoice details"
                  titleAside={<ReviewStepStatusBadge status={status} />}
                  titleEnd={
                    showFullActionMenu ? (
                      <ItemActionDropdown
                        itemId={scopeKey}
                        status={status}
                        isPending={approvePending}
                        isActionLocked={isActionLocked}
                        actionLockTooltip={actionLockTooltip}
                        onApprove={onApproveItem}
                        onReject={onRejectItem}
                        onRequestAmendment={onRequestAmendmentItem}
                        onResetToPending={onResetItemToPending}
                        showApprove={
                          !isAdminRejected &&
                          reviewItemStatus !== "OFFER_SENT" &&
                          reviewItemStatus !== "OFFER_EXPIRED" &&
                          reviewItemStatus !== "WITHDRAWN"
                        }
                        showRequestAmendment={!isAdminRejected}
                        onViewSignedOffer={
                          signedOfferAvailable && onViewSignedInvoiceOffer
                            ? () => void onViewSignedInvoiceOffer(inv.id)
                            : undefined
                        }
                      />
                    ) : showSignedOfferOnlyMenu ? (
                      <ItemActionDropdown
                        itemId={scopeKey}
                        status={status}
                        isPending={approvePending}
                        viewSignedOfferOnly
                        onViewSignedOffer={() => {
                          if (onViewSignedInvoiceOffer && signedOfferAvailable) {
                            void onViewSignedInvoiceOffer(inv.id);
                          }
                        }}
                      />
                    ) : undefined
                  }
                >
                  <InvoiceStackedFields
                    invoice={inv}
                    onViewDocument={onViewDocument}
                    onDownloadDocument={onDownloadDocument}
                    viewDocumentPending={viewDocumentPending}
                  />
                </ReviewFieldBlock>
                ) : null}
                {showReviewDetails && contractId ? (
                  <FacilityImpact
                    contractId={contractId}
                    contractHref={contractHref}
                    contractLabel={contractLabel}
                    financingAmount={
                      resolveOfferedAmount(inv.offer_details as Record<string, unknown> | null) ||
                      resolveRequestedInvoiceAmount(inv.details as Record<string, unknown> | undefined)
                    }
                    invoiceFace={parseFacilityAmount(
                      (inv.details as Record<string, unknown> | undefined)?.value
                    )}
                    invoiceStatus={inv.status}
                  />
                ) : null}
                {showOfferPanel ? (
                <ReviewFieldBlock
                  title="Offer to issuer"
                  titleEnd={
                    !showReviewDetails && showSignedOfferOnlyMenu ? (
                      <ItemActionDropdown
                        itemId={scopeKey}
                        status={status}
                        isPending={approvePending}
                        viewSignedOfferOnly
                        onViewSignedOffer={() => {
                          if (onViewSignedInvoiceOffer && signedOfferAvailable) {
                            void onViewSignedInvoiceOffer(inv.id);
                          }
                        }}
                      />
                    ) : undefined
                  }
                >
                  <InvoiceOfferPanel
                    invoice={inv}
                    applicationId={applicationId}
                    facilityContractId={contractId}
                    reviewItemStatus={status}
                    isRowGreyedOut={isRowGreyedOut}
                    isAdminRejected={isAdminRejected}
                    invoiceProductRules={resolvedInvoiceProductRules}
                    platformFeeRateCapPercent={platformFeeRateCapPercent}
                    minMonthsReviewToMaturityForOffer={minMonthsReviewToMaturityForOffer}
                    productWorkflow={productWorkflow}
                    onSendInvoiceOffer={onSendInvoiceOffer}
                    isSendInvoiceOfferPending={isSendInvoiceOfferPending}
                    onResetItemToPending={onResetItemToPending}
                    isItemActionPending={approvePending}
                    remainingAvailableFacility={contractFacility?.availableFacility}
                    remainingAllocation={contractFacility?.lifetimeRemaining}
                    facilityOverLimit={contractFacility?.isOverLimit}
                    scopeKey={scopeKey}
                    suggestedMarcGrade={suggestedMarcGrade}
                    offerIdentityBlockReason={offerIdentityBlockReason}
                  />
                </ReviewFieldBlock>
                ) : null}
              </TabsContent>
            );
          })}
        </Tabs>
      ) : null}

      {showComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
