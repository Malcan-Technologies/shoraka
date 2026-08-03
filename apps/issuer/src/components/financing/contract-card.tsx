"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocumentTextIcon, EllipsisVerticalIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import { resolveIssuerContractDashboardBadge } from "@/lib/issuer-dashboard-labels";
import { financingOfferHref } from "@/lib/financing-offer-href";
import type { OfferStatus } from "@/lib/offer-utils";
import { cn } from "@/lib/utils";
import { FinancingDonut } from "./financing-donut";
import { FinancingKpiTile } from "./financing-kpi-strip";
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

function OfferStatusBadge({ offerStatus }: { offerStatus: OfferStatus }) {
  if (!offerStatus) return null;
  if (offerStatus === "Offer expired") {
    return <StatusBadge label="Offer expired" status="rejected" />;
  }
  return <StatusBadge label="Offer received" status="action" />;
}

export function DashboardContractCard({
  row,
  offerStatus,
}: {
  row: IssuerDashboardContract;
  offerStatus: OfferStatus;
  /** @deprecated Offer review navigates to the application Offer tab. */
  onReviewOffer?: () => void;
}) {
  const router = useRouter();
  const actionRequiredApplicationIds = row.actionRequiredApplicationIds ?? [];
  const actionRequiredCount = actionRequiredApplicationIds.length;
  const showActionRequired = actionRequiredCount > 0;
  const actionRequiredLabel =
    actionRequiredCount === 1 ? "Action required" : `Action required (${actionRequiredCount})`;
  const approvedNum = row.approvedFacilityAmount != null ? Number(row.approvedFacilityAmount) : null;
  const utilisedNum = row.utilizedFacilityAmount != null ? Number(row.utilizedFacilityAmount) : null;
  const utilisationPct =
    approvedNum != null && utilisedNum != null && approvedNum > 0
      ? Math.round((utilisedNum / approvedNum) * 100)
      : 0;

  const contractPeriod =
    row.contractStartDate && row.contractEndDate
      ? `${formatDate(row.contractStartDate)} to ${formatDate(row.contractEndDate)}`
      : row.contractStartDate || row.contractEndDate
        ? formatDate(row.contractStartDate ?? row.contractEndDate)
        : EM_DASH;

  const stats = row.invoiceStats;
  const showReviewOffer = offerStatus === "Offer received";
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
                <span className="text-sm font-normal leading-5 text-foreground">Contract: </span>
                <Link
                  href={`/financing/contracts/${row.id}`}
                  className="text-sm font-semibold leading-5 text-foreground underline-offset-4 hover:underline"
                >
                  {displayCell(row.title)}
                </Link>
              </p>
              <IssuerFinancingStatusBadge kind={resolveIssuerContractDashboardBadge(row.contractStatus)} />
              <OfferStatusBadge offerStatus={offerStatus} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showReviewOffer ? (
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button size="sm" className="rounded-xl" asChild>
                  <Link href={financingOfferHref(row.applicationId)}>Review offer</Link>
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
              <Link href={`/financing/contracts/${row.id}`}>View details</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="More actions">
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/applications/${row.applicationId}`}>View application</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex shrink-0 items-center justify-center sm:w-[11rem] sm:justify-start">
            <FinancingDonut
              size="lg"
              centerLabel="Utilised"
              percent={approvedNum != null && approvedNum > 0 ? utilisationPct : null}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FinancingKpiTile
                label="Utilised"
                value={formatMoney(row.utilizedFacilityAmount)}
              />
              <FinancingKpiTile
                label="Approved"
                value={formatMoney(row.approvedFacilityAmount)}
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-2 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
                <LabelValue label="Contract period">{contractPeriod}</LabelValue>
                <LabelValue label="Active notes">{String(row.activeNotesCount)}</LabelValue>
                <p className="text-[17px] leading-7 text-foreground">
                  <span className="font-normal text-muted-foreground">Invoices: </span>
                  <span className="font-medium tabular-nums text-foreground">{stats.total}</span>
                </p>
              </div>
              <div className="min-w-0 space-y-2">
                {row.facilityFeeCapAmount != null && row.facilityFeePaidAmount != null ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Facility fee collected:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatMoney(row.facilityFeePaidAmount)} /{" "}
                      {formatMoney(row.facilityFeeCapAmount)} cap
                    </span>
                    <span className="ml-1 inline-flex items-center align-middle">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InformationCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px] whitespace-normal break-words bg-popover px-2 py-1.5 text-popover-foreground shadow-md">
                            Shows the total facility fee collected so far for this contract.
                            Facility fee is deducted from each invoice financing disbursement until
                            the cap is reached.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
