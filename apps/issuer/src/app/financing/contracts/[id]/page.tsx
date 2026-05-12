"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrganization } from "@cashsouk/config";
import { useHeader, formatMoneyDisplay } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { useIssuerDashboardContract } from "@/hooks/use-issuer-dashboard";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import {
  FilterButton,
  DashboardInvoiceCard,
  LabelValue,
  formatDate,
  displayCell,
  IssuerFinancingStatusBadge,
  EM_DASH,
} from "@/components/dashboard/financing-section";
import { ReviewOfferModal } from "@/components/review-offer-modal";
import { getOfferStatus } from "@/lib/offer-utils";
import { resolveIssuerContractDashboardBadge } from "@/lib/issuer-dashboard-labels";
import { asInvoiceForModal } from "@/types/issuer-dashboard";
import type { Invoice } from "@cashsouk/types";

function formatMoney(value: unknown) {
  return formatMoneyDisplay(value, EM_DASH);
}

export default function ContractDetailsPage() {
  const params = useParams();
  const contractId = params.id as string;
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const { setTitle } = useHeader();
  const [offerModalContext, setOfferModalContext] = useState<Parameters<typeof ReviewOfferModal>[0]["context"]>(null);

  useEffect(() => {
    setTitle("Contract");
  }, [setTitle]);

  const { data, isLoading, isError, error } = useIssuerDashboardContract(orgId, contractId);

  const row = data?.contract ?? null;
  const invoices = data?.invoices ?? [];

  const approved = row?.approvedFacilityAmount != null ? Number(row.approvedFacilityAmount) : 0;
  const utilised = row?.utilizedFacilityAmount != null ? Number(row.utilizedFacilityAmount) : 0;
  const utilisationPct = approved > 0 ? Math.round((utilised / approved) * 100) : 0;

  const contractPeriod =
    row?.contractStartDate && row?.contractEndDate
      ? `${formatDate(row.contractStartDate)} to ${formatDate(row.contractEndDate)}`
      : row?.contractStartDate || row?.contractEndDate
        ? formatDate(row.contractStartDate ?? row.contractEndDate)
        : EM_DASH;

  const productLabel =
    row?.productName?.trim() ? displayCell(row.productName) : "Contract Financing";

  const shellClass = cn(issuerMainContentClassName, issuerPageGutterClassName);

  if (!orgId) {
    return (
      <div className={shellClass}>
        <p className="text-[17px] leading-7 text-muted-foreground">Select an organization to view this contract.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${shellClass} flex min-h-[240px] items-center justify-center text-[17px] leading-7 text-muted-foreground`}>
        Loading contract…
      </div>
    );
  }

  if (isError) {
    return (
      <div className={shellClass}>
        <p className="font-medium text-destructive">Could not load contract</p>
        <p className="mt-2 text-[17px] leading-7 text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className={shellClass}>
        <p className="text-[17px] leading-7 text-muted-foreground">Contract not found or you do not have access.</p>
      </div>
    );
  }

  const stats = row.invoiceStats;

  return (
    <div className={cn(shellClass, "space-y-6 md:space-y-8")}>
      <ReviewOfferModal
        open={offerModalContext !== null}
        onOpenChange={(open) => !open && setOfferModalContext(null)}
        context={offerModalContext}
      />

      <section className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{displayCell(row.title)}</h2>
            <IssuerFinancingStatusBadge kind={resolveIssuerContractDashboardBadge(row.contractStatus)} />
          </div>
          <p className="mt-1 text-[17px] leading-7 text-muted-foreground">
            {displayCell(row.customerName)} · {contractPeriod}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-11 shrink-0 gap-2 rounded-xl border-input font-semibold focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Link href="/">Back to dashboard</Link>
        </Button>
      </section>

      <Card className="rounded-xl border border-border bg-background shadow-none">
        <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-2 pl-0 sm:pl-1">
            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-6 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <LabelValue label="Product">{productLabel}</LabelValue>
                <LabelValue label="Customer">{displayCell(row.customerName)}</LabelValue>
                <LabelValue label="Contract period">{contractPeriod}</LabelValue>
                <LabelValue label="Active notes">{String(row.activeNotesCount)}</LabelValue>
              </div>

              <div className="min-w-0 w-full space-y-2">
                <LabelValue label="Available facility" tabular>
                  {row.availableFacilityAmount != null ? formatMoney(row.availableFacilityAmount) : EM_DASH}
                </LabelValue>
                <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 shadow-sm dark:bg-muted">
                  <div
                    className="h-3 rounded-full bg-foreground"
                    style={{ width: `${Math.min(100, Math.max(0, utilisationPct))}%` }}
                  />
                </div>
                <div className="flex justify-between gap-6 sm:gap-8">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">
                      {formatMoney(utilised)}
                    </p>
                    <p className="text-sm font-normal leading-6 text-muted-foreground">(Utilised facility)</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">
                      {formatMoney(approved)}
                    </p>
                    <p className="text-sm font-normal leading-6 text-muted-foreground">(Approved facility)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-8 xl:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                Total no. of invoices: {stats.total}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricBox label="Approved" value={`${stats.approved}`} />
                <MetricBox label="Rejected" value={`${stats.rejected}`} />
                <MetricBox label="Unfinanced" value={`${stats.unfinanced}`} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                Breakdown of approved invoices
              </h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-[17px] leading-7 sm:grid-cols-2">
                <BreakdownItem label="Funding in progress" value={`${stats.fundingInProgress}`} />
                <BreakdownItem label="Active notes" value={`${stats.activeNotes}`} />
                <BreakdownItem label="Completed notes" value={`${stats.completedNotes}`} />
                <BreakdownItem label="Unsuccessful raise" value={`${stats.unsuccessfulRaise}`} />
                {stats.disputedNotes != null ? (
                  <BreakdownItem label="Disputed notes" value={`${stats.disputedNotes}`} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h3 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Invoices</h3>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <FilterButton label="Status" />
            <FilterButton label="Submission date" />
          </div>
        </div>

        {invoices.length === 0 ? (
          <p className="text-[17px] leading-7 text-muted-foreground">No invoices for this contract.</p>
        ) : (
          invoices.map((inv) => {
            const modalInvoice = asInvoiceForModal(inv.invoiceForModal) as Invoice;
            return (
              <DashboardInvoiceCard
                key={inv.id}
                row={inv}
                offerStatus={getOfferStatus(modalInvoice)}
                onReviewOffer={() =>
                  setOfferModalContext({
                    type: "invoice",
                    applicationId: inv.applicationId,
                    invoiceId: inv.id,
                    invoice: modalInvoice,
                  })
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-4 shadow-none">
      <p className="text-sm font-medium leading-6 text-muted-foreground">{label}</p>
      <p className="text-[17px] font-semibold tabular-nums leading-7 text-foreground">{value}</p>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="min-w-0 font-normal text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
