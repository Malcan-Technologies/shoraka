"use client";

import * as React from "react";
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { format, addDays, differenceInDays, isValid, min as minDate } from "date-fns";
import {
  formatCurrency,
  resolveOfferedAmount,
  resolveOfferedProfitRate,
  maturityMeetsMinimumMonthsFrom,
  parseInvoiceMaturityDate,
} from "@cashsouk/config";
import {
  isSoukscoreRiskRating,
  SOUKSCORE_RISK_RATING_GRADES,
  type SoukscoreRiskRating,
} from "@cashsouk/types";
import { ItemActionDropdown } from "@/components/application-review/item-action-dropdown";
import { ReviewStepStatusBadge } from "@/components/application-review/review-step-status-badge";
import { REVIEW_EMPTY_LABEL } from "@/components/application-review/review-section-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@cashsouk/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applicationTableHeaderBgClass,
  applicationTableRowClass,
  applicationTableRowGreyedClass,
  applicationTableWrapperClass,
  applicationTableExpandableRowClass,
  applicationTableExpandableContentClass,
  applicationTableExpandableGridClass,
  applicationTableExpandableSectionTitleClass,
  applicationTableExpandableLabelClass,
  applicationTableExpandableFieldBlockClass,
  applicationTableExpandableValueClass,
  applicationTableExpandableFieldGapClass,
} from "@/components/application-review/application-table-styles";
import { isSignedOfferLetterAvailable } from "@/components/application-review/offer-signing-availability";

const PROFIT_RATE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

/** Read-only label/value stack in invoice expand rows. */
const invoiceExpandReadonlyFieldBlockClass = "space-y-1";

/** Same width for ratio input, profit, and risk so controls line up. */
const OFFER_CONTROL_WIDTH_CLASS = "h-9 w-full min-w-[5.5rem] max-w-[7rem] rounded-xl border-border bg-background text-[15px]";

const invoiceSummaryCellCenterClass = "text-[15px] px-3 py-2 align-middle text-center";
const invoiceSummaryCellNumericClass = "text-[15px] px-3 py-2 align-middle text-right tabular-nums";
const invoiceSummaryHeadCenterClass = "text-sm font-semibold text-foreground px-3 py-2 text-center";
const invoiceSummaryHeadNumericClass =
  "text-sm font-semibold text-foreground px-3 py-2 text-right tabular-nums";

interface InvoiceReviewListProps {
  invoices: {
    id: string;
    details?: unknown;
    document?: unknown;
    status?: string;
    offer_details?: unknown;
    offer_signing?: unknown;
  }[];
  /** Invoice IDs from other applications (same contract) - read-only, actions locked */
  readOnlyInvoiceIds?: Set<string>;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onViewDocument: (s3Key: string) => void;
  isViewDocumentPending: boolean;
  invoiceRatioLimits: { min: number; max: number };
  /** Product offer expiry in days. Used for estimated disbursement, period, profit and offer expiry date. */
  offerExpiryDays?: number | null;
  /** From product workflow: minimum months from today to maturity required to enable Send Offer. */
  minMonthsReviewToMaturityForOffer?: number | null;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  isItemActionPending: boolean;
  onSendInvoiceOffer?: (payload: {
    invoiceId: string;
    offeredAmount: number;
    offeredRatioPercent: number;
    offeredProfitRatePercent: number;
    risk_rating: SoukscoreRiskRating;
  }) => Promise<void>;
  isSendInvoiceOfferPending?: boolean;
  /** Opens signed offer document using the same document view-url flow. */
  onViewSignedInvoiceOffer?: (signedOfferLetterS3Key: string) => void | Promise<void>;
}

interface InvoiceDetails {
  number?: string | number;
  value?: string | number;
  due_date?: string;
  maturity_date?: string;
  financing_ratio_percent?: string | number;
  document?: {
    file_name?: string;
    s3_key?: string;
  };
}

function parseMaturityDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isValid(parsed) ? parsed : null;
}

function computeOfferEstimates(
  offerExpiryDays: number,
  maturityDateStr: string | undefined,
  offeredAmount: number
): {
  offerExpiryDate: Date;
  estDisbursementDate: Date;
  estPeriodDays: number | null;
  estProfit: number | null;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offerExpiryDate = addDays(today, offerExpiryDays);
  const estDisbursementRaw = addDays(offerExpiryDate, 15);
  const maturityDate = parseMaturityDate(maturityDateStr);
  const estDisbursementDate =
    maturityDate !== null ? minDate([estDisbursementRaw, maturityDate]) : estDisbursementRaw;
  const estPeriodDays =
    maturityDate !== null
      ? Math.max(0, differenceInDays(maturityDate, estDisbursementDate))
      : null;
  const estProfit =
    estPeriodDays !== null && estPeriodDays > 0
      ? offeredAmount * 0.12 * (estPeriodDays / 365)
      : null;
  return {
    offerExpiryDate,
    estDisbursementDate,
    estPeriodDays,
    estProfit,
  };
}

function buildInvoiceScopeKey(idx: number, invoiceNo: string | number): string {
  const sanitized = String(invoiceNo).replace(/:/g, "_");
  return `invoice_details:${idx}:${sanitized}`;
}

function getItemStatus(
  _inv: { status?: string },
  reviewItems: { item_type: string; item_id: string; status: string }[],
  scopeKey: string
): string {
  return reviewItems.find((r) => r.item_id === scopeKey)?.status ?? "PENDING";
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateValue(value: string | undefined): string {
  if (!value) return REVIEW_EMPTY_LABEL;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "dd MMM yyyy");
}

type OfferedState = { ratio: number; profitRate: number };

export function InvoiceList({
  invoices,
  readOnlyInvoiceIds,
  reviewItems,
  isReviewable,
  onViewDocument,
  isViewDocumentPending,
  invoiceRatioLimits,
  offerExpiryDays,
  minMonthsReviewToMaturityForOffer,
  isActionLocked,
  actionLockTooltip,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  isItemActionPending,
  onSendInvoiceOffer,
  isSendInvoiceOfferPending,
  onViewSignedInvoiceOffer,
}: InvoiceReviewListProps) {
  const [expandedById, setExpandedById] = React.useState<Record<string, boolean>>({});
  const [invoiceOfferConfirm, setInvoiceOfferConfirm] = React.useState<{
    invoiceId: string;
    invoiceNo: string | number;
    offeredAmount: number;
    offeredRatioPercent: number;
    offeredProfitRatePercent: number;
    invoiceValue: number | null;
    risk_rating: SoukscoreRiskRating;
  } | null>(null);

  React.useEffect(() => {
    setExpandedById((prev) => {
      const next = { ...prev };
      let changed = false;
      invoices.forEach((inv) => {
        if (!(inv.id in next)) {
          next[inv.id] = !(readOnlyInvoiceIds?.has(inv.id) ?? false);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [invoices, readOnlyInvoiceIds]);

  const initialOfferedFromInvoices = React.useMemo(() => {
    const result: Record<string, OfferedState> = {};
    invoices.forEach((inv) => {
      const offer = inv.offer_details as
        | { offered_ratio_percent?: number; offered_profit_rate_percent?: number }
        | null
        | undefined;
      if (offer?.offered_ratio_percent != null || offer?.offered_profit_rate_percent != null) {
        const ratio =
          typeof offer.offered_ratio_percent === "number" && Number.isFinite(offer.offered_ratio_percent)
            ? Math.max(
                invoiceRatioLimits.min,
                Math.min(invoiceRatioLimits.max, offer.offered_ratio_percent)
              )
            : invoiceRatioLimits.min;
        const profitRate =
          typeof offer.offered_profit_rate_percent === "number" &&
          Number.isFinite(offer.offered_profit_rate_percent) &&
          (PROFIT_RATE_OPTIONS as readonly number[]).includes(offer.offered_profit_rate_percent)
            ? offer.offered_profit_rate_percent
            : 12;
        result[inv.id] = { ratio, profitRate };
      }
    });
    return result;
  }, [invoices, invoiceRatioLimits]);

  const [offeredByInvoice, setOfferedByInvoice] = React.useState<Record<string, OfferedState>>({});
  React.useEffect(() => {
    if (Object.keys(initialOfferedFromInvoices).length > 0) {
      setOfferedByInvoice((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [invoiceId, state] of Object.entries(initialOfferedFromInvoices)) {
          if (next[invoiceId]?.ratio !== state.ratio || next[invoiceId]?.profitRate !== state.profitRate) {
            next[invoiceId] = state;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [initialOfferedFromInvoices]);

  const initialRiskFromInvoices = React.useMemo(() => {
    const result: Record<string, SoukscoreRiskRating> = {};
    invoices.forEach((inv) => {
      const raw = (inv.offer_details as Record<string, unknown> | null)?.risk_rating;
      if (isSoukscoreRiskRating(raw)) result[inv.id] = raw;
    });
    return result;
  }, [invoices]);

  const [riskRatingByInvoiceId, setRiskRatingByInvoiceId] = React.useState<
    Record<string, SoukscoreRiskRating | null>
  >({});

  /** Draft strings while typing financing ratio (%); committed on blur with min/max clamp. */
  const [financingRatioDraftByInvoiceId, setFinancingRatioDraftByInvoiceId] = React.useState<
    Record<string, string>
  >({});

  /** When true, financing ratio slider is shown under the input for that invoice. */
  const [financingRatioSliderOpenByInvoiceId, setFinancingRatioSliderOpenByInvoiceId] = React.useState<
    Record<string, boolean>
  >({});

  const financingRatioPanelRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    const openIds = Object.entries(financingRatioSliderOpenByInvoiceId)
      .filter(([, open]) => open)
      .map(([id]) => id);
    if (openIds.length === 0) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      for (const id of openIds) {
        const panel = financingRatioPanelRefs.current[id];
        if (panel && !panel.contains(target)) {
          setFinancingRatioSliderOpenByInvoiceId((prev) => ({ ...prev, [id]: false }));
        }
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [financingRatioSliderOpenByInvoiceId]);

  React.useEffect(() => {
    if (Object.keys(initialRiskFromInvoices).length > 0) {
      setRiskRatingByInvoiceId((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [invoiceId, rating] of Object.entries(initialRiskFromInvoices)) {
          if (next[invoiceId] !== rating) {
            next[invoiceId] = rating;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [initialRiskFromInvoices]);

  const toggleExpanded = React.useCallback((invoiceId: string) => {
    setExpandedById((prev) => ({ ...prev, [invoiceId]: !prev[invoiceId] }));
  }, []);

  const setOffered = React.useCallback(
    (invoiceId: string, updates: Partial<OfferedState>) => {
      setOfferedByInvoice((prev) => {
        const current = prev[invoiceId] ?? { ratio: invoiceRatioLimits.min, profitRate: 12 };
        return { ...prev, [invoiceId]: { ...current, ...updates } };
      });
    },
    [invoiceRatioLimits.min]
  );

  const getOffered = React.useCallback(
    (invoiceId: string, issuerRatio: number | null): OfferedState => {
      const stored = offeredByInvoice[invoiceId];
      if (stored) return stored;
      const ratio =
        issuerRatio != null
          ? Math.max(invoiceRatioLimits.min, Math.min(invoiceRatioLimits.max, issuerRatio))
          : invoiceRatioLimits.min;
      return { ratio, profitRate: 12 };
    },
    [offeredByInvoice, invoiceRatioLimits]
  );

  const handleConfirmInvoiceOffer = React.useCallback(async () => {
    if (!onSendInvoiceOffer || !invoiceOfferConfirm) return;
    if (!invoiceOfferConfirm.risk_rating) {
      alert("Please select a risk rating before sending the offer.");
      return;
    }
    await onSendInvoiceOffer({
      invoiceId: invoiceOfferConfirm.invoiceId,
      offeredAmount: invoiceOfferConfirm.offeredAmount,
      offeredRatioPercent: invoiceOfferConfirm.offeredRatioPercent,
      offeredProfitRatePercent: invoiceOfferConfirm.offeredProfitRatePercent,
      risk_rating: invoiceOfferConfirm.risk_rating,
    });
    setInvoiceOfferConfirm(null);
  }, [onSendInvoiceOffer, invoiceOfferConfirm]);

  return (
    <div className={applicationTableWrapperClass}>
      <Table className="text-[15px]">
        <TableHeader className={applicationTableHeaderBgClass}>
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="w-10 px-2 py-2 text-center align-middle" />
            <TableHead className={invoiceSummaryHeadCenterClass}>Invoice Number</TableHead>
            <TableHead className={invoiceSummaryHeadNumericClass}>Invoice Value</TableHead>
            <TableHead className={invoiceSummaryHeadNumericClass}>Financing Ratio</TableHead>
            <TableHead className={invoiceSummaryHeadNumericClass}>Financing Amount</TableHead>
            <TableHead className={invoiceSummaryHeadCenterClass}>Status</TableHead>
            <TableHead className={`${invoiceSummaryHeadCenterClass} w-[120px]`}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv, idx) => {
            const details = inv.details as InvoiceDetails | undefined;
            const invoiceDocument = (
              (inv as { document?: InvoiceDetails["document"] } | null | undefined)?.document ??
              details?.document
            );
            const invoiceNo = details?.number ?? idx + 1;
            const scopeKey = buildInvoiceScopeKey(idx, invoiceNo);
            const reviewItemStatus = getItemStatus(inv, reviewItems, scopeKey);
            const isInvoiceWithdrawn = (inv.status?.toString().toUpperCase() ?? "") === "WITHDRAWN";
            const status = isInvoiceWithdrawn ? "WITHDRAWN" : reviewItemStatus;
            /** Admin rejected this invoice in review; offer stays locked until reset to pending. */
            const isAdminRejected = reviewItemStatus === "REJECTED";
            const isRowReadOnly = readOnlyInvoiceIds?.has(inv.id) ?? false;
            const isTabLocked = !!isActionLocked || !isReviewable;
            const isInvoiceFinalizedByIssuer = reviewItemStatus === "APPROVED";
            const signedOfferAvailable = isSignedOfferLetterAvailable(inv.offer_signing);
            const signedOfferS3Key =
              signedOfferAvailable &&
              inv.offer_signing &&
              typeof (inv.offer_signing as { signed_offer_letter_s3_key?: unknown })
                .signed_offer_letter_s3_key === "string"
                ? (inv.offer_signing as { signed_offer_letter_s3_key: string })
                    .signed_offer_letter_s3_key
                : null;
            const isRowGreyedOut =
              isRowReadOnly ||
              isTabLocked ||
              isInvoiceFinalizedByIssuer ||
              isInvoiceWithdrawn;
            const showFullActionMenu = isReviewable && !isRowGreyedOut;
            const showSignedOfferOnlyMenu =
              !!onViewSignedInvoiceOffer &&
              !!signedOfferS3Key &&
              !showFullActionMenu;
            const isExpanded = Boolean(expandedById[inv.id]);
            const invoiceValue = toNumber(details?.value);
            const financingRatio = toNumber(details?.financing_ratio_percent);
            const issuerFinancingAmount =
              invoiceValue !== null && financingRatio !== null
                ? (invoiceValue * financingRatio) / 100
                : null;
            const maturityDate = details?.maturity_date ?? details?.due_date;
            const documentName = invoiceDocument?.file_name ?? "No document uploaded";

            return (
              <React.Fragment key={inv.id}>
                <TableRow
                  className={
                    isRowGreyedOut
                      ? `${applicationTableRowGreyedClass} cursor-pointer`
                      : `${applicationTableRowClass} cursor-pointer`
                  }
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest("[data-prevent-invoice-row-toggle]")) return;
                    toggleExpanded(inv.id);
                  }}
                >
                  <TableCell className={invoiceSummaryCellCenterClass}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(inv.id);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted"
                      aria-label={
                        isExpanded ? "Collapse invoice details" : "Expand invoice details"
                      }
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className={invoiceSummaryCellCenterClass}>
                    {invoiceNo}
                  </TableCell>
                  <TableCell className={invoiceSummaryCellNumericClass}>
                    {invoiceValue !== null ? formatCurrency(invoiceValue) : REVIEW_EMPTY_LABEL}
                  </TableCell>
                  <TableCell className={invoiceSummaryCellNumericClass}>
                    {financingRatio !== null ? `${financingRatio}%` : REVIEW_EMPTY_LABEL}
                  </TableCell>
                  <TableCell className={invoiceSummaryCellNumericClass}>
                    {issuerFinancingAmount !== null
                      ? formatCurrency(issuerFinancingAmount)
                      : REVIEW_EMPTY_LABEL}
                  </TableCell>
                  <TableCell className={invoiceSummaryCellCenterClass}>
                    <ReviewStepStatusBadge status={status} size="sm" />
                  </TableCell>
                  <TableCell
                    data-prevent-invoice-row-toggle
                    className={`${invoiceSummaryCellCenterClass} ${isRowGreyedOut ? "text-foreground" : ""}`}
                  >
                    {showFullActionMenu ? (
                      <ItemActionDropdown
                        itemId={scopeKey}
                        status={status}
                        isPending={isItemActionPending}
                        isActionLocked={isActionLocked}
                        actionLockTooltip={actionLockTooltip}
                        onApprove={onApproveItem}
                        onReject={onRejectItem}
                        onRequestAmendment={onRequestAmendmentItem}
                        onResetToPending={onResetItemToPending}
                        showApprove={false}
                        onViewSignedOffer={
                          signedOfferS3Key && onViewSignedInvoiceOffer
                            ? () => void onViewSignedInvoiceOffer(signedOfferS3Key)
                            : undefined
                        }
                      />
                    ) : showSignedOfferOnlyMenu ? (
                      <ItemActionDropdown
                        itemId={scopeKey}
                        status={status}
                        isPending={isItemActionPending}
                        viewSignedOfferOnly
                        onViewSignedOffer={() => {
                          if (onViewSignedInvoiceOffer && signedOfferS3Key) {
                            void onViewSignedInvoiceOffer(signedOfferS3Key);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className={applicationTableExpandableRowClass}>
                    <TableCell colSpan={7} className="p-0 align-top">
                      <div className={applicationTableExpandableContentClass}>
                        <div className={applicationTableExpandableGridClass}>
                            {(() => {
                              const isOfferSent = status === "OFFER_SENT";
                              const offerDetails = inv.offer_details as
                                | { offered_amount?: number; offered_ratio_percent?: number; offered_profit_rate_percent?: number }
                                | null
                                | undefined;
                              const offered = getOffered(inv.id, financingRatio);
                              const offeredAmount = isOfferSent
                                ? resolveOfferedAmount(offerDetails) || null
                                : invoiceValue !== null
                                  ? (invoiceValue * offered.ratio) / 100
                                  : null;
                              const offeredRatio = isOfferSent
                                ? (typeof offerDetails?.offered_ratio_percent === "number" &&
                                  Number.isFinite(offerDetails.offered_ratio_percent)
                                    ? offerDetails.offered_ratio_percent
                                    : offeredAmount !== null && invoiceValue !== null && invoiceValue > 0
                                      ? Math.round((offeredAmount / invoiceValue) * 100)
                                      : offered.ratio)
                                : offered.ratio;
                              const offeredProfitRate = isOfferSent
                                ? resolveOfferedProfitRate(offerDetails) ?? offered.profitRate
                                : offered.profitRate;
                              const expiryDays = offerExpiryDays ?? 7;
                              const estimates =
                                offeredAmount !== null && offeredAmount > 0 && expiryDays > 0
                                  ? computeOfferEstimates(
                                      expiryDays,
                                      maturityDate,
                                      offeredAmount
                                    )
                                  : null;
                              const reviewDay = new Date();
                              reviewDay.setHours(0, 0, 0, 0);
                              const maturityParsedForOffer = parseInvoiceMaturityDate(
                                typeof maturityDate === "string" ? maturityDate : undefined
                              );
                              const sendOfferBlockedByMaturity =
                                !isOfferSent &&
                                typeof minMonthsReviewToMaturityForOffer === "number" &&
                                minMonthsReviewToMaturityForOffer > 0 &&
                                (maturityParsedForOffer === null ||
                                  !maturityMeetsMinimumMonthsFrom(
                                    maturityParsedForOffer,
                                    reviewDay,
                                    minMonthsReviewToMaturityForOffer
                                  ));
                              return (
                                <>
                            <div
                              className={
                                isRowGreyedOut
                                  ? `${applicationTableExpandableFieldGapClass} text-muted-foreground pointer-events-none select-none`
                                  : applicationTableExpandableFieldGapClass
                              }
                            >
                              <p className={applicationTableExpandableSectionTitleClass}>
                                Invoice Details
                              </p>
                              <div className="space-y-3">
                                  <div className={invoiceExpandReadonlyFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Maturity Date
                                    </p>
                                    <p className={applicationTableExpandableValueClass}>
                                      {formatDateValue(maturityDate)}
                                    </p>
                                  </div>
                                  {estimates && (
                                    <div className={invoiceExpandReadonlyFieldBlockClass}>
                                      <p className={applicationTableExpandableLabelClass}>
                                        Offer Expiry
                                      </p>
                                      <p className={applicationTableExpandableValueClass}>
                                        {format(estimates.offerExpiryDate, "dd MMM yyyy")}
                                      </p>
                                    </div>
                                  )}
                                  <div className={invoiceExpandReadonlyFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Estimated Disbursement Date
                                    </p>
                                    <p className={applicationTableExpandableValueClass}>
                                      {estimates
                                        ? format(estimates.estDisbursementDate, "dd MMM yyyy")
                                        : REVIEW_EMPTY_LABEL}
                                    </p>
                                  </div>
                                  <div className={invoiceExpandReadonlyFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Estimated Period (Days)
                                    </p>
                                    <p className={applicationTableExpandableValueClass}>
                                      {estimates != null && estimates.estPeriodDays != null
                                        ? estimates.estPeriodDays
                                        : REVIEW_EMPTY_LABEL}
                                    </p>
                                  </div>
                                  <div
                                    className={`${invoiceExpandReadonlyFieldBlockClass} mt-3 border-t border-border/60 pt-3`}
                                  >
                                    <p className={applicationTableExpandableLabelClass}>Document</p>
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                      <p
                                        className={`${applicationTableExpandableValueClass} line-clamp-3 min-w-0 w-full max-w-full [overflow-wrap:anywhere]`}
                                        title={documentName}
                                      >
                                        {documentName}
                                      </p>
                                      {invoiceDocument?.s3_key ? (
                                        <span className="pointer-events-auto shrink-0 sm:pt-0.5">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-xl gap-1 px-2 text-[15px]"
                                            onClick={() => onViewDocument(invoiceDocument.s3_key!)}
                                            disabled={isViewDocumentPending}
                                          >
                                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                            View
                                          </Button>
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                              </div>
                            </div>

                            <div
                              className={
                                isRowGreyedOut
                                  ? `${applicationTableExpandableFieldGapClass} text-muted-foreground pointer-events-none select-none`
                                  : applicationTableExpandableFieldGapClass
                              }
                            >
                              <p className={applicationTableExpandableSectionTitleClass}>
                                Issuer Request
                              </p>
                              <div className="space-y-3">
                                  <div className={invoiceExpandReadonlyFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Financing Amount
                                    </p>
                                    <p className={applicationTableExpandableValueClass}>
                                      {issuerFinancingAmount !== null
                                        ? formatCurrency(issuerFinancingAmount)
                                        : REVIEW_EMPTY_LABEL}
                                    </p>
                                  </div>
                                  <div className={invoiceExpandReadonlyFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Financing Ratio
                                    </p>
                                    <p className={applicationTableExpandableValueClass}>
                                      {financingRatio !== null
                                        ? `${financingRatio}%`
                                        : REVIEW_EMPTY_LABEL}
                                    </p>
                                  </div>
                              </div>
                            </div>

                            <div
                              className={
                                isRowGreyedOut
                                  ? `${applicationTableExpandableFieldGapClass} text-muted-foreground pointer-events-none select-none md:min-w-[15rem]`
                                  : `${applicationTableExpandableFieldGapClass} md:min-w-[15rem]`
                              }
                            >
                              <p className={applicationTableExpandableSectionTitleClass}>
                                Offered by CashSouk
                              </p>
                              <div className="flex flex-col gap-3">
                                <div className="space-y-3">
                                  <div className={applicationTableExpandableFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>Risk Rating</p>
                                    {isOfferSent ? (
                                      <p className={applicationTableExpandableValueClass}>
                                        {(() => {
                                          const raw = (inv.offer_details as Record<string, unknown> | null)
                                            ?.risk_rating;
                                          if (typeof raw === "string" && raw.trim()) return raw.trim();
                                          const fromState = riskRatingByInvoiceId[inv.id];
                                          return fromState ?? REVIEW_EMPTY_LABEL;
                                        })()}
                                      </p>
                                    ) : (
                                      <Select
                                        value={riskRatingByInvoiceId[inv.id] ?? undefined}
                                        onValueChange={(value) => {
                                          if (isSoukscoreRiskRating(value)) {
                                            setRiskRatingByInvoiceId((prev) => ({
                                              ...prev,
                                              [inv.id]: value,
                                            }));
                                          }
                                        }}
                                        disabled={isRowGreyedOut || isAdminRejected}
                                      >
                                        <SelectTrigger aria-label="Risk rating" className={OFFER_CONTROL_WIDTH_CLASS}>
                                          <SelectValue placeholder="Grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SOUKSCORE_RISK_RATING_GRADES.map((grade) => (
                                            <SelectItem key={grade} value={grade}>
                                              {grade}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className={applicationTableExpandableFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Profit Rate
                                    </p>
                                    {isOfferSent ? (
                                      <p className={applicationTableExpandableValueClass}>
                                        {offeredProfitRate != null
                                          ? `${offeredProfitRate}%`
                                          : REVIEW_EMPTY_LABEL}
                                      </p>
                                    ) : (
                                      <Select
                                        value={String(offered.profitRate)}
                                        onValueChange={(v) =>
                                          setOffered(inv.id, { profitRate: parseInt(v, 10) })
                                        }
                                        disabled={isRowGreyedOut || isAdminRejected}
                                      >
                                        <SelectTrigger className={OFFER_CONTROL_WIDTH_CLASS}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                          {PROFIT_RATE_OPTIONS.map((p) => (
                                            <SelectItem key={p} value={String(p)}>
                                              {p}%
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className={applicationTableExpandableFieldBlockClass}>
                                    <div className="flex items-baseline justify-between gap-2">
                                      <p className={applicationTableExpandableLabelClass}>
                                        Financing Ratio
                                      </p>
                                      {!isOfferSent ? (
                                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                                          {invoiceRatioLimits.min}–{invoiceRatioLimits.max}%
                                        </span>
                                      ) : null}
                                    </div>
                                    {isOfferSent ? (
                                      <span
                                        className={`${applicationTableExpandableValueClass} font-medium ${issuerFinancingAmount != null && offeredAmount != null && offeredAmount > issuerFinancingAmount ? "text-destructive" : ""}`}
                                      >
                                        {offeredRatio}%
                                      </span>
                                    ) : (
                                      <>
                                        <div
                                          ref={(el) => {
                                            financingRatioPanelRefs.current[inv.id] = el;
                                          }}
                                          className="mt-1 w-full max-w-md"
                                          onClick={() => {
                                            if (!isRowGreyedOut && !isAdminRejected) {
                                              setFinancingRatioSliderOpenByInvoiceId((prev) => ({
                                                ...prev,
                                                [inv.id]: true,
                                              }));
                                            }
                                          }}
                                        >
                                          <div className="flex w-full max-w-[7rem] items-center gap-1.5">
                                            <Input
                                              type="text"
                                              inputMode="numeric"
                                              autoComplete="off"
                                              aria-label={`Financing ratio percent, allowed ${invoiceRatioLimits.min}% to ${invoiceRatioLimits.max}%`}
                                              className={`${OFFER_CONTROL_WIDTH_CLASS} px-3 text-right tabular-nums shadow-sm`}
                                              disabled={isRowGreyedOut || isAdminRejected}
                                              value={
                                                financingRatioDraftByInvoiceId[inv.id] !== undefined
                                                  ? financingRatioDraftByInvoiceId[inv.id]
                                                  : String(offered.ratio)
                                              }
                                              onChange={(e) => {
                                                const next = e.target.value;
                                                if (next === "" || /^\d{0,3}$/.test(next)) {
                                                  setFinancingRatioDraftByInvoiceId((prev) => ({
                                                    ...prev,
                                                    [inv.id]: next,
                                                  }));
                                                }
                                              }}
                                              onFocus={() => {
                                                if (!isRowGreyedOut && !isAdminRejected) {
                                                  setFinancingRatioSliderOpenByInvoiceId((prev) => ({
                                                    ...prev,
                                                    [inv.id]: true,
                                                  }));
                                                }
                                              }}
                                              onBlur={() => {
                                                const draft = financingRatioDraftByInvoiceId[inv.id];
                                                setFinancingRatioDraftByInvoiceId((prev) => {
                                                  const rest = { ...prev };
                                                  delete rest[inv.id];
                                                  return rest;
                                                });
                                                const fallback = offered.ratio;
                                                const parsed =
                                                  draft === undefined || draft === ""
                                                    ? fallback
                                                    : parseInt(draft, 10);
                                                const clamped = Number.isFinite(parsed)
                                                  ? Math.min(
                                                      invoiceRatioLimits.max,
                                                      Math.max(invoiceRatioLimits.min, Math.round(parsed))
                                                    )
                                                  : fallback;
                                                setOffered(inv.id, { ratio: clamped });
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  (e.target as HTMLInputElement).blur();
                                                }
                                              }}
                                            />
                                            <span className="shrink-0 text-[15px] text-muted-foreground">%</span>
                                          </div>
                                          {financingRatioSliderOpenByInvoiceId[inv.id] ? (
                                            <div
                                              className="mt-2 w-full"
                                              onPointerDown={(e) => e.preventDefault()}
                                            >
                                              <Slider
                                                min={invoiceRatioLimits.min}
                                                max={invoiceRatioLimits.max}
                                                step={1}
                                                value={[offered.ratio]}
                                                onValueChange={(v) => {
                                                  setOffered(inv.id, { ratio: v[0] });
                                                  setFinancingRatioDraftByInvoiceId((prev) => {
                                                    const rest = { ...prev };
                                                    delete rest[inv.id];
                                                    return rest;
                                                  });
                                                }}
                                                disabled={isRowGreyedOut || isAdminRejected}
                                                className="w-full"
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-3 border-t border-border/60 pt-3">
                                  <div className={applicationTableExpandableFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Financing Amount
                                    </p>
                                    <p
                                      className={`${applicationTableExpandableValueClass} ${
                                        issuerFinancingAmount != null && offeredAmount != null && offeredAmount > issuerFinancingAmount
                                          ? "text-destructive font-semibold"
                                          : ""
                                      }`}
                                    >
                                      {offeredAmount !== null
                                        ? formatCurrency(offeredAmount)
                                        : REVIEW_EMPTY_LABEL}
                                    </p>
                                    {!isOfferSent &&
                                      issuerFinancingAmount != null &&
                                      offeredAmount != null &&
                                      offeredAmount > issuerFinancingAmount && (
                                        <p
                                          role="alert"
                                          className="mt-2 rounded-md border border-destructive/35 bg-destructive/5 px-2.5 py-2 text-xs leading-snug text-destructive"
                                        >
                                          Exceeds what the issuer requested. Lower the ratio or other offer terms.
                                        </p>
                                      )}
                                  </div>
                                  <div className={applicationTableExpandableFieldBlockClass}>
                                    <p className={applicationTableExpandableLabelClass}>
                                      Estimated Profit
                                    </p>
                                    <p className={applicationTableExpandableValueClass}>
                                      {estimates?.estProfit != null
                                        ? formatCurrency(estimates.estProfit)
                                        : REVIEW_EMPTY_LABEL}
                                    </p>
                                  </div>
                                </div>
                                {!isOfferSent && onSendInvoiceOffer &&
                                  (isAdminRejected ? (
                                    <div className="mt-3 w-full space-y-2">
                                      <Button
                                        type="button"
                                        className="w-full rounded-xl bg-primary text-primary-foreground h-10 opacity-60"
                                        disabled
                                        aria-describedby={`send-offer-blocked-${inv.id}-rejected`}
                                      >
                                        Send Offer
                                      </Button>
                                      <p
                                        id={`send-offer-blocked-${inv.id}-rejected`}
                                        className="text-sm text-destructive leading-snug"
                                      >
                                        This invoice was rejected. Use Action → Set to pending on this row, then you
                                        can send an offer.
                                      </p>
                                    </div>
                                  ) : sendOfferBlockedByMaturity ? (
                                    <div className="mt-3 w-full space-y-2">
                                      <Button
                                        type="button"
                                        className="w-full rounded-xl bg-primary text-primary-foreground h-10 opacity-60"
                                        disabled
                                        aria-describedby={`send-offer-blocked-${inv.id}-maturity`}
                                      >
                                        Send Offer
                                      </Button>
                                      <p
                                        id={`send-offer-blocked-${inv.id}-maturity`}
                                        className="text-sm text-destructive leading-snug"
                                      >
                                        Maturity date must be at least{" "}
                                        {minMonthsReviewToMaturityForOffer} month(s) after today to send an offer.
                                      </p>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      className="mt-3 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 h-10"
                                      disabled={
                                        isRowGreyedOut ||
                                        !!isSendInvoiceOfferPending ||
                                        offeredAmount === null ||
                                        !riskRatingByInvoiceId[inv.id]
                                      }
                                      onClick={() => {
                                        const rr = riskRatingByInvoiceId[inv.id];
                                        if (!rr) {
                                          alert("Please select a risk rating before sending the offer.");
                                          return;
                                        }
                                        setInvoiceOfferConfirm({
                                          invoiceId: inv.id,
                                          invoiceNo,
                                          offeredAmount: offeredAmount ?? 0,
                                          offeredRatioPercent: offered.ratio,
                                          offeredProfitRatePercent: offered.profitRate,
                                          invoiceValue,
                                          risk_rating: rr,
                                        });
                                      }}
                                    >
                                      {isSendInvoiceOfferPending ? "Sending..." : "Send Offer"}
                                    </Button>
                                  ))}
                                {isOfferSent && onResetItemToPending && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-3 w-full rounded-xl h-10"
                                    disabled={isRowGreyedOut || isItemActionPending}
                                    onClick={() => onResetItemToPending(scopeKey)}
                                  >
                                    {isItemActionPending ? "Retracting..." : "Retract Offer"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                          );
                        })()}
                      </div>
                    </div>
                  </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={!!invoiceOfferConfirm}
        onOpenChange={(open) => !open && setInvoiceOfferConfirm(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Confirm Invoice Offer
              {invoiceOfferConfirm && ` — Invoice ${invoiceOfferConfirm.invoiceNo}`}
            </DialogTitle>
            <DialogDescription>
              Review the offer details below before sending to the issuer.
            </DialogDescription>
          </DialogHeader>
          {invoiceOfferConfirm && (
            <>
              <div className="grid gap-3 py-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Invoice Number</span>
                  <span className="text-[15px] font-medium">{invoiceOfferConfirm.invoiceNo}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Invoice Value</span>
                  <span className="text-[15px] font-medium tabular-nums">
                    {invoiceOfferConfirm.invoiceValue !== null
                      ? formatCurrency(invoiceOfferConfirm.invoiceValue)
                      : REVIEW_EMPTY_LABEL}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Financing Amount</span>
                  <span className="text-[15px] font-medium tabular-nums">
                    {formatCurrency(invoiceOfferConfirm.offeredAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Financing Ratio</span>
                  <span className="text-[15px] font-medium tabular-nums">
                    {invoiceOfferConfirm.offeredRatioPercent}%
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Profit Rate</span>
                  <span className="text-[15px] font-medium tabular-nums">
                    {invoiceOfferConfirm.offeredProfitRatePercent}%
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Risk Rating</span>
                  <span className="text-[15px] font-medium tabular-nums">
                    {invoiceOfferConfirm.risk_rating}
                  </span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setInvoiceOfferConfirm(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmInvoiceOffer}
                  disabled={!!isSendInvoiceOfferPending}
                  className="rounded-xl"
                >
                  {isSendInvoiceOfferPending ? "Sending..." : "Confirm & Send Offer"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
