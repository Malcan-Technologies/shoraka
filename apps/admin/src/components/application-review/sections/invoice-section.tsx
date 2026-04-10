"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { REVIEW_EMPTY_LABEL, reviewEmptyStateClass } from "../review-section-styles";
import { ReviewSectionCard } from "../review-section-card";
import { InvoiceList } from "@/components/invoice-review-list";
import { ContractFacilitySummary } from "../contract-facility-summary";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ReviewFieldBlock } from "../review-field-block";
import { ComparisonFieldRow } from "../comparison-field-row";
import { formatCurrency, resolveOfferedAmount } from "@cashsouk/config";

export interface InvoiceSectionProps {
  invoices: {
    id: string;
    details?: unknown;
    status?: string;
    offer_details?: unknown;
    offer_signing?: unknown;
  }[];
  /** Invoice IDs that are from other applications (same contract) - read-only, actions locked */
  readOnlyInvoiceIds?: Set<string>;
  /** When set, shows Contract Facility, Available Facility and Utilized Facility above the invoice list (contract applications only) */
  contractFacility?: {
    contractFacility: number;
    availableFacility: number;
    utilizedFacility: number;
  };
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onViewDocument: (s3Key: string) => void;
  viewDocumentPending: boolean;
  invoiceRatioLimits?: { min: number; max: number };
  offerExpiryDays?: number | null;
  minMonthsReviewToMaturityForOffer?: number | null;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  onSendInvoiceOffer?: (payload: {
    invoiceId: string;
    offeredAmount: number;
    offeredRatioPercent: number;
    offeredProfitRatePercent: number;
  }) => Promise<void>;
  isSendInvoiceOfferPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  onViewSignedInvoiceOffer?: (signedOfferLetterS3Key: string) => void | Promise<void>;
  sectionComparison?: {
    beforeInvoices: InvoiceSectionProps["invoices"];
    afterInvoices: InvoiceSectionProps["invoices"];
    isPathChanged: (path: string) => boolean;
  };
}

function invoiceDetailString(inv: { details?: unknown }, key: string): string {
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const v = d[key] ?? d[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (v == null || v === "") return REVIEW_EMPTY_LABEL;
  return String(v);
}

export function InvoiceSection({
  invoices,
  readOnlyInvoiceIds,
  contractFacility,
  reviewItems,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  onViewDocument,
  viewDocumentPending,
  invoiceRatioLimits,
  offerExpiryDays,
  minMonthsReviewToMaturityForOffer,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  onSendInvoiceOffer,
  isSendInvoiceOfferPending,
  comments,
  onAddComment,
  onViewSignedInvoiceOffer,
  sectionComparison,
}: InvoiceSectionProps) {
  if (sectionComparison) {
    console.log("InvoiceSection comparison mode");
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
                <ReviewFieldBlock key={id} title={`Invoice ${invoiceDetailString(bInv ?? aInv!, "number") !== REVIEW_EMPTY_LABEL ? invoiceDetailString(bInv ?? aInv!, "number") : id}`}>
                  <div className="space-y-2">
                    <ComparisonFieldRow
                      label="Invoice value"
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
                      label="Due date"
                      before={bInv ? invoiceDetailString(bInv, "due_date") : "—"}
                      after={aInv ? invoiceDetailString(aInv, "due_date") : "—"}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Maturity date"
                      before={bInv ? invoiceDetailString(bInv, "maturity_date") : "—"}
                      after={aInv ? invoiceDetailString(aInv, "maturity_date") : "—"}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Financing ratio %"
                      before={bInv ? invoiceDetailString(bInv, "financing_ratio_percent") : "—"}
                      after={aInv ? invoiceDetailString(aInv, "financing_ratio_percent") : "—"}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Offered amount (persisted)"
                      before={bOffAmt > 0 ? formatCurrency(bOffAmt) : REVIEW_EMPTY_LABEL}
                      after={aOffAmt > 0 ? formatCurrency(aOffAmt) : REVIEW_EMPTY_LABEL}
                      changed={changed}
                    />
                    <ComparisonFieldRow
                      label="Invoice document"
                      before={
                        ((bInv?.details as Record<string, unknown> | undefined)?.document as Record<
                          string,
                          unknown
                        > | undefined)?.file_name
                          ? String(
                              ((bInv?.details as Record<string, unknown>)?.document as Record<
                                string,
                                unknown
                              >).file_name
                            )
                          : "—"
                      }
                      after={
                        ((aInv?.details as Record<string, unknown> | undefined)?.document as Record<
                          string,
                          unknown
                        > | undefined)?.file_name
                          ? String(
                              ((aInv?.details as Record<string, unknown>)?.document as Record<
                                string,
                                unknown
                              >).file_name
                            )
                          : "—"
                      }
                      changed={changed}
                    />
                  </div>
                </ReviewFieldBlock>
              );
            })}
          </div>
        )}
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      </ReviewSectionCard>
    );
  }

  return (
    <ReviewSectionCard title="Invoice" icon={DocumentTextIcon} hideSectionActions>
      {contractFacility && (
        <ContractFacilitySummary
          contractFacility={contractFacility.contractFacility}
          availableFacility={contractFacility.availableFacility}
          utilizedFacility={contractFacility.utilizedFacility}
        />
      )}
      {invoices?.length ? (
        <InvoiceList
          invoices={invoices}
          readOnlyInvoiceIds={readOnlyInvoiceIds}
          reviewItems={reviewItems}
          isReviewable={!!isReviewable}
          onViewDocument={onViewDocument}
          isViewDocumentPending={viewDocumentPending}
          invoiceRatioLimits={invoiceRatioLimits ?? { min: 60, max: 80 }}
          offerExpiryDays={offerExpiryDays}
          minMonthsReviewToMaturityForOffer={minMonthsReviewToMaturityForOffer}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          onApproveItem={onApproveItem}
          onRejectItem={onRejectItem}
          onRequestAmendmentItem={onRequestAmendmentItem}
          onResetItemToPending={onResetItemToPending}
          isItemActionPending={approvePending}
          onSendInvoiceOffer={onSendInvoiceOffer}
          isSendInvoiceOfferPending={isSendInvoiceOfferPending}
          onViewSignedInvoiceOffer={onViewSignedInvoiceOffer}
        />
      ) : (
        <p className={reviewEmptyStateClass}>No invoices submitted.</p>
      )}
      <SectionComments comments={comments} onSubmitComment={onAddComment} />
    </ReviewSectionCard>
  );
}
