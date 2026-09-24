"use client";

import * as React from "react";
import Link from "next/link";
import { EllipsisVerticalIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { formatCalendarDate, type WithdrawReason } from "@cashsouk/types";
import {
  formatCurrency,
  badgeKeyToStatusToken,
  getStatusPresentationByBadgeKey,
} from "@cashsouk/config";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  shouldShowIssuerReviewOfferCta,
  getOfferPhaseDeadlineDisplay,
} from "@/lib/offer-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollableInvoiceTableProps } from "./scrollable-invoice-table";
import { issuerInvoiceCanViewReasonRemarks, resolveNormalizedInvoiceBadgeKey } from "../status";
import { buildInvoiceFeeDisplay, money } from "@/lib/facility-fee-display";

type Props = {
  application: ScrollableInvoiceTableProps["application"];
  invoice: ScrollableInvoiceTableProps["application"]["invoices"][number];
  onDocumentDownload: ScrollableInvoiceTableProps["onDocumentDownload"];
  onViewSignedInvoiceOffer?: ScrollableInvoiceTableProps["onViewSignedInvoiceOffer"];
  onWithdrawInvoice?: ScrollableInvoiceTableProps["onWithdrawInvoice"];
  isWithdrawInvoicePending?: boolean;
};

const FEES_HEADER_TOOLTIP =
  "Drawdown fee, facility fee, and any extra fees, where applicable, deducted from issuer disbursement.";

const PROFIT_RATE_HEADER_TOOLTIP =
  "Profit per annum (%). Deducted during settlement when calculating the residual refund to the issuer.";

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

function InvoiceFeesCell({
  application,
  invoice,
}: {
  application: Props["application"];
  invoice: Props["invoice"];
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

  const feeLines: Array<{ label: string; value: string }> = [];

  if (display.platformFeeAmount != null) {
    feeLines.push({ label: "Drawdown", value: money(display.platformFeeAmount) });
  }

  if (display.facilityFeeAmount != null) {
    if (display.facilityFeeCollectionWaived) {
      feeLines.push({ label: "Facility", value: "Waived" });
    } else {
      const capReached = display.facilityFeeFullyCollected && display.facilityFeeAmount === 0;
      feeLines.push({
        label: "Facility",
        value: capReached
          ? `${money(display.facilityFeeAmount)} (cap reached)`
          : display.phase === "charged"
            ? `${money(display.facilityFeeAmount)} charged`
            : `${money(display.facilityFeeAmount)} est.`,
      });
    }
  }

  for (const line of display.additionalFeeCharges) {
    feeLines.push({ label: line.name, value: money(line.chargedAmount) });
  }

  if (feeLines.length === 0) {
    return <span className="tabular-nums">—</span>;
  }

  return (
    <div className="space-y-1.5">
      {feeLines.map((l) => (
        <div
          key={l.label + l.value}
          className="flex items-start justify-between gap-3"
        >
          <span className="min-w-0 text-ui leading-6 text-foreground">{l.label}</span>
          <span className="shrink-0 text-ui leading-6 text-foreground tabular-nums text-right">
            {l.value}
          </span>
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-ui font-medium text-foreground">{documentName}</p>
        <p className="text-ui text-muted-foreground">Invoice</p>
      </div>
      {documentS3Key ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={async () => {
            if (loading) return;
            setLoading(true);
            try {
              await onDownload(documentS3Key);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
          Download
        </Button>
      ) : (
        <span className="text-ui text-muted-foreground">—</span>
      )}
    </div>
  );
}

export function InvoiceSingleDetail({
  application,
  invoice,
  onDocumentDownload,
  onViewSignedInvoiceOffer,
  onWithdrawInvoice,
  isWithdrawInvoicePending,
}: Props) {
  const [reasonRemarksOpen, setReasonRemarksOpen] = React.useState(false);
  const [reasonRemarksBody, setReasonRemarksBody] = React.useState("");

  const invStatus = String(invoice.status ?? "").toUpperCase();
  const showReviewOffer =
    invStatus === "OFFER_SENT" &&
    shouldShowIssuerReviewOfferCta({
      status: invoice.status,
      offer_details: invoice.offer_details,
    });
  const invoiceOfferActionCta = getIssuerOfferActionCtaFromOfferDetails(invoice.offer_details, {
    scope: "invoice",
  });
  const offerDeadline =
    invStatus === "OFFER_SENT" || invStatus === "OFFER_EXPIRED"
      ? getOfferPhaseDeadlineDisplay(invoice.offer_details)
      : null;
  const isOfferExpired = invStatus === "OFFER_EXPIRED" || offerDeadline?.isPast === true;

  const canReview = invoice.canReviewOffer;
  const showMakeAmendments =
    application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
  const hasInlineAction = showReviewOffer || showMakeAmendments || isOfferExpired;

  const canWithdrawInvoice = !["APPROVED", "REJECTED", "WITHDRAWN"].includes(invStatus);
  const showViewSignedInvoice = invoice.signedOfferLetterAvailable && onViewSignedInvoiceOffer;
  const showViewReasonRemarks = issuerInvoiceCanViewReasonRemarks(invoice);
  const withdrawInvoiceDisabled =
    !canWithdrawInvoice || !!isWithdrawInvoicePending || !!showViewSignedInvoice;

  return (
    <>
      <div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-meta text-foreground">Invoice number</p>
              <p className="text-ui font-medium text-foreground">
                <span className="tabular-nums">{invoice.number}</span>
              </p>
              <p className="text-meta text-foreground">Maturity date</p>
              <p className="text-ui text-muted-foreground">
                {invoice.maturityDate ? formatCalendarDate(invoice.maturityDate) : "—"}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <InvoiceStatusBadge
                badgeKey={resolveNormalizedInvoiceBadgeKey(invoice, application)}
                withdrawReason={invoice.withdrawReason}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {(() => {
                    return (
                      <>
                        {showViewSignedInvoice ? (
                          <>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onViewSignedInvoiceOffer!(invoice.id);
                              }}
                            >
                              View Signed Offer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}

                        {showViewReasonRemarks ? (
                          <>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReasonRemarksBody(
                                  invoice.reasonOrRemarks?.trim() ||
                                    "No reason were recorded for this invoice."
                                );
                                setReasonRemarksOpen(true);
                              }}
                            >
                              View reason
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}

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
                                invoice.id,
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
          </div>

          {hasInlineAction ? (
            <div className="flex flex-wrap items-start justify-start gap-2">
              {isOfferExpired && offerDeadline ? (
                <div className="flex flex-col text-left">
                  <p className="text-meta leading-4 text-destructive">{offerDeadline.summary}</p>
                  <p className="text-meta leading-4 text-muted-foreground">
                    A new offer may appear if resent.
                  </p>
                </div>
              ) : null}

              {showReviewOffer && canReview ? (
                <div className="flex flex-col items-center gap-0.5">
                  <Button
                    size="sm"
                    variant={
                      invoiceOfferActionCta.buttonVariant === "makeAmendments" ? "outline" : "default"
                    }
                    className={
                      invoiceOfferActionCta.buttonVariant === "makeAmendments"
                        ? "min-w-0 border-status-action-text/30 bg-status-action-bg px-2 text-status-action-text hover:bg-status-action-bg"
                        : "min-w-0"
                    }
                    asChild
                  >
                    <Link href={`/applications/${application.id}?tab=offer&invoiceId=${invoice.id}`}>
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
                <Button size="sm" variant="outline" className="w-auto" disabled>
                  {invoiceOfferActionCta.label}
                </Button>
              ) : null}

              {showMakeAmendments ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-w-0 border-status-action-text/30 bg-status-action-bg text-status-action-text hover:bg-status-action-bg"
                  asChild
                >
                  <Link href={`/applications/${application.id}/edit`}>Make Amendments</Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-meta text-foreground">Invoice Value</p>
                <p className="text-ui font-medium tabular-nums text-foreground">
                  {invoice.value != null && Number.isFinite(invoice.value)
                    ? formatCurrency(invoice.value)
                    : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-meta text-foreground">Applied Financing</p>
                <p className="text-ui font-medium tabular-nums text-foreground">
                  {invoice.appliedFinancing != null && Number.isFinite(invoice.appliedFinancing)
                    ? formatCurrency(invoice.appliedFinancing)
                    : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-meta text-foreground">Financing Offered</p>
                <p className="text-ui font-medium tabular-nums text-foreground">
                  {invoice.financingOffered?.trim() ? invoice.financingOffered : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-meta text-foreground inline-flex items-center gap-1.5">
                  Profit rate{" "}
                  <InfoTooltip
                    content={PROFIT_RATE_HEADER_TOOLTIP}
                    iconClassName="h-3.5 w-3.5 shrink-0"
                  />
                </p>
                <p className="text-ui font-medium tabular-nums text-foreground">
                  {invoice.profitRate ?? "—"}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-meta text-foreground">Documents</p>
              <InvoiceDocumentCell
                documentName={invoice.document}
                documentS3Key={invoice.documentS3Key}
                onDownload={onDocumentDownload}
              />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-meta text-foreground">
                Fees{" "}
                <InfoTooltip
                  content={FEES_HEADER_TOOLTIP}
                  iconClassName="h-3.5 w-3.5 shrink-0"
                />
              </p>
              <InvoiceFeesCell application={application} invoice={invoice} />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={reasonRemarksOpen} onOpenChange={setReasonRemarksOpen}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reason</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-ui leading-7 text-foreground">{reasonRemarksBody}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

