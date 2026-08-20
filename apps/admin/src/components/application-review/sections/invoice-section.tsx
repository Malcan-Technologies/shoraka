"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { REVIEW_EMPTY_LABEL, reviewEmptyStateClass } from "../review-section-styles";
import { ReviewSectionCard } from "../review-section-card";
import { InvoiceList } from "@/components/invoice-review-list";
import { ContractFacilitySummary } from "../contract-facility-summary";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ReviewFieldBlock } from "../review-field-block";
import { ComparisonFieldRow } from "../comparison-field-row";
import {
  ComparisonDocumentTitleRow,
  fileDocToComparisonChips,
} from "../comparison-document-pair";
import { formatCurrency, resolveOfferedAmount } from "@cashsouk/config";
import type { SoukscoreRiskRating } from "@cashsouk/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReviewStepStatusBadge } from "@/components/application-review/review-step-status-badge";
import {
  applicationTableHeaderBgClass,
  applicationTableRowClass,
  applicationTableWrapperClass,
} from "@/components/application-review/application-table-styles";

export interface InvoiceSectionProps {
  /** Live application id — used to resolve signed offer-letter availability from envelopes. */
  applicationId?: string;
  invoices: {
    id: string;
    details?: unknown;
    status?: string;
    offer_details?: unknown;
    offer_signing?: unknown;
  }[];
  /** Invoices on the same facility but owned by other applications (read-only context). */
  otherFacilityInvoices?: {
    id: string;
    application_id: string;
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
  onSendInvoiceOffer?: (payload: {
    invoiceId: string;
    offeredAmount: number;
    offeredRatioPercent: number;
    offeredProfitRatePercent: number;
    platformFeeRatePercent: number;
    risk_rating: SoukscoreRiskRating;
  }) => Promise<void>;
  isSendInvoiceOfferPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  onViewSignedInvoiceOffer?: (invoiceId: string) => void | Promise<void>;
  sectionComparison?: {
    beforeInvoices: InvoiceSectionProps["invoices"];
    afterInvoices: InvoiceSectionProps["invoices"];
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
}

function invoiceDetailsDocumentChips(details: unknown) {
  const d = details as Record<string, unknown> | null | undefined;
  const doc = d?.document as { s3_key?: string; file_name?: string; file_size?: number } | undefined;
  return fileDocToComparisonChips(doc);
}

function invoiceDetailString(inv: { details?: unknown }, key: string): string {
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return REVIEW_EMPTY_LABEL;
  const v = d[key] ?? d[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (v == null || v === "") return REVIEW_EMPTY_LABEL;
  return String(v);
}

/** Same precedence as invoice review list: maturity_date, else due_date. */
function invoiceMaturityString(inv: { details?: unknown } | undefined): string {
  if (!inv) return "—";
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return "—";
  const raw =
    d.maturity_date ??
    d.maturityDate ??
    d.due_date ??
    d.dueDate;
  if (raw == null || raw === "") return REVIEW_EMPTY_LABEL;
  return String(raw);
}

/** Match invoice list: ratio with % suffix when numeric. */
function invoiceFinancingRatioDisplay(inv: { details?: unknown } | undefined): string {
  if (!inv) return "—";
  const d = inv.details as Record<string, unknown> | null | undefined;
  if (!d) return "—";
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
  const d = inv.details as Record<string, unknown> | null | undefined;
  const value = d?.value;
  const ratio = d?.financing_ratio_percent ?? d?.financingRatioPercent;
  const valueNum = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  const ratioNum = typeof ratio === "number" ? ratio : Number(String(ratio ?? "").replace(/,/g, ""));
  if (Number.isFinite(valueNum) && Number.isFinite(ratioNum) && valueNum > 0) {
    return formatCurrency((valueNum * ratioNum) / 100);
  }
  return REVIEW_EMPTY_LABEL;
}

function FacilityOtherInvoicesTable({
  invoices,
}: {
  invoices: NonNullable<InvoiceSectionProps["otherFacilityInvoices"]>;
}) {
  if (invoices.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Other invoices on this facility</h4>
      <p className="text-meta text-muted-foreground">
        These invoices belong to other applications. Review and send offers on this application&apos;s
        invoice below.
      </p>
      <div className={applicationTableWrapperClass}>
        <Table>
          <TableHeader className={applicationTableHeaderBgClass}>
            <TableRow>
              <TableHead className="text-sm font-semibold">Invoice</TableHead>
              <TableHead className="text-sm font-semibold">Status</TableHead>
              <TableHead className="text-sm font-semibold text-right">Financing</TableHead>
              <TableHead className="text-sm font-semibold">Application</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id} className={applicationTableRowClass}>
                <TableCell className="text-ui">{invoiceDetailString(inv, "number")}</TableCell>
                <TableCell>
                  <ReviewStepStatusBadge status={inv.status ?? "PENDING"} />
                </TableCell>
                <TableCell className="text-ui text-right tabular-nums">
                  {invoiceFinancingAmountDisplay(inv)}
                </TableCell>
                <TableCell className="font-mono text-meta text-muted-foreground">
                  {inv.application_id}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
  sectionComparison,
  hideSectionComments = false,
}: InvoiceSectionProps) {
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
                <ReviewFieldBlock key={id} title={`Invoice ${invoiceDetailString(bInv ?? aInv!, "number") !== REVIEW_EMPTY_LABEL ? invoiceDetailString(bInv ?? aInv!, "number") : id}`}>
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

  return (
    <ReviewSectionCard title="Invoice" icon={DocumentTextIcon} hideSectionActions>
      {contractFacility && (
        <ContractFacilitySummary
          contractFacility={contractFacility.contractFacility}
          availableFacility={contractFacility.availableFacility}
          utilizedFacility={contractFacility.utilizedFacility}
          pendingFacility={contractFacility.pendingFacility}
        />
      )}
      {otherFacilityInvoices && otherFacilityInvoices.length > 0 ? (
        <FacilityOtherInvoicesTable invoices={otherFacilityInvoices} />
      ) : null}
      {invoices?.length ? (
        <InvoiceList
          applicationId={applicationId}
          invoices={invoices}
          readOnlyInvoiceIds={readOnlyInvoiceIds}
          reviewItems={reviewItems}
          isReviewable={!!isReviewable}
          onViewDocument={onViewDocument}
          isViewDocumentPending={viewDocumentPending}
          invoiceRatioLimits={invoiceRatioLimits ?? { min: 60, max: 80 }}
          platformFeeRateCapPercent={platformFeeRateCapPercent}
          minMonthsReviewToMaturityForOffer={minMonthsReviewToMaturityForOffer}
          productWorkflow={productWorkflow}
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
          remainingAvailableFacility={contractFacility?.availableFacility}
        />
      ) : (
        <p className={reviewEmptyStateClass}>No invoices submitted.</p>
      )}
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
