"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { LinkIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { asInvoiceForModal } from "@/types/issuer-dashboard";
import {
  resolveFundingProgressPercent,
  resolveFundingStatusText,
  resolveIssuerInvoiceDashboardBadge,
} from "@/lib/issuer-dashboard-labels";
import type { OfferStatus } from "@/lib/offer-utils";
import {
  EM_DASH,
  FundingStatusLine,
  IssuerFinancingStatusBadge,
  LabelValue,
  displayCell,
  formatDate,
  formatMoney,
} from "./utils";
import { buildInvoiceFeeDisplay, money } from "@/lib/facility-fee-display";

function offerBadge(offerStatus: OfferStatus) {
  if (!offerStatus) return null;
  if (offerStatus === "Offer expired") {
    return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Offer expired</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Offer received</Badge>;
}

function ReviewOfferButton({ show, onClick }: { show: boolean; onClick?: () => void }) {
  if (!show) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="reviewOffer"
      className="rounded-xl"
      onClick={onClick}
    >
      Review offer
    </Button>
  );
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
    display.phase === "charged" && display.netDisbursementAmount != null ? money(display.netDisbursementAmount) : "—";

  const platformValue = display.platformFeeAmount != null ? money(display.platformFeeAmount) : "—";

  const facilityValue =
    display.facilityFeeAmount != null
      ? `${money(display.facilityFeeAmount)}${capReached ? " (cap reached)" : ""}`
      : "—";

  const facilityLabel = "Facility fee";

  return (
    <div className="space-y-1">
      <LabelValue label="Net disbursed" tabular>
        {netDisbursed}
      </LabelValue>

      <LabelValue label="Platform fee" tabular>
        {platformValue}
      </LabelValue>

      <LabelValue label={facilityLabel} tabular>
        {facilityValue}
      </LabelValue>
    </div>
  );
}

export function DashboardInvoiceCard({
  row,
  offerStatus,
  onReviewOffer,
  contractFeeContext,
}: {
  row: IssuerDashboardInvoice;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
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
  const progress = resolveFundingProgressPercent(row.note);
  const fundingLabel = resolveFundingStatusText(row.note);
  const noteRef = displayCell(row.note?.noteReference);
  const invDetails = asInvoiceForModal(row.invoiceForModal)?.details;
  const maturityRaw = invDetails?.maturity_date ?? row.note?.maturityDate ?? null;
  const offerDetails = asInvoiceForModal(row.invoiceForModal)?.offer_details as
    | Record<string, unknown>
    | null
    | undefined;
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

  return (
    <Card className="min-w-0 max-w-full rounded-xl border border-border bg-muted/50 shadow-none">
      <div className="space-y-3 px-4 py-4 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate leading-5">
                <span className="text-sm font-normal leading-5 text-foreground">Invoice no: </span>
                <span className="text-sm font-semibold leading-5 text-foreground">
                  {displayCell(row.invoiceNumber)}
                </span>
              </p>
              <IssuerFinancingStatusBadge kind={badgeKind} />
              {offerBadge(offerStatus)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ReviewOfferButton show={offerStatus === "Offer received"} onClick={onReviewOffer} />
            {showActionRequired ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-amber-500/30 bg-amber-50 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
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
          </div>
        </div>

        <div className="flex flex-col gap-2 pl-3 sm:pl-4">
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p className="text-[17px] leading-7 text-foreground">
                <span className="font-normal text-muted-foreground">Note no: </span>
                {row.note?.id && noteRef !== EM_DASH ? (
                  <Link
                    href={`/notes/${row.note.id}`}
                    className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <span className="min-w-0 truncate">{noteRef}</span>
                    <LinkIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{noteRef}</span>
                )}
              </p>
              <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
            </div>
            <div className="min-w-0 space-y-2">
              <LabelValue label="Submission date">{formatDate(row.submissionDate)}</LabelValue>
              <LabelValue label="Funding deadline">
                {row.note?.fundingDeadline ? formatDate(row.note.fundingDeadline) : EM_DASH}
              </LabelValue>
              <LabelValue label="Maturity date">{formatDate(maturityRaw)}</LabelValue>
            </div>
          </div>

          <div className="grid grid-cols-1 items-end gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <LabelValue label="Invoice value" tabular>
                {formatMoney(row.invoiceValue)}
              </LabelValue>
              <LabelValue label="Financing amount" tabular>
                {formatMoney(row.financingAmount)}
              </LabelValue>
              {showFeeSummary ? (
                <InvoiceFeeSummary display={feeDisplay} hideFeeValues={hideFeesBeforeAcceptance} />
              ) : null}
            </div>
            <div className="min-w-0 w-full space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 dark:bg-muted shadow-sm">
                <div
                  className="h-3 rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <FundingStatusLine text={fundingLabel} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
