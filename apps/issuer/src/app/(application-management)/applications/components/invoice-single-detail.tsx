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
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import { ScrollableInvoiceTableProps } from "./scrollable-invoice-table";
import { issuerInvoiceCanViewReasonRemarks, resolveNormalizedInvoiceBadgeKey } from "../status";
import { buildInvoiceFeeDisplay, money } from "@/lib/facility-fee-display";
import { FinancingKpiTile } from "@/components/financing/financing-kpi-strip";

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
    if (capReached) return "cap_reached";
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
      <div className="px-6 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-ui font-medium text-foreground">
                Invoice <span className="tabular-nums">{invoice.number}</span>
              </p>
              <p className="text-meta text-muted-foreground">
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

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FinancingKpiTile
                label="Invoice Value"
                value={
                  invoice.value != null && Number.isFinite(invoice.value)
                    ? formatCurrency(invoice.value)
                    : "—"
                }
              />
              <FinancingKpiTile
                label="Applied Financing"
                value={
                  invoice.appliedFinancing != null && Number.isFinite(invoice.appliedFinancing)
                    ? formatCurrency(invoice.appliedFinancing)
                    : "—"
                }
              />
              <FinancingKpiTile
                label="Financing Offered"
                value={invoice.financingOffered?.trim() ? invoice.financingOffered : "—"}
              />
              <FinancingKpiTile
                label="Profit rate"
                value={invoice.profitRate ?? "—"}
                labelExtra={
                  <InfoTooltip
                    content={PROFIT_RATE_HEADER_TOOLTIP}
                    iconClassName="h-3.5 w-3.5 shrink-0"
                  />
                }
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-meta text-muted-foreground">Documents</p>
                <InvoiceDocumentCell
                  documentName={invoice.document}
                  documentS3Key={invoice.documentS3Key}
                  onDownload={onDocumentDownload}
                />
              </div>

              <div className="space-y-1">
                <p className="text-meta text-muted-foreground">
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

