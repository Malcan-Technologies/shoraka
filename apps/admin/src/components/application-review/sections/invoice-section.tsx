"use client";

import * as React from "react";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  REVIEW_EMPTY_LABEL,
  reviewEmptyStateClass,
  reviewLabelClass,
  reviewRowGridClass,
  reviewValueClass,
  formatReviewDate,
  formatFileSize,
} from "../review-section-styles";
import { ReviewSectionCard } from "../review-section-card";
import { ContractFacilitySummary } from "../contract-facility-summary";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ReviewFieldBlock } from "../review-field-block";
import { ComparisonFieldRow } from "../comparison-field-row";
import {
  ComparisonDocumentTitleRow,
  fileDocToComparisonChips,
} from "../comparison-document-pair";
import { formatCurrency, resolveOfferedAmount, resolveRequestedInvoiceAmount } from "@cashsouk/config";
import {
  formatFinancingTenureDaysLabel,
  parseFinancingTenureDays,
  isValidFinancingTenureDays,
} from "@cashsouk/types";
import { parseFacilityAmount } from "@/contracts/utils/contract-facility-metrics";
import type { SendInvoiceOfferUiPayload } from "@/components/utilisation-fee-lines";
import { ReviewStepStatusBadge } from "@/components/application-review/review-step-status-badge";
import { ItemActionDropdown } from "@/components/application-review/item-action-dropdown";
import { InvoiceOfferPanel } from "@/components/invoice-offer-panel";
import { FacilityImpact } from "@/components/financing/facility-impact";
import { isSignedInvoiceOfferLetterAvailable } from "@/components/application-review/offer-signing-availability";
import { useAdminSigningEnvelopes } from "@/hooks/use-signing-envelopes";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";

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
  invoiceRatioLimits?: { min: number; max: number };
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
  contractId?: string | null;
  contractHref?: string | null;
  contractLabel?: string | null;
}

const OTHER_FACILITY_INVOICE_HELPER =
  "This invoice belongs to another application and cannot be edited here.";

function invoiceDetailsDocumentChips(details: unknown) {
  const d = details as Record<string, unknown> | null | undefined;
  const doc = d?.document as { s3_key?: string; file_name?: string; file_size?: number } | undefined;
  return fileDocToComparisonChips(doc);
}

function invoiceDetailString(inv: { details?: unknown } | undefined, key: string): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const v = d[key] ?? d[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (v == null || v === "") return REVIEW_EMPTY_LABEL;
  return String(v);
}

function invoiceMaturityString(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const raw = d.maturity_date ?? d.maturityDate ?? d.due_date ?? d.dueDate;
  if (raw == null || raw === "") return REVIEW_EMPTY_LABEL;
  return String(raw);
}

function invoiceFinancingTenureDisplay(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  const parsed = parseFinancingTenureDays(d?.financing_tenure_days);
  if (parsed == null || !isValidFinancingTenureDays(parsed)) return REVIEW_EMPTY_LABEL;
  return formatFinancingTenureDaysLabel(parsed);
}

function invoiceFinancingRatioDisplay(inv: { details?: unknown } | undefined): string {
  if (!inv) return REVIEW_EMPTY_LABEL;
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const v = d.financing_ratio_percent ?? d.financingRatioPercent;
  if (v == null || v === "") return REVIEW_EMPTY_LABEL;
  if (typeof v === "number" && Number.isFinite(v)) return `${v}%`;
  const n = Number(String(v).replace(/,/g, ""));
  if (Number.isFinite(n)) return `${n}%`;
  return String(v);
}

function invoiceFinancingAmountDisplay(inv: {
  details?: unknown;
  offer_details?: unknown;
}): string {
  const offered = resolveOfferedAmount(inv.offer_details as Record<string, unknown> | null);
  if (offered > 0) return formatCurrency(offered);
  const requested = resolveRequestedInvoiceAmount(inv.details as Record<string, unknown> | undefined);
  return requested != null ? formatCurrency(requested) : REVIEW_EMPTY_LABEL;
}

function invoiceTabLabel(inv: {
  displayReference?: string | null;
  details?: unknown;
}): string {
  const reference = inv.displayReference?.trim();
  if (reference) return reference;
  const number = invoiceDetailString(inv, "number");
  return number !== REVIEW_EMPTY_LABEL ? number : "Invoice";
}

function buildInvoiceScopeKey(idx: number, invoiceNo: string | number): string {
  const sanitized = String(invoiceNo).replace(/:/g, "_");
  return `invoice_details:${idx}:${sanitized}`;
}

function invoiceDocument(details: unknown) {
  const d = details as Record<string, unknown> | null | undefined;
  return d?.document as { s3_key?: string; file_name?: string; file_size?: number } | undefined;
}

function InvoiceStackedFields({
  invoice,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  invoice: { details?: unknown; offer_details?: unknown };
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending: boolean;
}) {
  const doc = invoiceDocument(invoice.details);
  const valueRaw = invoiceDetailString(invoice, "value");
  const valueNum = Number(String(valueRaw).replace(/,/g, ""));
  const valueDisplay =
    Number.isFinite(valueNum) && valueNum > 0 ? formatCurrency(valueNum) : valueRaw;

  return (
    <div className={reviewRowGridClass}>
      <Label className={reviewLabelClass}>Invoice number</Label>
      <div className={reviewValueClass}>{invoiceDetailString(invoice, "number")}</div>
      <Label className={reviewLabelClass}>Maturity date</Label>
      <div className={reviewValueClass}>
        {invoiceMaturityString(invoice) === REVIEW_EMPTY_LABEL
          ? REVIEW_EMPTY_LABEL
          : formatReviewDate(invoiceMaturityString(invoice))}
      </div>
      <Label className={reviewLabelClass}>Financing tenure</Label>
      <div className={reviewValueClass}>{invoiceFinancingTenureDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Invoice value</Label>
      <div className={reviewValueClass}>{valueDisplay}</div>
      <Label className={reviewLabelClass}>Financing ratio</Label>
      <div className={reviewValueClass}>{invoiceFinancingRatioDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Financing amount</Label>
      <div className={reviewValueClass}>{invoiceFinancingAmountDisplay(invoice)}</div>
      <Label className={reviewLabelClass}>Document</Label>
      <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-input bg-background px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {doc?.file_name ?? REVIEW_EMPTY_LABEL}
          </div>
          {typeof doc?.file_size === "number" && doc.file_size > 0 ? (
            <div className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</div>
          ) : null}
        </div>
        {doc?.s3_key ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-9 gap-1"
              onClick={() => onViewDocument(doc.s3_key!)}
              disabled={viewDocumentPending}
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-9 gap-1"
              onClick={() => onDownloadDocument(doc.s3_key!, doc.file_name)}
              disabled={viewDocumentPending}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
  invoiceRatioLimits,
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
  const selectedTabId = switcherTabs.some((tab) => tab.id === activeInvoiceTab)
    ? activeInvoiceTab
    : defaultTabId;

  const ratioLimits = invoiceRatioLimits ?? { min: 60, max: 80 };

  return (
    <ReviewSectionCard title="Invoice" icon={DocumentTextIcon} hideSectionActions>
      {contractFacility ? (
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

      {thisTabs.length === 0 ? (
        <p className={reviewEmptyStateClass}>No invoices submitted.</p>
      ) : null}

      {switcherTabs.length > 0 && selectedTabId ? (
        <Tabs value={selectedTabId} onValueChange={setActiveInvoiceTab} className="w-full">
          {showTabStrip ? (
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
                <InvoiceStackedFields
                  invoice={inv}
                  onViewDocument={onViewDocument}
                  onDownloadDocument={onDownloadDocument}
                  viewDocumentPending={viewDocumentPending}
                />
              </ReviewFieldBlock>
            </TabsContent>
          ))}

          {thisTabs.map((inv, idx) => {
            const invoiceNo = invoiceDetailString(inv, "number");
            const scopeKey = buildInvoiceScopeKey(
              idx,
              invoiceNo !== REVIEW_EMPTY_LABEL ? invoiceNo : idx + 1
            );
            const reviewItemStatus =
              reviewItems.find((r) => r.item_id === scopeKey)?.status ?? "PENDING";
            const entityStatus = inv.status?.toString().toUpperCase() ?? "";
            const status =
              entityStatus === "WITHDRAWN"
                ? "WITHDRAWN"
                : entityStatus === "OFFER_EXPIRED"
                  ? "OFFER_EXPIRED"
                  : reviewItemStatus;
            const isAdminRejected = reviewItemStatus === "REJECTED";
            const isRowReadOnly = readOnlyInvoiceIds?.has(inv.id) ?? false;
            const isTabLocked = !!isActionLocked || !isReviewable;
            const isInvoiceFinalizedByIssuer = reviewItemStatus === "APPROVED";
            const signedOfferAvailable = isSignedInvoiceOfferLetterAvailable({
              invoiceId: inv.id,
              envelopes: signingEnvelopes,
            });
            const isInvoiceWithdrawn = status === "WITHDRAWN";
            const isRowGreyedOut =
              isRowReadOnly || isTabLocked || isInvoiceFinalizedByIssuer || isInvoiceWithdrawn;
            const showFullActionMenu = isReviewable && !isRowGreyedOut;
            const showSignedOfferOnlyMenu =
              !!onViewSignedInvoiceOffer && signedOfferAvailable && !showFullActionMenu;

            return (
              <TabsContent
                key={inv.id}
                value={`this:${inv.id}`}
                className="mt-0 space-y-8 focus-visible:outline-none"
              >
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
                        showApprove={false}
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
                <ReviewFieldBlock title="Offer to issuer">
                  <InvoiceOfferPanel
                    invoice={inv}
                    applicationId={applicationId}
                    reviewItemStatus={status}
                    isRowGreyedOut={isRowGreyedOut}
                    isAdminRejected={isAdminRejected}
                    invoiceRatioLimits={ratioLimits}
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
              </TabsContent>
            );
          })}
        </Tabs>
      ) : null}

      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
