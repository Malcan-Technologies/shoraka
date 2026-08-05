"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { asInvoiceForModal } from "@/types/issuer-dashboard";
import {
  resolveFundingStatusText,
  resolveIssuerInvoiceDashboardBadge,
} from "@/lib/issuer-dashboard-labels";
import { financingOfferHref } from "@/lib/financing-offer-href";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  shouldShowIssuerReviewOfferCta,
  type OfferStatus,
} from "@/lib/offer-utils";
import { cn } from "@/lib/utils";
import { FinancingKpiTile } from "./financing-kpi-strip";
import { FinancingPercentMark } from "./financing-percent-mark";
import {
  EM_DASH,
  FINANCING_ATTENTION_SURFACE,
  FINANCING_OFFER_ATTENTION_SURFACE,
  IssuerFinancingStatusBadge,
  LabelValue,
  displayCell,
  formatDate,
  formatMoney,
} from "./utils";
import { buildInvoiceFeeDisplay, money } from "@/lib/facility-fee-display";

function OfferStatusBadge({ offerStatus }: { offerStatus: OfferStatus }) {
  if (!offerStatus) return null;
  if (offerStatus === "Offer expired") {
    return <StatusBadge label="Offer expired" status="rejected" />;
  }
  return <StatusBadge label="Offer received" status="action" />;
}

function InvoiceScopeBadge({ contractId }: { contractId: string | null }) {
  if (contractId) {
    return <StatusBadge label="Under contract" status="completed" />;
  }
  return <StatusBadge label="Standalone" status="neutral" />;
}

function InvoiceFeeSummary({
  display,
  hideFeeValues,
}: {
  display: ReturnType<typeof buildInvoiceFeeDisplay>;
  hideFeeValues?: boolean;
}) {
  if (hideFeeValues) {
    return (
      <div className="space-y-1">
        <LabelValue label="Net disbursed" tabular>
          —
        </LabelValue>
        <LabelValue label="Platform fee" tabular>
          —
        </LabelValue>
        <LabelValue label="Facility fee" tabular>
          —
        </LabelValue>
      </div>
    );
  }

  const capReached = display.facilityFeeFullyCollected && display.facilityFeeAmount === 0;

  const netDisbursed =
    display.phase === "charged" && display.netDisbursementAmount != null
      ? money(display.netDisbursementAmount)
      : "—";

  const platformValue = display.platformFeeAmount != null ? money(display.platformFeeAmount) : "—";

  const facilityValue =
    display.facilityFeeAmount != null
      ? `${money(display.facilityFeeAmount)}${capReached ? " (cap reached)" : ""}`
      : "—";

  return (
    <div className="space-y-1">
      <LabelValue label="Net disbursed" tabular>
        {netDisbursed}
      </LabelValue>
      <LabelValue label="Platform fee" tabular>
        {platformValue}
      </LabelValue>
      <LabelValue label="Facility fee" tabular>
        {facilityValue}
      </LabelValue>
    </div>
  );
}

function parseAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/^RM\s*/i, "")
    .replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function resolveFinancingPercent(
  invDetails: { financing_ratio_percent?: number | string } | null | undefined,
  offerDetails: Record<string, unknown> | null | undefined,
  invoiceValue: unknown,
  financingAmount: unknown
): number | null {
  const fromDetails = Number(invDetails?.financing_ratio_percent);
  if (Number.isFinite(fromDetails) && fromDetails > 0) return fromDetails;

  const offered = Number(offerDetails?.offered_ratio_percent);
  if (Number.isFinite(offered) && offered > 0) return offered;

  const requested = Number(offerDetails?.requested_ratio_percent);
  if (Number.isFinite(requested) && requested > 0) return requested;

  const invoice = parseAmount(invoiceValue);
  const financing = parseAmount(financingAmount);
  if (invoice != null && invoice > 0 && financing != null) {
    return (financing / invoice) * 100;
  }
  return null;
}

export function DashboardInvoiceCard({
  row,
  offerStatus,
  contractFeeContext,
}: {
  row: IssuerDashboardInvoice;
  offerStatus: OfferStatus;
  /** @deprecated Offer review navigates to the application Offer tab. */
  onReviewOffer?: () => void;
  contractFeeContext?: {
    facilityFeeRatePercent?: unknown;
    facilityFeeCapAmount?: unknown;
    facilityFeePaidAmount?: unknown;
  };
}) {
  const router = useRouter();
  const actionRequiredApplicationIds = row.actionRequiredApplicationIds ?? [];
  const actionRequiredCount = actionRequiredApplicationIds.length;
  const showActionRequired = actionRequiredCount > 0;
  const actionRequiredLabel =
    actionRequiredCount === 1 ? "Action required" : `Action required (${actionRequiredCount})`;
  const badgeKind = resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus);
  const fundingLabel = resolveFundingStatusText(row.note);
  const invoiceModal = asInvoiceForModal(row.invoiceForModal);
  const invDetails = invoiceModal?.details;
  const maturityRaw = invDetails?.maturity_date ?? row.note?.maturityDate ?? null;
  const offerDetails = invoiceModal?.offer_details as Record<string, unknown> | null | undefined;
  const financingPercent = resolveFinancingPercent(
    invDetails,
    offerDetails,
    row.invoiceValue,
    row.financingAmount
  );
  const feeDisplay = buildInvoiceFeeDisplay({
    status: row.note?.noteStatus ?? row.invoiceStatus,
    offerDetails,
    financingAmount: row.financingAmount,
    isContractFinancing: Boolean(row.contractId),
    contractFacilityFeeRatePercent: contractFeeContext?.facilityFeeRatePercent,
    contractFacilityFeeCapAmount: contractFeeContext?.facilityFeeCapAmount,
    contractFacilityFeePaidAmount: contractFeeContext?.facilityFeePaidAmount,
    actual: row.note?.disbursementBreakdown,
  });
  const showFeeSummary = feeDisplay.phase !== "pending" || offerStatus === "Offer received";
  const hideFeesBeforeAcceptance = offerStatus === "Offer received";
  const reviewOfferVisible = shouldShowIssuerReviewOfferCta({
    status: offerStatus === "Offer received" ? "OFFER_SENT" : offerStatus,
    offer_details: offerDetails,
  });
  const showReviewOffer = offerStatus === "Offer received" && reviewOfferVisible;
  const offerActionCta = getIssuerOfferActionCtaFromOfferDetails(offerDetails, { scope: "invoice" });
  const attentionSurface = showReviewOffer
    ? FINANCING_OFFER_ATTENTION_SURFACE
    : showActionRequired
      ? FINANCING_ATTENTION_SURFACE
      : null;

  return (
    <article
      className={cn(
        "min-w-0 max-w-full rounded-2xl border p-4 shadow-sm md:p-5",
        attentionSurface ?? "border-border bg-card"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate leading-5">
                <span className="text-sm font-normal leading-5 text-foreground">Invoice no: </span>
                <Link
                  href={`/financing/invoices/${row.id}`}
                  className="text-sm font-semibold leading-5 text-foreground underline-offset-4 hover:underline"
                >
                  {displayCell(row.invoiceNumber)}
                </Link>
              </p>
              <IssuerFinancingStatusBadge kind={badgeKind} />
              <InvoiceScopeBadge contractId={row.contractId} />
              <OfferStatusBadge offerStatus={offerStatus} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showReviewOffer ? (
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button
                  size="sm"
                  variant={offerActionCta.buttonVariant === "makeAmendments" ? "outline" : "default"}
                  className={
                    offerActionCta.buttonVariant === "makeAmendments"
                      ? "rounded-xl border-status-action-text/30 bg-status-action-bg text-status-action-text hover:bg-status-action-bg"
                      : "rounded-xl"
                  }
                  asChild
                >
                  <Link href={financingOfferHref(row.applicationId, row.id)}>{offerActionCta.label}</Link>
                </Button>
              </div>
            ) : null}
            {showActionRequired ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-status-action-text/30 bg-status-action-bg px-3 text-xs font-medium text-status-action-text hover:bg-status-action-bg"
                      onClick={() =>
                        router.push(
                          `/applications?applicationIds=${encodeURIComponent(
                            actionRequiredApplicationIds.join(",")
                          )}`
                        )
                      }
                    >
                      {actionRequiredLabel}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] whitespace-normal break-words bg-popover px-2 py-1.5 text-popover-foreground shadow-md">
                    {actionRequiredCount === 1
                      ? "A related application needs amendment. Go to Applications to review and update it."
                      : `${actionRequiredCount} related applications need amendment. Go to Applications to review and update them.`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <Button size="sm" variant="outline" className="rounded-xl" asChild>
              <Link href={`/financing/invoices/${row.id}`}>View details</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex shrink-0 items-center justify-center sm:w-[11rem] sm:justify-start">
            <FinancingPercentMark percent={financingPercent} centerLabel="Financed" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FinancingKpiTile label="Invoice value" value={formatMoney(row.invoiceValue)} />
              <FinancingKpiTile label="Financing" value={formatMoney(row.financingAmount)} />
            </div>

            <p className="text-[13px] leading-5 text-muted-foreground">{fundingLabel}</p>

            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-2 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
                {row.note?.id ? (
                  <p className="text-[17px] leading-7 text-foreground">
                    <span className="font-normal text-muted-foreground">Note: </span>
                    <Link
                      href={`/financing/notes/${row.note.id}`}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <span className="min-w-0 truncate">View note</span>
                      <LinkIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    </Link>
                  </p>
                ) : (
                  <LabelValue label="Note">{EM_DASH}</LabelValue>
                )}
                {row.contractId ? (
                  <p className="text-[17px] leading-7 text-foreground">
                    <span className="font-normal text-muted-foreground">Contract: </span>
                    <Link
                      href={`/financing/contracts/${row.contractId}`}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <span className="min-w-0 truncate">View contract</span>
                      <LinkIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    </Link>
                  </p>
                ) : null}
                <LabelValue label="Submission date">{formatDate(row.submissionDate)}</LabelValue>
              </div>
              <div className="min-w-0 space-y-2">
                <LabelValue label="Funding deadline">
                  {row.note?.fundingDeadline ? formatDate(row.note.fundingDeadline) : EM_DASH}
                </LabelValue>
                <LabelValue label="Maturity date">{formatDate(maturityRaw)}</LabelValue>
                {showFeeSummary ? (
                  <InvoiceFeeSummary
                    display={feeDisplay}
                    hideFeeValues={hideFeesBeforeAcceptance}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
