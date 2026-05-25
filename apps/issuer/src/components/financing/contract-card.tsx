"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { IssuerDashboardContract } from "@/types/issuer-dashboard";
import { resolveIssuerContractDashboardBadge } from "@/lib/issuer-dashboard-labels";
import type { OfferStatus } from "@/lib/offer-utils";
import {
  EM_DASH,
  IssuerFinancingStatusBadge,
  LabelValue,
  displayCell,
  formatDate,
  formatMoney,
} from "./utils";

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

export function DashboardContractCard({
  row,
  offerStatus,
  onReviewOffer,
}: {
  row: IssuerDashboardContract;
  offerStatus: OfferStatus;
  onReviewOffer: () => void;
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
  const pendingCount = Math.max(0, stats.total - stats.approved - stats.rejected);
  const fundedCount = stats.activeNotes + stats.completedNotes;

  const invoiceBreakdownParts = [
    pendingCount > 0 ? `${pendingCount} pending` : null,
    stats.approved > 0 ? `${stats.approved} approved` : null,
    fundedCount > 0 ? `${fundedCount} funded` : null,
    stats.completedNotes > 0 ? `${stats.completedNotes} completed` : null,
    stats.rejected > 0 ? `${stats.rejected} rejected` : null,
  ].filter(Boolean) as string[];
  const invoiceBreakdownLabel = invoiceBreakdownParts.length > 0 ? invoiceBreakdownParts.join(", ") : null;

  return (
    <Card className="min-w-0 max-w-full rounded-xl border border-border bg-muted/50 shadow-none">
      <div className="space-y-3 px-4 py-4 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate leading-5">
                <span className="text-sm font-normal leading-5 text-foreground">Contract: </span>
                <span className="text-sm font-semibold leading-5 text-foreground">{displayCell(row.title)}</span>
              </p>
              <IssuerFinancingStatusBadge kind={resolveIssuerContractDashboardBadge(row.contractStatus)} />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/financing/contracts/${row.id}`}>View details</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-col gap-2 pl-3 sm:pl-4">
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
              <LabelValue label="Contract period">{contractPeriod}</LabelValue>
              <LabelValue label="Active notes">{String(row.activeNotesCount)}</LabelValue>
              <p className="text-[17px] leading-7 text-foreground">
                <span className="font-normal text-muted-foreground">Invoices: </span>
                <span className="font-medium tabular-nums text-foreground">{stats.total}</span>
                {invoiceBreakdownLabel ? (
                  <span className="text-sm font-normal leading-6 text-muted-foreground">
                    {" "}
                    ({invoiceBreakdownLabel})
                  </span>
                ) : null}
              </p>
            </div>
            <div className="min-w-0 w-full space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 dark:bg-muted shadow-sm">
                <div
                  className="h-3 rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, Math.max(0, utilisationPct))}%` }}
                />
              </div>
              <div className="flex justify-between gap-6 sm:gap-8">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">
                    {formatMoney(row.utilizedFacilityAmount)}
                  </p>
                  <p className="text-sm font-normal leading-6 text-muted-foreground">(Utilised facility)</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">
                    {formatMoney(row.approvedFacilityAmount)}
                  </p>
                  <p className="text-sm font-normal leading-6 text-muted-foreground">(Approved facility)</p>
                </div>
              </div>
              {row.facilityFeeCapAmount != null && row.facilityFeePaidAmount != null ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Facility fee collected:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatMoney(row.facilityFeePaidAmount)} / {formatMoney(row.facilityFeeCapAmount)} cap
                  </span>
                  <span className="block">Deducted only when invoices are disbursed.</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
