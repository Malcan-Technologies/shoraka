"use client";

/**
 * Invoice table for application cards: horizontal scroll lives only inside the wrapper
 * (card/page do not grow horizontally). Status + Action columns are sticky on the right.
 *
 * Fluid width: table is `width: 100%` so it fills the card when space allows; first eight columns share
 * extra space (table-layout: fixed + col minWidths). Status/Action stay fixed (px) for sticky `right`.
 * `minWidth` prevents overlap when the viewport is narrow (horizontal scroll).
 *
 * Does not use the shared Table shell (which wraps <table> in overflow-auto + w-full).
 */

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { EllipsisVerticalIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import {
  formatCurrency,
  getStatusPresentationByBadgeKey,
  badgeKeyToStatusToken,
} from "@cashsouk/config";
import { StatusBadge } from "@cashsouk/ui";
import type { WithdrawReason } from "@cashsouk/types";
import { shouldShowIssuerReviewOfferCta, getOfferPhaseDeadlineDisplay, getIssuerOfferActionCtaFromOfferDetails } from "@/lib/offer-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import {
  issuerInvoiceCanViewReasonRemarks,
  resolveNormalizedInvoiceBadgeKey,
  type NormalizedApplication,
  type NormalizedInvoice,
} from "../status";
import { buildInvoiceFeeDisplay, money } from "@/lib/facility-fee-display";

const FEES_HEADER_TOOLTIP =
  "Drawdown fee, facility fee, and any extra fees, where applicable, deducted from issuer disbursement.";

const PROFIT_RATE_HEADER_TOOLTIP =
  "Profit per annum (%). Deducted during settlement when calculating the residual refund to the issuer.";

/** Min widths (px) for scrollable columns; extra space is shared across them. */
const COL_MIN = {
  invoiceNumber: 132,
  maturity: 124,
  invoiceValue: 132,
  appliedFinancing: 132,
  documents: 200,
  financingOffered: 136,
  fees: 156,
  profitRate: 96,
} as const;

/** Fixed widths (px). Status `right` sticky offset must equal `action` width. */
const COL_STICKY = {
  status: 168,
  actionExpanded: 220,
  actionCompact: 72,
} as const;

const SCROLLABLE_COL_MIN_TOTAL_PX =
  COL_MIN.invoiceNumber +
  COL_MIN.maturity +
  COL_MIN.invoiceValue +
  COL_MIN.appliedFinancing +
  COL_MIN.documents +
  COL_MIN.financingOffered +
  COL_MIN.fees +
  COL_MIN.profitRate;

/** When the container is narrower than this, the scroll region shows a horizontal scrollbar. */
function getInvoiceTableMinWidthPx(actionColWidthPx: number): number {
  return SCROLLABLE_COL_MIN_TOTAL_PX + COL_STICKY.status + actionColWidthPx;
}

/** Equal share of width for the eight scrollable columns (remainder after sticky columns). */
function getFlexColWidth(stickyTotalPx: number): string {
  return `calc((100% - ${stickyTotalPx}px) / 8)`;
}

/** Solid fills only (no opacity); sticky columns use same fill as body cells. */
const INV_TABLE_CHROME_BG = "bg-card";
const INV_TABLE_HEADER_BG = "bg-muted";
const INV_TABLE_ROW_BG = "bg-card";
const INV_TABLE_ROW_HOVER = "group-hover:bg-muted";

const CELL = "px-4 py-3 text-ui";

function invoiceStatusStickyStyle(actionColWidthPx: number): React.CSSProperties {
  return {
    right: actionColWidthPx,
    width: COL_STICKY.status,
    minWidth: COL_STICKY.status,
    maxWidth: COL_STICKY.status,
  };
}

function invoiceActionStickyStyle(actionColWidthPx: number): React.CSSProperties {
  return {
    width: actionColWidthPx,
    minWidth: actionColWidthPx,
    maxWidth: actionColWidthPx,
  };
}

function InvoiceStatusBadge({
  badgeKey,
  withdrawReason,
}: {
  badgeKey: string;
  withdrawReason?: WithdrawReason;
}) {
  const { label } = getStatusPresentationByBadgeKey(badgeKey, withdrawReason, {
    issuerWithdrawPresentation: true,
  });
  return (
    <StatusBadge
      label={label}
      status={badgeKeyToStatusToken(badgeKey)}
      className="whitespace-nowrap"
    />
  );
}

function IssuerInvoiceCurrencyCell({ amount }: { amount: number | null | undefined }) {
  if (amount == null || !Number.isFinite(amount)) {
    return <span className="tabular-nums">—</span>;
  }
  return (
    <div className="flex w-full min-w-0 items-baseline justify-between gap-2 text-ui">
      <span className="shrink-0 text-left">RM</span>
      <span className="min-w-0 flex-1 text-right tabular-nums">
        {formatCurrency(amount, { includeSymbol: false })}
      </span>
    </div>
  );
}

function IssuerInvoiceCurrencyCellFromFormatted({ formatted }: { formatted: string }) {
  if (formatted === "—" || !formatted.trim()) {
    return <span className="tabular-nums">—</span>;
  }
  const match = /^RM\s+(.+)$/.exec(formatted.trim());
  if (!match) {
    return <span>{formatted}</span>;
  }
  return (
    <div className="flex w-full min-w-0 items-baseline justify-between gap-2 text-ui">
      <span className="shrink-0 text-left">RM</span>
      <span className="min-w-0 flex-1 text-right tabular-nums">{match[1]}</span>
    </div>
  );
}

function InvoiceFeesCell({
  application,
  invoice,
}: {
  application: NormalizedApplication;
  invoice: NormalizedInvoice;
}) {
  const display = buildInvoiceFeeDisplay({
    status: invoice.status,
    offerDetails: invoice.offer_details,
    financingAmount: invoice.appliedFinancing,
    isContractFinancing: application.type === "Facility financing" && !!invoice.contractId,
    contractFacilityFeeRatePercent: application.facilityFeeRatePercent,
    contractFacilityFeeCapAmount: application.facilityFeeCapAmount,
    contractFacilityFeePaidAmount: application.facilityFeePaidAmount,
    contractDetails: {
      facility_fee_rate_percent: application.facilityFeeRatePercent,
      facility_fee_total_amount: application.facilityFeeCapAmount,
      facility_fee_paid_amount: application.facilityFeePaidAmount,
      facility_fee_waived: application.facilityFeeWaived,
    },
    invoiceSnapshot: invoice.invoiceSnapshot ?? invoice.details,
  });

  if (display.phase === "none") return <span className="tabular-nums">—</span>;
  if (display.phase === "pending") return <span className="tabular-nums">—</span>;

  const platformLine =
    display.platformFeeAmount != null ? `Drawdown ${money(display.platformFeeAmount)}` : null;

  if (
    platformLine == null &&
    display.facilityFeeAmount == null &&
    display.additionalFeeCharges.length === 0
  ) {
    return <span className="tabular-nums">—</span>;
  }

  const facilityLine = (() => {
    if (display.facilityFeeAmount == null) return null;
    if (display.facilityFeeCollectionWaived) {
      return "Facility waived";
    }
    const capReached = display.facilityFeeFullyCollected && display.facilityFeeAmount === 0;
    if (capReached) {
      return "cap_reached";
    }
    return display.phase === "charged"
      ? `Facility ${money(display.facilityFeeAmount)} charged`
      : `Facility ${money(display.facilityFeeAmount)} est.`;
  })();

  return (
    <div className="min-w-0 w-full">
      <div className="text-ui leading-5 tabular-nums whitespace-normal break-words">
        {platformLine ?? "—"}
      </div>
      {facilityLine ? (
        <div className="text-ui leading-5 whitespace-normal break-words tabular-nums">
          {facilityLine === "cap_reached" ? (
            <>
              Facility {money(display.facilityFeeAmount)}
              <span className="ml-1 text-xs leading-4 text-muted-foreground">(cap reached)</span>
            </>
          ) : (
            facilityLine
          )}
        </div>
      ) : null}
      {display.additionalFeeCharges.map((line, index) => (
        <div
          key={`${line.name}-${index}`}
          className="text-ui leading-5 whitespace-normal break-words tabular-nums"
        >
          {line.name} {money(line.chargedAmount)}
        </div>
      ))}
    </div>
  );
}

function InvoiceDocumentCell({
  documentName,
  documentS3Key,
  onDownload,
}: {
  documentName: string;
  documentS3Key: string | null;
  onDownload: (s3Key: string) => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  const hasDocument = documentName && documentName !== "—";
  if (!hasDocument) {
    return <span className="text-ui text-muted-foreground">—</span>;
  }
  return (
    <FileDisplayBadge
      fileName={documentName}
      size="sm"
      truncate
      className="min-w-0 max-w-full bg-background"
      trailing={
        documentS3Key ? (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await onDownload(documentS3Key);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            aria-label={`Download ${documentName}`}
          >
            <ArrowDownTrayIcon className="h-3 w-3" />
          </button>
        ) : undefined
      }
    />
  );
}

function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—";
  return format(new Date(date), "d MMM yyyy");
}

export type ScrollableInvoiceTableProps = {
  application: NormalizedApplication;
  onDocumentDownload: (s3Key: string) => Promise<void>;
  onViewSignedInvoiceOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onWithdrawInvoice?: (invoiceId: string, applicationId: string, organizationId?: string) => void;
  isWithdrawInvoicePending?: boolean;
};

/**
 * Outer shell: constrains width (`min-w-0`) so flex parents don’t overflow the viewport;
 * inner div is the only horizontal scroll container.
 */
export function ScrollableInvoiceTableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <div className={cn("max-w-full overflow-hidden rounded-xl", INV_TABLE_CHROME_BG)}>
        <div className="isolate max-w-full min-w-0 w-full overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable] touch-pan-x">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ScrollableInvoiceTable({
  application,
  onDocumentDownload,
  onViewSignedInvoiceOffer,
  onWithdrawInvoice,
  isWithdrawInvoicePending,
}: ScrollableInvoiceTableProps) {
  const [reasonRemarksOpen, setReasonRemarksOpen] = React.useState(false);
  const [reasonRemarksBody, setReasonRemarksBody] = React.useState("");
  const hasExpandedActionColumn = React.useMemo(() => {
    return application.invoices.some((inv: NormalizedInvoice) => {
      const invStatus = String(inv.status ?? "").toUpperCase();
      const showReviewOffer =
        invStatus === "OFFER_SENT" &&
        shouldShowIssuerReviewOfferCta({
          status: inv.status,
          offer_details: inv.offer_details,
        });
      const isOfferExpired =
        invStatus === "OFFER_EXPIRED" ||
        (invStatus === "OFFER_SENT" &&
          getOfferPhaseDeadlineDisplay(inv.offer_details)?.isPast === true);
      const showMakeAmendments =
        application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
      return showReviewOffer || showMakeAmendments || isOfferExpired;
    });
  }, [application.invoices, application.cardStatus.showMakeAmendments]);
  const actionColWidthPx = hasExpandedActionColumn
    ? COL_STICKY.actionExpanded
    : COL_STICKY.actionCompact;
  const stickyTotalPx = COL_STICKY.status + actionColWidthPx;
  const flexColWidth = getFlexColWidth(stickyTotalPx);
  const invoiceTableMinWidthPx = getInvoiceTableMinWidthPx(actionColWidthPx);

  return (
    <>
    <ScrollableInvoiceTableWrapper>
      <table
        className="w-full min-w-0 table-fixed border-collapse text-ui"
        style={{
          width: "100%",
          minWidth: invoiceTableMinWidthPx,
        }}
      >
        <colgroup>
          <col style={{ width: flexColWidth, minWidth: COL_MIN.invoiceNumber }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.maturity }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.invoiceValue }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.appliedFinancing }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.documents }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.financingOffered }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.fees }} />
          <col style={{ width: flexColWidth, minWidth: COL_MIN.profitRate }} />
          <col style={{ width: COL_STICKY.status, minWidth: COL_STICKY.status }} />
          <col style={{ width: actionColWidthPx, minWidth: actionColWidthPx }} />
        </colgroup>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground"
              )}
            >
              Invoice Number
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground"
              )}
            >
              Maturity Date
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
              )}
            >
              Invoice Value
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
              )}
            >
              Applied Financing
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground"
              )}
            >
              Documents
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
              )}
            >
              Financing Offered
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                Fees
                <InfoTooltip
                  content={FEES_HEADER_TOOLTIP}
                  iconClassName="h-3.5 w-3.5 shrink-0"
                />
              </span>
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                Profit rate
                <InfoTooltip
                  content={PROFIT_RATE_HEADER_TOOLTIP}
                  iconClassName="h-3.5 w-3.5 shrink-0"
                />
              </span>
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "sticky z-30 text-sm font-semibold text-foreground whitespace-nowrap"
              )}
              style={invoiceStatusStickyStyle(actionColWidthPx)}
            >
              Status
            </TableHead>
            <TableHead
              className={cn(
                CELL,
                INV_TABLE_HEADER_BG,
                "sticky right-0 z-40 text-sm font-semibold text-foreground whitespace-nowrap"
              )}
              style={invoiceActionStickyStyle(actionColWidthPx)}
            >
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr]:border-b-0">
          {application.invoices.length === 0 ? (
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableCell
                colSpan={10}
                className={cn(CELL, INV_TABLE_ROW_BG, "text-center text-muted-foreground")}
              >
                No invoices available
              </TableCell>
            </TableRow>
          ) : (
            application.invoices.map((inv: NormalizedInvoice) => {
              const invStatus = String(inv.status ?? "").toUpperCase();
              const showReviewOffer =
                invStatus === "OFFER_SENT" &&
                shouldShowIssuerReviewOfferCta({
                  status: inv.status,
                  offer_details: inv.offer_details,
                });
              const invoiceOfferActionCta = getIssuerOfferActionCtaFromOfferDetails(inv.offer_details, {
                scope: "invoice",
              });
              const offerDeadline =
                invStatus === "OFFER_SENT" || invStatus === "OFFER_EXPIRED"
                  ? getOfferPhaseDeadlineDisplay(inv.offer_details)
                  : null;
              const isOfferExpired =
                invStatus === "OFFER_EXPIRED" || offerDeadline?.isPast === true;
              const canReview = inv.canReviewOffer;
              const showMakeAmendments =
                application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
              const hasInlineAction = showReviewOffer || showMakeAmendments || isOfferExpired;
              const canWithdrawInvoice = !["APPROVED", "REJECTED", "WITHDRAWN"].includes(invStatus);
              return (
                <TableRow
                  key={inv.id}
                  className={cn(
                    "group border-b-0 transition-colors hover:bg-muted",
                    INV_TABLE_ROW_BG
                  )}
                >
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-left whitespace-nowrap text-foreground"
                    )}
                  >
                    {inv.number}
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-left whitespace-nowrap text-foreground"
                    )}
                  >
                    {formatDate(inv.maturityDate)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-foreground"
                    )}
                  >
                    <IssuerInvoiceCurrencyCell amount={inv.value} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-foreground"
                    )}
                  >
                    <IssuerInvoiceCurrencyCell amount={inv.appliedFinancing} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "overflow-hidden align-middle text-left text-foreground"
                    )}
                  >
                    <InvoiceDocumentCell
                      documentName={inv.document}
                      documentS3Key={inv.documentS3Key}
                      onDownload={onDocumentDownload}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-foreground"
                    )}
                  >
                    <IssuerInvoiceCurrencyCellFromFormatted formatted={inv.financingOffered} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-left tabular-nums whitespace-nowrap text-foreground"
                    )}
                  >
                    <InvoiceFeesCell application={application} invoice={inv} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "align-middle text-left tabular-nums whitespace-nowrap text-foreground"
                    )}
                  >
                    {inv.profitRate}
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "sticky z-20",
                      "group-hover:z-[21]",
                      "align-middle text-left whitespace-nowrap"
                    )}
                    style={invoiceStatusStickyStyle(actionColWidthPx)}
                  >
                    <span className="inline-block">
                      <InvoiceStatusBadge
                        badgeKey={resolveNormalizedInvoiceBadgeKey(inv, application)}
                        withdrawReason={inv.withdrawReason}
                      />
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      INV_TABLE_ROW_BG,
                      INV_TABLE_ROW_HOVER,
                      "sticky right-0 z-20",
                      "group-hover:z-[21]",
                      "align-middle text-center"
                    )}
                    style={invoiceActionStickyStyle(actionColWidthPx)}
                  >
                    <div
                      className={cn(
                        "flex w-full gap-2",
                        hasInlineAction
                          ? "items-start justify-between"
                          : "items-center justify-end"
                      )}
                    >
                      {hasInlineAction && (
                        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                          {isOfferExpired && offerDeadline ? (
                            <div className="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
                              <p className="text-meta leading-4 text-destructive">
                                {offerDeadline.summary}
                              </p>
                              <p className="text-meta leading-4 text-muted-foreground">
                                A new offer may appear if resent.
                              </p>
                            </div>
                          ) : null}
                          {showReviewOffer && canReview ? (
                            <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
                              <Button
                                size="sm"
                                variant={
                                  invoiceOfferActionCta.buttonVariant === "makeAmendments"
                                    ? "outline"
                                    : "default"
                                }
                                className={
                                  invoiceOfferActionCta.buttonVariant === "makeAmendments"
                                    ? "w-full min-w-0 max-w-full border-status-action-text/30 bg-status-action-bg px-2 text-status-action-text hover:bg-status-action-bg"
                                    : "w-full min-w-0 max-w-full"
                                }
                                asChild
                              >
                                <Link
                                  href={`/applications/${application.id}?tab=offer&invoiceId=${inv.id}`}
                                >
                                  {invoiceOfferActionCta.label}
                                </Link>
                              </Button>
                              {offerDeadline && !offerDeadline.isPast ? (
                                <p className="text-meta leading-4 text-center text-muted-foreground">
                                  {offerDeadline.summary}
                                </p>
                              ) : null}
                            </div>
                          ) : showReviewOffer ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full min-w-0 max-w-full"
                              disabled
                            >
                              {invoiceOfferActionCta.label}
                            </Button>
                          ) : null}
                          {showMakeAmendments && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full min-w-0 max-w-full border-status-action-text/30 bg-status-action-bg text-status-action-text hover:bg-status-action-bg"
                              asChild
                            >
                              <Link href={`/applications/${application.id}/edit`}>
                                Make Amendments
                              </Link>
                            </Button>
                          )}
                        </div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                          >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          {(() => {
                            const showViewSignedInvoice =
                              inv.signedOfferLetterAvailable && !!inv.signedOfferLetterS3Key && onViewSignedInvoiceOffer;
                            const showViewReasonRemarks = issuerInvoiceCanViewReasonRemarks(inv);
                            const withdrawInvoiceDisabled =
                              !canWithdrawInvoice ||
                              !!isWithdrawInvoicePending ||
                              !!showViewSignedInvoice;
                            return (
                              <>
                                {showViewSignedInvoice && (
                                  <>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void onViewSignedInvoiceOffer!(inv.signedOfferLetterS3Key!);
                                      }}
                                    >
                                      View Signed Offer
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {showViewReasonRemarks && (
                                  <>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReasonRemarksBody(
                                          inv.reasonOrRemarks?.trim() ||
                                            "No reason were recorded for this invoice."
                                        );
                                        setReasonRemarksOpen(true);
                                      }}
                                    >
                                      View reason
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  disabled={withdrawInvoiceDisabled}
                                  onClick={() => {
                                    if (
                                      canWithdrawInvoice &&
                                      !isWithdrawInvoicePending &&
                                      !showViewSignedInvoice &&
                                      onWithdrawInvoice
                                    ) {
                                      onWithdrawInvoice(
                                        inv.id,
                                        application.id,
                                        application.issuerOrganizationId
                                      );
                                    }
                                  }}
                                  title={
                                    showViewSignedInvoice
                                      ? "Withdraw is not available while a signed offer letter is on file"
                                      : !canWithdrawInvoice
                                        ? "Cannot withdraw: invoice is already approved, rejected, or withdrawn"
                                        : isWithdrawInvoicePending
                                          ? "Withdrawal in progress"
                                          : undefined
                                  }
                                >
                                  {isWithdrawInvoicePending ? "Withdrawing..." : "Withdraw Invoice"}
                                </DropdownMenuItem>
                              </>
                            );
                          })()}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </table>
    </ScrollableInvoiceTableWrapper>
    <Dialog open={reasonRemarksOpen} onOpenChange={setReasonRemarksOpen}>
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reason</DialogTitle>
        </DialogHeader>
        <p className="whitespace-pre-wrap break-words text-ui leading-7 text-foreground">
          {reasonRemarksBody}
        </p>
      </DialogContent>
    </Dialog>
    </>
  );
}
